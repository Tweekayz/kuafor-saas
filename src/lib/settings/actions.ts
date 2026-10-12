"use server";

import { refresh, updateTag } from "next/cache";
import { redirect } from "next/navigation";

import { getPanelContext } from "@/lib/panel/queries";
import type { PanelMembership } from "@/lib/panel/types";
import { isUuid } from "@/lib/panel/validation";
import { createClient } from "@/lib/supabase/server";

import type { FormState } from "./types";

// Salon kurulum/ayar işlemleri. Her işlem oturumu ve yönetici rolünü sunucuda
// doğrular; yazma yetkisini ayrıca RLS (private.is_salon_admin) uygular. Bileşik
// yabancı anahtarlar başka salonun personeline/hizmetine yazmayı engeller.

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const FK_VIOLATION = "23503";
const UNIQUE_VIOLATION = "23505";

function fail(message: string): FormState {
  return { ok: false, message };
}

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

/** Boş -> null, geçersiz -> NaN. Ondalık ayırıcı olarak virgül de kabul edilir. */
function optionalNumber(formData: FormData, name: string): number | null {
  const value = text(formData, name);
  return value === "" ? null : Number(value.replace(",", "."));
}

function isDuration(value: number | null): value is number {
  return value !== null && Number.isInteger(value) && value >= 5 && value <= 600;
}

function isPrice(value: number | null): value is number {
  return value !== null && Number.isFinite(value) && value >= 0 && value < 100_000_000;
}

function slugify(value: string): string {
  const turkish: Record<string, string> = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u" };
  return value
    .toLocaleLowerCase("tr")
    .replace(/[çğıöşü]/g, (char) => turkish[char])
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function authorize(
  salonId: unknown,
): Promise<{ membership: PanelMembership; error?: undefined } | { error: FormState }> {
  if (!isUuid(salonId)) return { error: fail("Geçersiz salon") };
  const context = await getPanelContext();
  if (!context) return { error: fail("Oturum açmanız gerekiyor") };
  const membership = context.memberships.find(
    (m) => m.salon_id === salonId && (m.role === "owner" || m.role === "manager"),
  );
  if (!membership) return { error: fail("Bu işlem için yetkiniz yok") };
  return { membership };
}

/** Vitrin önbelleğini (randevu sayfası) ve açık sayfayı tazeler. */
function saved(membership: PanelMembership, message = "Kaydedildi"): FormState {
  updateTag(`salon:${membership.salon_slug}`);
  refresh();
  return { ok: true, message };
}

function unexpected(scope: string, error: unknown): FormState {
  console.error(`${scope} failed`, error);
  return fail("Kaydedilemedi, lütfen tekrar deneyin");
}

// ---------------------------------------------------------------------------
// Salon
// ---------------------------------------------------------------------------

export async function createSalon(_prev: FormState, formData: FormData): Promise<FormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Oturum açmanız gerekiyor");

  const name = text(formData, "name");
  if (name.length < 2 || name.length > 100) return fail("Salon adı 2-100 karakter olmalıdır");

  const slug = slugify(text(formData, "slug") || name);
  if (slug.length < 3 || slug.length > 60 || !SLUG_RE.test(slug)) {
    return fail("Randevu adresi en az 3 karakter olmalı; harf, rakam ve tire içerebilir");
  }

  const { error } = await supabase.from("salons").insert({
    owner_id: user.id,
    name,
    slug,
    phone: text(formData, "phone") || null,
    city: text(formData, "city") || null,
    address: text(formData, "address") || null,
  });
  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      return fail("Bu randevu adresi kullanılıyor, lütfen başka bir adres yazın");
    }
    return unexpected("createSalon", error);
  }

  // Kurulumun sıradaki adımı: hizmetleri tanımlamak.
  redirect(`/panel/hizmetler?salon=${slug}`);
}

/**
 * Salon adı, iletişim bilgileri ve randevu adresini (slug) günceller. Slug
 * değişirse eski /randevu/<slug> bağlantısı çalışmaz; panel yeni adrese taşınır.
 */
export async function updateSalon(_prev: FormState, formData: FormData): Promise<FormState> {
  const auth = await authorize(formData.get("salon_id"));
  if (auth.error !== undefined) return auth.error;
  const { membership } = auth;

  const name = text(formData, "name");
  if (name.length < 2 || name.length > 100) return fail("Salon adı 2-100 karakter olmalıdır");

  const slug = slugify(text(formData, "slug"));
  if (slug.length < 3 || slug.length > 60 || !SLUG_RE.test(slug)) {
    return fail("Randevu adresi en az 3 karakter olmalı; harf, rakam ve tire içerebilir");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("salons")
    .update({
      name,
      slug,
      phone: text(formData, "phone") || null,
      city: text(formData, "city") || null,
      address: text(formData, "address") || null,
    })
    .eq("id", membership.salon_id);
  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      return fail("Bu randevu adresi kullanılıyor, lütfen başka bir adres yazın");
    }
    return unexpected("updateSalon", error);
  }

  if (slug !== membership.salon_slug) {
    updateTag(`salon:${membership.salon_slug}`);
    updateTag(`salon:${slug}`);
    redirect(`/panel/ayarlar?salon=${slug}`);
  }
  return saved(membership);
}

