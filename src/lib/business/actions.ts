"use server";

import { refresh, updateTag } from "next/cache";

import { addDays, zonedToIso } from "@/lib/format";
import {
  authorizeSalon,
  dbFailure,
  fail,
  optionalNumber,
  text,
  type FormState,
} from "@/lib/panel/guard";
import type { PanelMembership } from "@/lib/panel/types";
import { isIsoDate, isUuid } from "@/lib/panel/validation";
import { createClient } from "@/lib/supabase/server";

import { VIP_TAG } from "./types";

// İşletme modüllerinin yazma işlemleri. Her işlem oturumu ve rolü sunucuda
// doğrular; yazma yetkisini ayrıca RLS uygular.

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DOMAIN_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;
const FK_VIOLATION = "23503";
const UNIQUE_VIOLATION = "23505";

function done(message = "Kaydedildi"): FormState {
  refresh();
  return { ok: true, message };
}

/** Randevu sayfasını etkileyen değişikliklerde vitrin önbelleğini de tazeler. */
function doneAndRepublish(membership: PanelMembership, message = "Kaydedildi"): FormState {
  updateTag(`salon:${membership.salon_slug}`);
  return done(message);
}

function isMoney(value: number | null): value is number {
  return value !== null && Number.isFinite(value) && value >= 0 && value < 100_000_000;
}

// ---------------------------------------------------------------------------
// Giderler
// ---------------------------------------------------------------------------

export async function addExpense(_prev: FormState, formData: FormData): Promise<FormState> {
  const auth = await authorizeSalon(formData.get("salon_id"), "admin");
  if (auth.error !== undefined) return auth.error;

  const amount = optionalNumber(formData, "amount");
  if (!isMoney(amount) || amount <= 0) return fail("Tutar sıfırdan büyük bir sayı olmalıdır");
  const spentOn = text(formData, "spent_on");
  if (!isIsoDate(spentOn)) return fail("Geçerli bir tarih seçin");
  const description = text(formData, "description");
  if (description.length > 200) return fail("Açıklama en fazla 200 karakter olabilir");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase.from("expenses").insert({
    salon_id: auth.membership.salon_id,
    category: text(formData, "category").slice(0, 60) || "Diğer",
    description: description || null,
    amount,
    spent_on: spentOn,
    created_by: user?.id ?? null,
  });
  if (error) return dbFailure("addExpense", error);
  return done("Gider eklendi");
}

export async function deleteExpense(salonId: string, expenseId: string): Promise<FormState> {
  const auth = await authorizeSalon(salonId, "admin");
  if (auth.error !== undefined) return auth.error;
  if (!isUuid(expenseId)) return fail("Geçersiz kayıt");

  const supabase = await createClient();
  const { error } = await supabase
    .from("expenses")
    .delete()
    .eq("id", expenseId)
    .eq("salon_id", auth.membership.salon_id);
  if (error) return dbFailure("deleteExpense", error);
  return done("Gider silindi");
}

// ---------------------------------------------------------------------------
// Müşteriler
// ---------------------------------------------------------------------------

/** Müşteri kartını günceller: VIP, etiketler, alerji notu ve online randevu engeli. */
export async function saveCustomer(_prev: FormState, formData: FormData): Promise<FormState> {
  const auth = await authorizeSalon(formData.get("salon_id"), "frontdesk");
  if (auth.error !== undefined) return auth.error;
  const customerId = text(formData, "customer_id");
  if (!isUuid(customerId)) return fail("Geçersiz müşteri");

  const tags = [
    ...new Set(
      text(formData, "tags")
        .split(",")
        .map((tag) => tag.trim().slice(0, 30))
        .filter((tag) => tag && tag.toLocaleUpperCase("tr") !== VIP_TAG),
    ),
  ].slice(0, 10);
  if (formData.get("vip") === "on") tags.unshift(VIP_TAG);

  const allergies = text(formData, "allergies");
  if (allergies.length > 500) return fail("Alerji notu en fazla 500 karakter olabilir");

  const supabase = await createClient();
  const { error } = await supabase
    .from("customers")
    .update({
      tags,
      allergies: allergies || null,
      is_blocked: formData.get("is_blocked") === "on",
    })
    .eq("id", customerId)
    .eq("salon_id", auth.membership.salon_id);
  if (error) return dbFailure("saveCustomer", error);
  return done();
}

