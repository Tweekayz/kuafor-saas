"use server";

import { refresh, updateTag } from "next/cache";

import {
  authorizeSalon,
  dbFailure,
  fail,
  optionalNumber,
  text,
  type FormState,
} from "@/lib/panel/guard";
import { isUuid } from "@/lib/panel/validation";
import { createClient } from "@/lib/supabase/server";

// Panelden görsel taleplerine yanıt ve yorum yönetimi. Yazma yetkisini RLS
// (kimin hangi satırı) ve sütun yetkileri (yalnızca yanıt alanları) uygular.

/** Personelin görsel talebine yanıtı ve isteğe bağlı fiyat tahmini. */
export async function replyConsultation(_prev: FormState, formData: FormData): Promise<FormState> {
  const auth = await authorizeSalon(formData.get("salon_id"), "member");
  if (auth.error !== undefined) return auth.error;
  const id = text(formData, "consultation_id");
  if (!isUuid(id)) return fail("Geçersiz talep");

  const reply = text(formData, "staff_reply");
  if (!reply || reply.length > 1500) return fail("Yanıt 1-1500 karakter olmalıdır");
  const estimate = optionalNumber(formData, "price_estimate");
  if (estimate !== null && !(estimate >= 0 && estimate < 100_000_000)) {
    return fail("Fiyat tahmini 0 veya daha büyük bir sayı olmalıdır");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("consultation_requests")
    .update({
      staff_reply: reply,
      price_estimate: estimate,
      status: "answered",
      replied_by: user?.id ?? null,
      replied_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("salon_id", auth.membership.salon_id)
    .select("id")
    .maybeSingle();
  if (error) return dbFailure("replyConsultation", error);
  // RLS satırı göstermediyse (başka personelin talebi) güncelleme boş döner.
  if (!data) return fail("Bu talebi yanıtlama yetkiniz yok");

  refresh();
  return { ok: true, message: "Yanıt kaydedildi; müşteri randevu sayfasında görecek" };
}

/** Yorumu vitrinde yayınlar / kaldırır, öne çıkarır ve salon yanıtını kaydeder. */
export async function moderateReview(_prev: FormState, formData: FormData): Promise<FormState> {
  const auth = await authorizeSalon(formData.get("salon_id"), "admin");
  if (auth.error !== undefined) return auth.error;
  const id = text(formData, "review_id");
  if (!isUuid(id)) return fail("Geçersiz yorum");

  const reply = text(formData, "reply");
  if (reply.length > 1000) return fail("Yanıt en fazla 1000 karakter olabilir");
  const approved = formData.get("is_approved") === "on";

  const supabase = await createClient();
  const current = await supabase.from("reviews").select("reply").eq("id", id).maybeSingle();
  if (current.error) return dbFailure("moderateReview", current.error);
  if (!current.data) return fail("Yorum bulunamadı");

  const { error } = await supabase
    .from("reviews")
    .update({
      is_approved: approved,
      // Yayında olmayan yorum öne çıkarılamaz.
      is_featured: approved && formData.get("is_featured") === "on",
      reply: reply || null,
      ...(reply !== (current.data.reply ?? "")
        ? { replied_at: reply ? new Date().toISOString() : null }
        : {}),
    })
    .eq("id", id)
    .eq("salon_id", auth.membership.salon_id);
  if (error) return dbFailure("moderateReview", error);

  updateTag(`reviews:${auth.membership.salon_id}`);
  refresh();
  return { ok: true, message: approved ? "Kaydedildi; yorum vitrinde yayında" : "Kaydedildi" };
}
