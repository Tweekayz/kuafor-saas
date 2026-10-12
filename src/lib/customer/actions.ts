"use server";

import { randomUUID } from "node:crypto";

import { refresh, updateTag } from "next/cache";

import { generateStyleAdvice, isAiConfigured, type StyleImage } from "@/lib/ai/style-advice";
import { isMissingSchema } from "@/lib/panel/guard";
import { createAdminClient } from "@/lib/supabase/admin";

import {
  CONSULTATION_COLUMNS,
  findAppointmentByToken,
  toConsultation,
  type AdminClient,
  type TokenAppointment,
} from "./queries";
import {
  MAX_CONSULTATIONS_PER_APPOINTMENT,
  MAX_IMAGES_PER_REQUEST,
  MAX_REVIEW_PHOTOS,
  type ConsultationKind,
  type ConsultationResult,
  type ReviewResult,
  type UploadTargetsResult,
} from "./types";

// Müşterinin (hesapsız) yaptığı işlemler: görsel yükleme izni, danışma talebi,
// değerlendirme. Yetki, randevunun gizli bağlantısıdır; her işlem bağlantıyı
// yeniden doğrular ve yalnızca o randevunun klasörüne / kayıtlarına dokunur.

type Bucket = "consultations" | "reviews";

/** Bir randevu için kovada tutulabilecek en fazla dosya (kötüye kullanım sınırı). */
const MAX_FILES_PER_APPOINTMENT: Record<Bucket, number> = {
  consultations: MAX_CONSULTATIONS_PER_APPOINTMENT * MAX_IMAGES_PER_REQUEST,
  reviews: MAX_REVIEW_PHOTOS,
};

const UNAVAILABLE = "Bu özellik şu anda kullanılamıyor";
const UNIQUE_VIOLATION = "23505";

async function resolve(
  token: unknown,
): Promise<{ admin: AdminClient; appointment: TokenAppointment } | { message: string }> {
  const admin = createAdminClient();
  if (!admin) {
    console.error("customer action: SUPABASE_SERVICE_ROLE_KEY tanımlı değil");
    return { message: UNAVAILABLE };
  }
  const appointment = await findAppointmentByToken(admin, token);
  if (!appointment) return { message: "Randevu bağlantısı geçersiz" };
  return { admin, appointment };
}

function folder(appointment: TokenAppointment): string {
  return `${appointment.salon_id}/${appointment.id}`;
}

/** Yollar bu randevunun klasöründe ve sunucunun ürettiği biçimde mi? */
function ownPaths(appointment: TokenAppointment, paths: unknown, max: number): string[] | null {
  if (!Array.isArray(paths) || paths.length > max) return null;
  const pattern = new RegExp(`^${folder(appointment)}/[0-9a-f-]{36}\\.jpg$`);
  return paths.every((path) => typeof path === "string" && pattern.test(path))
    ? [...new Set(paths as string[])]
    : null;
}

/**
 * Tarayıcının dosyaları doğrudan depoya yükleyebilmesi için tek kullanımlık
 * imzalı yükleme izinleri üretir. Boyut ve dosya türü sınırını kova uygular
 * (5 MB, JPEG/PNG/WebP); istemci görselleri yüklemeden önce JPEG'e küçültür.
 */