// ---------------------------------------------------------------------------
// Hizmetler
// ---------------------------------------------------------------------------

/** Hizmet ekler (id yoksa) ya da günceller. */
export async function saveService(_prev: FormState, formData: FormData): Promise<FormState> {
  const auth = await authorize(formData.get("salon_id"));
  if (auth.error !== undefined) return auth.error;
  const { membership } = auth;

  const id = text(formData, "id");
  if (id && !isUuid(id)) return fail("Geçersiz hizmet");

  const name = text(formData, "name");
  if (!name || name.length > 100) return fail("Hizmet adı zorunludur (en fazla 100 karakter)");
  const duration = optionalNumber(formData, "duration");
  if (!isDuration(duration)) return fail("Süre 5-600 dakika arasında tam sayı olmalıdır");
  const price = optionalNumber(formData, "price");
  if (!isPrice(price)) return fail("Fiyat 0 veya daha büyük bir sayı olmalıdır");

  const values = {
    name,
    category: text(formData, "category") || null,
    duration_minutes: duration,
    price,
  };

  const supabase = await createClient();
  const { error } = id
    ? await supabase
        .from("services")
        .update({ ...values, is_active: formData.get("is_active") === "on" })
        .eq("id", id)
        .eq("salon_id", membership.salon_id)
    : await supabase.from("services").insert({ ...values, salon_id: membership.salon_id });
  if (error) return unexpected("saveService", error);

  return saved(membership, id ? "Kaydedildi" : "Hizmet eklendi");
}

export async function deleteService(salonId: string, serviceId: string): Promise<FormState> {
  const auth = await authorize(salonId);
  if (auth.error !== undefined) return auth.error;
  if (!isUuid(serviceId)) return fail("Geçersiz hizmet");

  const supabase = await createClient();
  const { error } = await supabase
    .from("services")
    .delete()
    .eq("id", serviceId)
    .eq("salon_id", auth.membership.salon_id);
  if (error) {
    if (error.code === FK_VIOLATION) {
      return fail("Bu hizmetle alınmış randevular var; silmek yerine pasife alın");
    }
    return unexpected("deleteService", error);
  }
  return saved(auth.membership, "Hizmet silindi");
}

// ---------------------------------------------------------------------------
// Personel
// ---------------------------------------------------------------------------

/** Personel ekler (id yoksa) ya da günceller; varsayılan prim oranını da yazar. */
export async function saveBarber(_prev: FormState, formData: FormData): Promise<FormState> {
  const auth = await authorize(formData.get("salon_id"));
  if (auth.error !== undefined) return auth.error;
  const { membership } = auth;

  const id = text(formData, "id");
  if (id && !isUuid(id)) return fail("Geçersiz personel");

  const displayName = text(formData, "display_name");
  if (!displayName || displayName.length > 100) {
    return fail("Personel adı zorunludur (en fazla 100 karakter)");
  }
  const rate = optionalNumber(formData, "commission_rate");
  if (rate !== null && !(rate >= 0 && rate <= 100)) {
    return fail("Prim oranı 0-100 arasında olmalıdır");
  }

  const values = { display_name: displayName, title: text(formData, "title") || null };
  const supabase = await createClient();

  if (!id) {
    const { error } = await supabase
      .from("barbers")
      .insert({ ...values, salon_id: membership.salon_id });
    if (error) return unexpected("saveBarber", error);
    return saved(membership, "Personel eklendi");
  }

  const { error } = await supabase
    .from("barbers")
    .update({ ...values, is_active: formData.get("is_active") === "on" })
    .eq("id", id)
    .eq("salon_id", membership.salon_id);
  if (error) return unexpected("saveBarber", error);

  // Varsayılan prim kuralı (service_id NULL): boş bırakılırsa kural kaldırılır.
  const rule = supabase
    .from("barber_commission_rules")
    .delete()
    .eq("barber_id", id)
    .eq("salon_id", membership.salon_id)
    .is("service_id", null);
  const { error: ruleError } = await rule;
  if (ruleError) return unexpected("saveBarber(commission)", ruleError);
  if (rate !== null) {
    const { error: insertError } = await supabase
      .from("barber_commission_rules")
      .insert({ salon_id: membership.salon_id, barber_id: id, service_id: null, rate });
    if (insertError) return unexpected("saveBarber(commission)", insertError);
  }

  return saved(membership);
}