export async function addCustomerNote(_prev: FormState, formData: FormData): Promise<FormState> {
  const auth = await authorizeSalon(formData.get("salon_id"), "frontdesk");
  if (auth.error !== undefined) return auth.error;
  const customerId = text(formData, "customer_id");
  if (!isUuid(customerId)) return fail("Geçersiz müşteri");
  const note = text(formData, "note");
  if (!note || note.length > 1000) return fail("Not 1-1000 karakter olmalıdır");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase.from("customer_notes").insert({
    salon_id: auth.membership.salon_id,
    customer_id: customerId,
    author_id: user?.id ?? null,
    note,
  });
  if (error) return dbFailure("addCustomerNote", error);
  return done("Not eklendi");
}

// ---------------------------------------------------------------------------
// Stok
// ---------------------------------------------------------------------------

/** Ürün ekler (id yoksa) ya da günceller. Miktar yalnızca stok hareketiyle değişir. */
export async function saveProduct(_prev: FormState, formData: FormData): Promise<FormState> {
  const auth = await authorizeSalon(formData.get("salon_id"), "admin");
  if (auth.error !== undefined) return auth.error;

  const id = text(formData, "id");
  if (id && !isUuid(id)) return fail("Geçersiz ürün");
  const name = text(formData, "name");
  if (!name || name.length > 100) return fail("Ürün adı zorunludur (en fazla 100 karakter)");

  const critical = optionalNumber(formData, "critical_level") ?? 0;
  if (!isMoney(critical)) return fail("Kritik seviye 0 veya daha büyük olmalıdır");
  const purchase = optionalNumber(formData, "purchase_price");
  const sale = optionalNumber(formData, "sale_price");
  if ((purchase !== null && !isMoney(purchase)) || (sale !== null && !isMoney(sale))) {
    return fail("Fiyatlar 0 veya daha büyük olmalıdır");
  }

  const values = {
    name,
    category: text(formData, "category").slice(0, 60) || null,
    unit: text(formData, "unit").slice(0, 20) || "adet",
    critical_level: critical,
    purchase_price: purchase,
    sale_price: sale,
  };

  const supabase = await createClient();
  if (id) {
    const { error } = await supabase
      .from("products")
      .update({ ...values, is_active: formData.get("is_active") === "on" })
      .eq("id", id)
      .eq("salon_id", auth.membership.salon_id);
    if (error) return dbFailure("saveProduct", error);
    return done();
  }

  const quantity = optionalNumber(formData, "quantity") ?? 0;
  if (!isMoney(quantity)) return fail("Başlangıç stoğu 0 veya daha büyük olmalıdır");
  const { error } = await supabase
    .from("products")
    .insert({ ...values, quantity, salon_id: auth.membership.salon_id });
  if (error) return dbFailure("saveProduct", error);
  return done("Ürün eklendi");
}

export async function deleteProduct(salonId: string, productId: string): Promise<FormState> {
  const auth = await authorizeSalon(salonId, "admin");
  if (auth.error !== undefined) return auth.error;
  if (!isUuid(productId)) return fail("Geçersiz ürün");

  const supabase = await createClient();
  const { error } = await supabase
    .from("products")
    .delete()
    .eq("id", productId)
    .eq("salon_id", auth.membership.salon_id);
  if (error) return dbFailure("deleteProduct", error);
  return done("Ürün silindi");
}

const MOVEMENTS: Record<string, 1 | -1> = { purchase: 1, usage: -1, sale: -1 };