export async function createUploadTargets(
  token: string,
  bucket: Bucket,
  count: number,
): Promise<UploadTargetsResult> {
  if (bucket !== "consultations" && bucket !== "reviews") {
    return { ok: false, message: "Geçersiz istek" };
  }
  if (!Number.isInteger(count) || count < 1 || count > MAX_IMAGES_PER_REQUEST) {
    return { ok: false, message: `En fazla ${MAX_IMAGES_PER_REQUEST} görsel yükleyebilirsiniz` };
  }

  const resolved = await resolve(token);
  if ("message" in resolved) return { ok: false, message: resolved.message };
  const { admin, appointment } = resolved;

  if (bucket === "reviews" && appointment.status !== "completed") {
    return { ok: false, message: "Değerlendirme yalnızca tamamlanan randevular için yapılabilir" };
  }
  if (
    bucket === "consultations" &&
    (appointment.status === "cancelled" || appointment.status === "no_show")
  ) {
    return { ok: false, message: "Bu randevu için görsel yüklenemez" };
  }

  const existing = await admin.storage.from(bucket).list(folder(appointment), { limit: 100 });
  if (existing.error) {
    console.error("createUploadTargets: list failed", existing.error.message);
    return { ok: false, message: UNAVAILABLE };
  }
  if (existing.data.length + count > MAX_FILES_PER_APPOINTMENT[bucket]) {
    return { ok: false, message: "Bu randevu için görsel yükleme sınırına ulaşıldı" };
  }

  const targets = [];
  for (let i = 0; i < count; i++) {
    const path = `${folder(appointment)}/${randomUUID()}.jpg`;
    const signed = await admin.storage.from(bucket).createSignedUploadUrl(path);
    if (signed.error || !signed.data) {
      console.error("createUploadTargets: sign failed", signed.error?.message);
      return { ok: false, message: UNAVAILABLE };
    }
    targets.push({ path, token: signed.data.token });
  }
  return { ok: true, targets };
}

/**
 * Görsel danışma talebi oluşturur. kind 'ai' ise fotoğraflar yapay zekâ ile
 * analiz edilir (müşterinin açık onayı şarttır, randevu başına bir kez);
 * 'staff' ise talep personelin paneline düşer.
 */
export async function submitConsultation(
  token: string,
  input: { kind: ConsultationKind; note: string; paths: string[]; aiConsent: boolean },
): Promise<ConsultationResult> {
  const resolved = await resolve(token);
  if ("message" in resolved) return { ok: false, message: resolved.message };
  const { admin, appointment } = resolved;

  if (typeof input !== "object" || input === null) return { ok: false, message: "Geçersiz istek" };
  const kind = input.kind;
  if (kind !== "ai" && kind !== "staff") return { ok: false, message: "Geçersiz istek" };
  if (appointment.status === "cancelled" || appointment.status === "no_show") {
    return { ok: false, message: "Bu randevu için talep oluşturulamaz" };
  }

  const note = typeof input.note === "string" ? input.note.trim() : "";
  if (note.length > 1000) return { ok: false, message: "Not en fazla 1000 karakter olabilir" };
  const paths = ownPaths(appointment, input.paths, MAX_IMAGES_PER_REQUEST);
  if (!paths) return { ok: false, message: "Görseller doğrulanamadı, lütfen yeniden yükleyin" };
  if (paths.length === 0) return { ok: false, message: "Lütfen en az bir görsel yükleyin" };

  const previous = await admin
    .from("consultation_requests")
    .select("kind")
    .eq("appointment_id", appointment.id);
  if (previous.error) {
    if (!isMissingSchema(previous.error)) console.error("submitConsultation", previous.error);
    return { ok: false, message: UNAVAILABLE };
  }
  if (previous.data.length >= MAX_CONSULTATIONS_PER_APPOINTMENT) {
    return { ok: false, message: "Bu randevu için talep sınırına ulaşıldı" };
  }

  // Yapay zekâ analizi: önce görselleri indir ki talep, analiz edilemeyecek
  // bir dosyayla kaydedilmesin.
  let aiNotes: string | null = null;
  if (kind === "ai") {
    if (!isAiConfigured()) return { ok: false, message: "Yapay zekâ önerisi şu anda kullanılamıyor" };
    if (input.aiConsent !== true) {
      return { ok: false, message: "Yapay zekâ analizi için onay vermeniz gerekiyor" };
    }
    if (previous.data.some((row) => row.kind === "ai")) {
      return { ok: false, message: "Bu randevu için yapay zekâ önerisi daha önce alındı" };
    }

    const images: StyleImage[] = [];
    for (const path of paths) {
      const file = await admin.storage.from("consultations").download(path);
      if (file.error || !file.data) {
        return { ok: false, message: "Görsel bulunamadı, lütfen yeniden yükleyin" };
      }
      images.push({
        data: Buffer.from(await file.data.arrayBuffer()).toString("base64"),
        mediaType: "image/jpeg",
      });
    }

    const [salon, services] = await Promise.all([
      admin.from("salons").select("name").eq("id", appointment.salon_id).single(),
      admin.from("services").select("name").eq("salon_id", appointment.salon_id).eq("is_active", true),
    ]);
    const advice = await generateStyleAdvice({
      images,
      note: note || null,
      salonName: salon.data?.name ?? "",
      services: (services.data ?? []).map((service) => service.name as string),
    });
    if (!advice.ok) return { ok: false, message: advice.message };
    aiNotes = advice.text;
  }

  const { data, error } = await admin
    .from("consultation_requests")
    .insert({
      salon_id: appointment.salon_id,
      appointment_id: appointment.id,
      customer_id: appointment.customer_id,
      barber_id: appointment.barber_id,
      kind,
      customer_note: note || null,
      images: paths,
      ai_notes: aiNotes,
      status: kind === "ai" ? "answered" : "open",
    })
    .select(CONSULTATION_COLUMNS)
    .single();
  if (error) {
    console.error("submitConsultation: insert failed", error);
    return { ok: false, message: "Talep kaydedilemedi, lütfen tekrar deneyin" };
  }

  refresh();
  return { ok: true, consultation: await toConsultation(admin, data) };
}

