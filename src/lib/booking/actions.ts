"use server";

import { isIsoTimestamp, isUuid } from "@/lib/panel/validation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

import type { BookingConfirmation, BookingErrorCode, BookingInput, BookingResult } from "./types";

// Online rezervasyon. public.book_appointment anon anahtarla çağrılamaz; misafir
// rezervasyonu burada girdisi doğrulandıktan sonra service role ile yapılır.
// Oturum açmış kullanıcı için kendi oturumu kullanılır (müşteri kaydı hesabına
// bağlanır). Slotun gerçekten boş olduğunu veritabanı fonksiyonu yeniden doğrular.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const E164_RE = /^\+[1-9][0-9]{7,14}$/;
const MAX_SERVICES = 10;

function fail(code: BookingErrorCode, message: string): BookingResult {
  return { ok: false, code, message };
}

/** "0532 123 45 67", "532 123 45 67", "+90 532 ..." -> "+905321234567" */
function normalizePhone(raw: string): string | null {
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, "");

  let phone: string;
  if (trimmed.startsWith("+")) phone = `+${digits}`;
  else if (digits.startsWith("00")) phone = `+${digits.slice(2)}`;
  else if (digits.length === 11 && digits.startsWith("0")) phone = `+90${digits.slice(1)}`;
  else if (digits.length === 10 && digits.startsWith("5")) phone = `+90${digits}`;
  else if (digits.length === 12 && digits.startsWith("90")) phone = `+${digits}`;
  else return null;

  return E164_RE.test(phone) ? phone : null;
}

export async function createBooking(input: BookingInput): Promise<BookingResult> {
  if (typeof input !== "object" || input === null) {
    return fail("INVALID_INPUT", "Geçersiz istek");
  }
  const { salonId, serviceIds, startsAt, barberId, name, phone, email, note, website } = input;

  if (typeof website === "string" && website.length > 0) {
    return fail("INVALID_INPUT", "Geçersiz istek");
  }
  if (!isUuid(salonId)) return fail("INVALID_INPUT", "Geçersiz salon");
  if (
    !Array.isArray(serviceIds) ||
    serviceIds.length === 0 ||
    serviceIds.length > MAX_SERVICES ||
    !serviceIds.every(isUuid)
  ) {
    return fail("INVALID_INPUT", "Lütfen en az bir hizmet seçin");
  }
  if (!isIsoTimestamp(startsAt)) return fail("INVALID_INPUT", "Lütfen bir saat seçin");
  if (barberId !== null && !isUuid(barberId)) return fail("INVALID_INPUT", "Geçersiz personel");

  const cleanName = typeof name === "string" ? name.trim() : "";
  if (cleanName.length < 2 || cleanName.length > 100) {
    return fail("CUSTOMER_INFO_REQUIRED", "Lütfen adınızı ve soyadınızı yazın");
  }
  const cleanPhone = typeof phone === "string" ? normalizePhone(phone) : null;
  if (!cleanPhone) {
    return fail("INVALID_PHONE", "Lütfen geçerli bir cep telefonu numarası yazın");
  }
  const cleanEmail = typeof email === "string" ? email.trim() : "";
  if (cleanEmail && (cleanEmail.length > 254 || !EMAIL_RE.test(cleanEmail))) {
    return fail("INVALID_INPUT", "E-posta adresi geçersiz");
  }
  const cleanNote = typeof note === "string" ? note.trim() : "";
  if (cleanNote.length > 500) {
    return fail("INVALID_INPUT", "Not en fazla 500 karakter olabilir");
  }

  const sessionClient = await createClient();
  const {
    data: { user },
  } = await sessionClient.auth.getUser();

  const supabase = user ? sessionClient : createAdminClient();
  if (!supabase) {
    console.error("createBooking: SUPABASE_SERVICE_ROLE_KEY tanımlı değil");
    return fail(
      "UNAVAILABLE",
      "Online randevu şu anda kullanılamıyor, lütfen salonu arayın",
    );
  }

  const { data, error } = await supabase.rpc("book_appointment", {
    p_salon_id: salonId,
    p_service_ids: serviceIds,
    p_starts_at: startsAt,
    p_barber_id: barberId,
    p_customer_name: cleanName,
    p_customer_phone: cleanPhone,
    p_customer_email: cleanEmail || null,
    p_customer_note: cleanNote || null,
  });

  if (error) {
    // Fonksiyonun bilinçli fırlattığı hatalar: kod "details", mesaj kullanıcıya gösterilebilir.
    if (error.code === "P0001" && error.details) {
      return fail(error.details as BookingErrorCode, error.message);
    }
    console.error("book_appointment failed", error);
    return fail("UNKNOWN", "Randevu oluşturulamadı, lütfen tekrar deneyin");
  }

  // manage_token ve customer_id istemciye gönderilmez.
  const result = data as BookingConfirmation;
  return {
    ok: true,
    data: {
      appointment_id: result.appointment_id,
      status: result.status,
      barber_id: result.barber_id,
      starts_at: result.starts_at,
      ends_at: result.ends_at,
      total_price: result.total_price,
      deposit_amount: result.deposit_amount,
      requires_payment: result.requires_payment,
      hold_expires_at: result.hold_expires_at,
    },
  };
}