export async function deleteBarber(salonId: string, barberId: string): Promise<FormState> {
  const auth = await authorize(salonId);
  if (auth.error !== undefined) return auth.error;
  if (!isUuid(barberId)) return fail("Geçersiz personel");

  const supabase = await createClient();
  const { error } = await supabase
    .from("barbers")
    .delete()
    .eq("id", barberId)
    .eq("salon_id", auth.membership.salon_id);
  if (error) {
    if (error.code === FK_VIOLATION) {
      return fail("Bu personelin randevu geçmişi var; silmek yerine pasife alın");
    }
    return unexpected("deleteBarber", error);
  }
  return saved(auth.membership, "Personel silindi");
}

/**
 * Personelin verdiği hizmetleri formdaki seçimle eşitler. Alanlar:
 * "service" (seçili hizmet id'leri), "duration:<id>" ve "price:<id>" (isteğe
 * bağlı kişiye özel süre/fiyat; boş = hizmetin standart değeri).
 */
export async function saveBarberServices(_prev: FormState, formData: FormData): Promise<FormState> {
  const auth = await authorize(formData.get("salon_id"));
  if (auth.error !== undefined) return auth.error;
  const { membership } = auth;

  const barberId = text(formData, "barber_id");
  if (!isUuid(barberId)) return fail("Geçersiz personel");

  const serviceIds = [...new Set(formData.getAll("service"))];
  if (!serviceIds.every(isUuid)) return fail("Geçersiz hizmet");

  const rows = [];
  for (const serviceId of serviceIds) {
    const duration = optionalNumber(formData, `duration:${serviceId}`);
    if (duration !== null && !isDuration(duration)) {
      return fail("Özel süre 5-600 dakika arasında tam sayı olmalıdır");
    }
    const price = optionalNumber(formData, `price:${serviceId}`);
    if (price !== null && !isPrice(price)) {
      return fail("Özel fiyat 0 veya daha büyük bir sayı olmalıdır");
    }
    rows.push({
      salon_id: membership.salon_id,
      barber_id: barberId,
      service_id: serviceId,
      duration_override: duration,
      price_override: price,
    });
  }

  const supabase = await createClient();

  let removal = supabase
    .from("barber_services")
    .delete()
    .eq("barber_id", barberId)
    .eq("salon_id", membership.salon_id);
  if (serviceIds.length > 0) {
    removal = removal.not("service_id", "in", `(${serviceIds.join(",")})`);
  }
  const { error: removeError } = await removal;
  if (removeError) return unexpected("saveBarberServices", removeError);

  if (rows.length > 0) {
    const { error } = await supabase
      .from("barber_services")
      .upsert(rows, { onConflict: "barber_id,service_id" });
    if (error) return unexpected("saveBarberServices", error);
  }

  return saved(
    membership,
    rows.length > 0
      ? `${rows.length} hizmet kaydedildi`
      : "Kaydedildi. Hizmet seçilmediği için bu personel randevu alamaz",
  );
}

/**
 * Personelin haftalık mesaisini formla eşitler. Her gün (0 = Pazar) için
 * alanlar: "on:<gün>", "start:<gün>", "end:<gün>". İşaretli olmayan günün
 * satırı silinir (o gün çalışmıyor).
 */
export async function saveWorkingHours(_prev: FormState, formData: FormData): Promise<FormState> {
  const auth = await authorize(formData.get("salon_id"));
  if (auth.error !== undefined) return auth.error;
  const { membership } = auth;

  const barberId = text(formData, "barber_id");
  if (!isUuid(barberId)) return fail("Geçersiz personel");

  const rows = [];
  const daysOff: number[] = [];
  for (let day = 0; day <= 6; day++) {
    if (formData.get(`on:${day}`) !== "on") {
      daysOff.push(day);
      continue;
    }
    const start = text(formData, `start:${day}`);
    const end = text(formData, `end:${day}`);
    if (!TIME_RE.test(start) || !TIME_RE.test(end)) {
      return fail("Çalışılan günler için başlangıç ve bitiş saati zorunludur");
    }
    if (start >= end) return fail("Bitiş saati başlangıçtan sonra olmalıdır");
    rows.push({
      salon_id: membership.salon_id,
      barber_id: barberId,
      day_of_week: day,
      start_time: start,
      end_time: end,
    });
  }

  const supabase = await createClient();

  if (daysOff.length > 0) {
    const { error } = await supabase
      .from("working_hours")
      .delete()
      .eq("barber_id", barberId)
      .eq("salon_id", membership.salon_id)
      .in("day_of_week", daysOff);
    if (error) return unexpected("saveWorkingHours", error);
  }
  if (rows.length > 0) {
    const { error } = await supabase
      .from("working_hours")
      .upsert(rows, { onConflict: "barber_id,day_of_week" });
    if (error) return unexpected("saveWorkingHours", error);
  }

  return saved(
    membership,
    rows.length > 0
      ? `Haftada ${rows.length} gün kaydedildi`
      : "Kaydedildi. Çalışma günü seçilmediği için bu personel randevu alamaz",
  );
}
