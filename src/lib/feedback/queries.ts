import "server-only";

import { reviewPhotoUrl } from "@/lib/customer/queries";
import { isMissingSchema } from "@/lib/panel/guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// Panel tarafı: görsel danışma talepleri ve müşteri yorumları. Satırlar oturum
// istemcisiyle (RLS) okunur; kimin neyi göreceğini veritabanı belirler. Kapalı
// kovadaki görseller için imzalı adresi sunucu, yalnızca RLS'in döndürdüğü
// satırların dosyaları için üretir.

const SIGNED_URL_SECONDS = 60 * 60;

export type PanelConsultation = {
  id: string;
  kind: "ai" | "staff";
  status: "open" | "answered";
  customer_name: string;
  customer_phone: string;
  barber_name: string;
  appointment_starts_at: string | null;
  customer_note: string | null;
  imageUrls: string[];
  ai_notes: string | null;
  staff_reply: string | null;
  price_estimate: number | null;
  created_at: string;
};

export async function listConsultations(salonId: string): Promise<PanelConsultation[] | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("consultation_requests")
    .select(
      "id, kind, status, customer_note, images, ai_notes, staff_reply, price_estimate, created_at, customers (full_name, phone), barbers (display_name), appointments (starts_at)",
    )
    .eq("salon_id", salonId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (isMissingSchema(error)) return null;
  if (error) throw new Error(`consultation_requests: ${error.message}`, { cause: error });

  type Row = {
    id: string;
    kind: "ai" | "staff";
    status: "open" | "answered";
    customer_note: string | null;
    images: string[];
    ai_notes: string | null;
    staff_reply: string | null;
    price_estimate: number | null;
    created_at: string;
    customers: { full_name: string; phone: string } | null;
    barbers: { display_name: string } | null;
    appointments: { starts_at: string } | null;
  };
  const rows = data as unknown as Row[];

  // Tüm görseller için tek çağrıda imzalı adres üret.
  const admin = createAdminClient();
  const allPaths = rows.flatMap((row) => row.images);
  const urlByPath = new Map<string, string>();
  if (admin && allPaths.length > 0) {
    const signed = await admin.storage
      .from("consultations")
      .createSignedUrls(allPaths, SIGNED_URL_SECONDS);
    for (const item of signed.data ?? []) {
      if (item.path && item.signedUrl) urlByPath.set(item.path, item.signedUrl);
    }
  }

  return rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    status: row.status,
    customer_name: row.customers?.full_name ?? "",
    customer_phone: row.customers?.phone ?? "",
    barber_name: row.barbers?.display_name ?? "",
    appointment_starts_at: row.appointments?.starts_at ?? null,
    customer_note: row.customer_note,
    imageUrls: row.images.flatMap((path) => urlByPath.get(path) ?? []),
    ai_notes: row.ai_notes,
    staff_reply: row.staff_reply,
    price_estimate: row.price_estimate === null ? null : Number(row.price_estimate),
    created_at: row.created_at,
  }));
}

export type PanelReview = {
  id: string;
  author_name: string;
  customer_name: string;
  barber_name: string;
  rating: number;
  staff_rating: number | null;
  comment: string | null;
  photoUrls: string[];
  is_approved: boolean;
  is_featured: boolean;
  reply: string | null;
  created_at: string;
};

export async function listReviews(salonId: string): Promise<PanelReview[] | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reviews")
    .select(
      "id, author_name, rating, staff_rating, comment, photos, is_approved, is_featured, reply, created_at, customers (full_name), barbers (display_name)",
    )
    .eq("salon_id", salonId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (isMissingSchema(error)) return null;
  if (error) throw new Error(`reviews: ${error.message}`, { cause: error });

  type Row = {
    id: string;
    author_name: string;
    rating: number;
    staff_rating: number | null;
    comment: string | null;
    photos: string[];
    is_approved: boolean;
    is_featured: boolean;
    reply: string | null;
    created_at: string;
    customers: { full_name: string } | null;
    barbers: { display_name: string } | null;
  };
  return (data as unknown as Row[]).map((row) => ({
    id: row.id,
    author_name: row.author_name,
    customer_name: row.customers?.full_name ?? "",
    barber_name: row.barbers?.display_name ?? "",
    rating: row.rating,
    staff_rating: row.staff_rating,
    comment: row.comment,
    photoUrls: row.photos.map(reviewPhotoUrl),
    is_approved: row.is_approved,
    is_featured: row.is_featured,
    reply: row.reply,
    created_at: row.created_at,
  }));
}