/** "Ayşe Yılmaz" -> "Ayşe Y." (vitrinde tam ad gösterilmez). */
function displayName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Müşteri";
  const last = parts.length > 1 ? ` ${parts[parts.length - 1].charAt(0).toLocaleUpperCase("tr")}.` : "";
  return `${parts[0]}${last}`;
}

/** Tamamlanan randevu için değerlendirme kaydeder (randevu başına bir kez). */
export async function submitReview(
  token: string,
  input: { rating: number; staffRating: number | null; comment: string; paths: string[] },
): Promise<ReviewResult> {
  const resolved = await resolve(token);
  if ("message" in resolved) return { ok: false, message: resolved.message };
  const { admin, appointment } = resolved;

  if (typeof input !== "object" || input === null) return { ok: false, message: "Geçersiz istek" };
  if (appointment.status !== "completed") {
    return { ok: false, message: "Değerlendirme yalnızca tamamlanan randevular için yapılabilir" };
  }

  const isStars = (value: unknown): value is number =>
    typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 5;
  if (!isStars(input.rating)) return { ok: false, message: "Lütfen 1-5 arasında bir puan seçin" };
  if (input.staffRating !== null && !isStars(input.staffRating)) {
    return { ok: false, message: "Personel puanı 1-5 arasında olmalıdır" };
  }
  const comment = typeof input.comment === "string" ? input.comment.trim() : "";
  if (comment.length > 1000) return { ok: false, message: "Yorum en fazla 1000 karakter olabilir" };
  const paths = ownPaths(appointment, input.paths, MAX_REVIEW_PHOTOS);
  if (!paths) return { ok: false, message: "Fotoğraflar doğrulanamadı, lütfen yeniden yükleyin" };

  const customer = await admin
    .from("customers")
    .select("full_name")
    .eq("id", appointment.customer_id)
    .maybeSingle();

  const { error } = await admin.from("reviews").insert({
    salon_id: appointment.salon_id,
    appointment_id: appointment.id,
    customer_id: appointment.customer_id,
    barber_id: appointment.barber_id,
    author_name: displayName(customer.data?.full_name ?? ""),
    rating: input.rating,
    staff_rating: input.staffRating,
    comment: comment || null,
    photos: paths,
  });
  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      return { ok: false, message: "Bu randevu için daha önce değerlendirme yapılmış" };
    }
    if (!isMissingSchema(error)) console.error("submitReview: insert failed", error);
    return { ok: false, message: UNAVAILABLE };
  }

  // Ortalama puan vitrinde hemen güncellensin.
  updateTag(`reviews:${appointment.salon_id}`);
  refresh();
  return { ok: true };
}