/** Stok hareketi: alım (+), kullanım (−), satış (−) ya da sayım düzeltmesi (yeni miktar). */
export async function adjustStock(_prev: FormState, formData: FormData): Promise<FormState> {
  const auth = await authorizeSalon(formData.get("salon_id"), "frontdesk");
  if (auth.error !== undefined) return auth.error;
  const productId = text(formData, "product_id");
  if (!isUuid(productId)) return fail("Geçersiz ürün");

  const reason = text(formData, "reason");
  const amount = optionalNumber(formData, "amount");
  if (!isMoney(amount)) return fail("Miktar 0 veya daha büyük bir sayı olmalıdır");

  let delta: number;
  if (reason === "adjustment") {
    // Sayımda girilen değer yeni stok miktarıdır.
    const current = optionalNumber(formData, "current");
    if (current === null || !Number.isFinite(current)) return fail("Geçersiz stok miktarı");
    delta = amount - current;
    if (delta === 0) return fail("Stok zaten bu miktarda");
  } else if (reason in MOVEMENTS) {
    if (amount === 0) return fail("Miktar sıfırdan büyük olmalıdır");
    delta = MOVEMENTS[reason] * amount;
  } else {
    return fail("Geçersiz hareket türü");
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("adjust_product_stock", {
    p_product_id: productId,
    p_delta: delta,
    p_reason: reason,
    p_note: text(formData, "note").slice(0, 200) || null,
  });
  if (error) return dbFailure("adjustStock", error);
  return done("Stok güncellendi");
}

// ---------------------------------------------------------------------------
// Otomasyon
// ---------------------------------------------------------------------------

export async function saveAutomation(_prev: FormState, formData: FormData): Promise<FormState> {
  const auth = await authorizeSalon(formData.get("salon_id"), "admin");
  if (auth.error !== undefined) return auth.error;

  const channel = text(formData, "notification_channel");
  if (!["whatsapp", "sms"].includes(channel)) return fail("Geçersiz kanal");

  const templates = ["confirmation_template", "reminder_template", "review_template"].map(
    (name) => text(formData, name),
  );
  if (templates.some((template) => template.length > 600)) {
    return fail("Şablonlar en fazla 600 karakter olabilir");
  }
  const reviewUrl = text(formData, "review_url");
  if (reviewUrl && !/^https:\/\/\S+$/.test(reviewUrl)) {
    return fail("Yorum bağlantısı https:// ile başlamalıdır");
  }
  const reviewEnabled = formData.get("review_request_enabled") === "on";
  if (reviewEnabled && !reviewUrl) {
    return fail("Yorum isteği için önce yorum bağlantısını girin");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("salons")
    .update({
      notification_channel: channel,
      reminders_enabled: formData.get("reminders_enabled") === "on",
      confirmation_template: templates[0] || null,
      reminder_template: templates[1] || null,
      review_request_enabled: reviewEnabled,
      review_template: templates[2] || null,
      review_url: reviewUrl || null,
    })
    .eq("id", auth.membership.salon_id);
  if (error) return dbFailure("saveAutomation", error);
  return done();
}

// ---------------------------------------------------------------------------
// Randevu kuralları ve alan adı
// ---------------------------------------------------------------------------

export async function saveBookingRules(_prev: FormState, formData: FormData): Promise<FormState> {
  const auth = await authorizeSalon(formData.get("salon_id"), "admin");
  if (auth.error !== undefined) return auth.error;

  const interval = optionalNumber(formData, "slot_interval_minutes");
  const notice = optionalNumber(formData, "min_booking_notice_minutes");
  const ahead = optionalNumber(formData, "max_booking_days_ahead");
  const isInt = (value: number | null): value is number =>
    value !== null && Number.isInteger(value);

  if (!isInt(interval) || interval < 5 || interval > 120) {
    return fail("Randevu aralığı 5-120 dakika arasında olmalıdır");
  }
  if (!isInt(notice) || notice < 0 || notice > 7 * 24 * 60) {
    return fail("En erken randevu süresi 0 dakika ile 7 gün arasında olmalıdır");
  }
  if (!isInt(ahead) || ahead < 1 || ahead > 365) {
    return fail("İleri tarih sınırı 1-365 gün arasında olmalıdır");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("salons")
    .update({
      slot_interval_minutes: interval,
      min_booking_notice_minutes: notice,
      max_booking_days_ahead: ahead,
    })
    .eq("id", auth.membership.salon_id);
  if (error) return dbFailure("saveBookingRules", error);
  return doneAndRepublish(auth.membership);
}

/**
 * Salonun alan adı talebini kaydeder (boş = kaldır). Durum veritabanı
 * tetikleyicisiyle 'pending' olur; alan adı süper yönetici onaylayınca yayına girer.
 */
export async function saveCustomDomain(_prev: FormState, formData: FormData): Promise<FormState> {
  const auth = await authorizeSalon(formData.get("salon_id"), "admin");
  if (auth.error !== undefined) return auth.error;

  const domain = text(formData, "custom_domain")
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "");
  if (domain && (domain.length > 253 || !DOMAIN_RE.test(domain))) {
    return fail("Alan adını randevu.salonunuz.com biçiminde yazın");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("salons")
    .update({ custom_domain: domain || null })
    .eq("id", auth.membership.salon_id)
    .select("custom_domain_status")
    .maybeSingle();
  if (error) {
    if (error.code === UNIQUE_VIOLATION) return fail("Bu alan adı başka bir salonda kayıtlı");
    return dbFailure("saveCustomDomain", error);
  }
  if (!domain) return done("Alan adı kaldırıldı");
  // Aynı alan adı yeniden kaydedildiyse mevcut onay korunur.
  return done(
    (data as { custom_domain_status: string | null } | null)?.custom_domain_status === "active"
      ? "Alan adınız zaten onaylı ve aktif"
      : "Domain bağlantı talebi alındı – onay bekliyor",
  );
}

// ---------------------------------------------------------------------------
// Mola ve izin
// ---------------------------------------------------------------------------

/**
 * Personelin günlük molasını kaydeder: işaretliyse çalıştığı her güne aynı
 * mola yazılır, değilse molaları silinir.
 */
export async function saveBreak(_prev: FormState, formData: FormData): Promise<FormState> {
  const auth = await authorizeSalon(formData.get("salon_id"), "admin");
  if (auth.error !== undefined) return auth.error;
  const { membership } = auth;
  const barberId = text(formData, "barber_id");
  if (!isUuid(barberId)) return fail("Geçersiz personel");

  const enabled = formData.get("break_on") === "on";
  const start = text(formData, "break_start");
  const end = text(formData, "break_end");
  if (enabled && (!TIME_RE.test(start) || !TIME_RE.test(end) || start >= end)) {
    return fail("Mola bitişi başlangıçtan sonra olmalıdır");
  }

  const supabase = await createClient();
  const removal = await supabase
    .from("working_hour_breaks")
    .delete()
    .eq("barber_id", barberId)
    .eq("salon_id", membership.salon_id);
  if (removal.error) return dbFailure("saveBreak", removal.error);
  if (!enabled) return doneAndRepublish(membership, "Mola kaldırıldı");

  const hours = await supabase
    .from("working_hours")
    .select("day_of_week")
    .eq("barber_id", barberId)
    .eq("salon_id", membership.salon_id);
  if (hours.error) return dbFailure("saveBreak", hours.error);
  if (hours.data.length === 0) return fail("Önce çalışma saatlerini kaydedin");

  const { error } = await supabase.from("working_hour_breaks").insert(
    hours.data.map((row) => ({
      salon_id: membership.salon_id,
      barber_id: barberId,
      day_of_week: row.day_of_week,
      start_time: start,
      end_time: end,
      label: "Mola",
    })),
  );
  if (error) return dbFailure("saveBreak", error);
  return doneAndRepublish(membership, `Mola ${hours.data.length} çalışma gününe yazıldı`);
}

/** İzin / kapalı gün ekler. barber_id boşsa tüm salon kapalıdır. İki tarih de dahildir. */
export async function addTimeOff(_prev: FormState, formData: FormData): Promise<FormState> {
  const auth = await authorizeSalon(formData.get("salon_id"), "admin");
  if (auth.error !== undefined) return auth.error;
  const { membership } = auth;

  const barberId = text(formData, "barber_id");
  if (barberId && !isUuid(barberId)) return fail("Geçersiz personel");
  const from = text(formData, "from");
  const to = text(formData, "to") || from;
  if (!isIsoDate(from) || !isIsoDate(to) || from > to) {
    return fail("Geçerli bir tarih aralığı seçin");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("time_off").insert({
    salon_id: membership.salon_id,
    barber_id: barberId || null,
    starts_at: zonedToIso(from, 0, membership.timezone),
    ends_at: zonedToIso(addDays(to, 1), 0, membership.timezone),
    reason: text(formData, "reason").slice(0, 100) || null,
  });
  if (error) {
    if (error.code === FK_VIOLATION) return fail("Geçersiz personel");
    return dbFailure("addTimeOff", error);
  }
  return done("İzin eklendi");
}

export async function deleteTimeOff(salonId: string, timeOffId: string): Promise<FormState> {
  const auth = await authorizeSalon(salonId, "admin");
  if (auth.error !== undefined) return auth.error;
  if (!isUuid(timeOffId)) return fail("Geçersiz kayıt");

  const supabase = await createClient();
  const { error } = await supabase
    .from("time_off")
    .delete()
    .eq("id", timeOffId)
    .eq("salon_id", auth.membership.salon_id);
  if (error) return dbFailure("deleteTimeOff", error);
  return done("İzin silindi");
}
