import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import { isAiConfigured } from "@/lib/ai/style-advice";
import { isMissingSchema } from "@/lib/panel/guard";
import type { AppointmentStatus } from "@/lib/panel/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { createPublicClient } from "@/lib/supabase/public";

import type { Consultation, CustomerAppointment, SalonReviews } from "./types";

// Müşteri tarafı okuma katmanı. Müşterinin hesabı yoktur; kimliği randevunun
// gizli bağlantısıdır (appointments.manage_token). Bu yüzden sorgular service
// role ile yapılır ve yalnızca o randevuya ait veriyi döner.

export type AdminClient = NonNullable<ReturnType<typeof createAdminClient>>;

const TOKEN_RE = /^[0-9a-f]{64}$/;
const SIGNED_URL_SECONDS = 60 * 60;

export type TokenAppointment = {
  id: string;
  salon_id: string;
  barber_id: string;
  customer_id: string;
  status: AppointmentStatus;
  starts_at: string;
  ends_at: string;
  total_price: number;
};

/** Gizli bağlantıdan randevuyu bulur; bağlantı geçersizse null. */
export async function findAppointmentByToken(
  admin: AdminClient,
  token: unknown,
): Promise<TokenAppointment | null> {
  if (typeof token !== "string" || !TOKEN_RE.test(token)) return null;
  const { data, error } = await admin
    .from("appointments")
    .select("id, salon_id, barber_id, customer_id, status, starts_at, ends_at, total_price")
    .eq("manage_token", token)
    .maybeSingle();
  if (error) throw new Error(`appointment by token: ${error.message}`, { cause: error });
  return data as TokenAppointment | null;
}

type ConsultationRow = {
  id: string;
  kind: "ai" | "staff";
  customer_note: string | null;
  images: string[];
  ai_notes: string | null;
  staff_reply: string | null;
  price_estimate: number | null;
  created_at: string;
};

export const CONSULTATION_COLUMNS =
  "id, kind, customer_note, images, ai_notes, staff_reply, price_estimate, created_at";

/** Danışma satırını, görselleri için imzalı adreslerle birlikte görünüme çevirir. */
export async function toConsultation(admin: AdminClient, row: ConsultationRow): Promise<Consultation> {
  let imageUrls: string[] = [];
  if (row.images.length > 0) {
    const signed = await admin.storage
      .from("consultations")
      .createSignedUrls(row.images, SIGNED_URL_SECONDS);
    imageUrls = (signed.data ?? []).flatMap((item) => (item.signedUrl ? [item.signedUrl] : []));
  }
  return {
    id: row.id,
    kind: row.kind,
    note: row.customer_note,
    imageUrls,
    aiNotes: row.ai_notes,
    staffReply: row.staff_reply,
    priceEstimate: row.price_estimate === null ? null : Number(row.price_estimate),
    createdAt: row.created_at,
  };
}

/** Müşterinin randevu sayfasının verisi; bağlantı geçersizse null. */
export async function getCustomerAppointment(token: string): Promise<CustomerAppointment | null> {
  const admin = createAdminClient();
  if (!admin) throw new Error("SUPABASE_SERVICE_ROLE_KEY tanımlı değil");

  const appointment = await findAppointmentByToken(admin, token);
  if (!appointment) return null;

  const [salon, barber, services, consultations, review] = await Promise.all([
    admin
      .from("salons")
      .select("name, slug, timezone, currency, phone")
      .eq("id", appointment.salon_id)
      .single(),
    admin.from("barbers").select("display_name").eq("id", appointment.barber_id).maybeSingle(),
    admin
      .from("appointment_services")
      .select("service_name")
      .eq("appointment_id", appointment.id)
      .order("sort_order"),
    admin
      .from("consultation_requests")
      .select(CONSULTATION_COLUMNS)
      .eq("appointment_id", appointment.id)
      .order("created_at"),
    admin
      .from("reviews")
      .select("rating, staff_rating, comment, reply")
      .eq("appointment_id", appointment.id)
      .maybeSingle(),
  ]);
  if (salon.error) throw new Error(`salon: ${salon.error.message}`, { cause: salon.error });
  if (services.error) throw new Error(`services: ${services.error.message}`, { cause: services.error });
  for (const result of [consultations, review]) {
    if (result.error && !isMissingSchema(result.error)) {
      throw new Error(result.error.message, { cause: result.error });
    }
  }

  return {
    status: appointment.status,
    startsAt: appointment.starts_at,
    endsAt: appointment.ends_at,
    totalPrice: Number(appointment.total_price),
    barberName: barber.data?.display_name ?? "",
    services: (services.data ?? []).map((item) => item.service_name as string),
    salon: salon.data,
    consultations: consultations.error
      ? null
      : await Promise.all(
          (consultations.data as ConsultationRow[]).map((row) => toConsultation(admin, row)),
        ),
    review: review.error
      ? undefined
      : review.data
        ? {
            rating: review.data.rating,
            staffRating: review.data.staff_rating,
            comment: review.data.comment,
            reply: review.data.reply,
          }
        : null,
    aiAvailable: isAiConfigured(),
  };
}

/** 'reviews' kovasındaki bir dosyanın herkese açık adresi. */
export function reviewPhotoUrl(path: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/reviews/${path}`;
}

/**
 * Vitrin için onaylı yorumlar (öne çıkanlar önce) ve ortalama puan. Ortalama
 * salonun tüm değerlendirmelerinden hesaplanır. Özellik etkin değilse null.
 */
export async function getSalonReviews(salonId: string): Promise<SalonReviews | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag(`reviews:${salonId}`);

  const supabase = createPublicClient();
  const [rating, reviews] = await Promise.all([
    supabase.rpc("get_salon_rating", { p_salon_id: salonId }),
    supabase
      .from("reviews")
      .select("id, author_name, rating, comment, photos, reply, is_featured, created_at")
      .eq("salon_id", salonId)
      .order("is_featured", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(6),
  ]);
  if (isMissingSchema(rating.error) || isMissingSchema(reviews.error)) return null;
  if (rating.error) throw new Error(`get_salon_rating: ${rating.error.message}`, { cause: rating.error });
  if (reviews.error) throw new Error(`reviews: ${reviews.error.message}`, { cause: reviews.error });

  const summary = (rating.data as { average: number | null; total: number }[])[0];
  return {
    average: summary?.average === null || summary === undefined ? null : Number(summary.average),
    total: Number(summary?.total ?? 0),
    reviews: reviews.data.map((review) => ({
      id: review.id,
      author_name: review.author_name,
      rating: review.rating,
      comment: review.comment,
      photoUrls: (review.photos as string[]).map(reviewPhotoUrl),
      reply: review.reply,
      is_featured: review.is_featured,
      created_at: review.created_at,
    })),
  };
}
