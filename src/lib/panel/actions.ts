"use server";

import { refresh } from "next/cache";

import { createClient } from "@/lib/supabase/server";

import type {
  ActionResult,
  AppointmentStatusChange,
  EarningsPayout,
  PanelErrorCode,
  RescheduledAppointment,
  SettableAppointmentStatus,
} from "./types";
import { isIsoDate, isIsoTimestamp, isUuid } from "./validation";

// Panel işlemleri. Server Action'lar doğrudan POST ile de çağrılabildiği için
// her biri girdiyi doğrular ve oturumu kontrol eder; asıl yetki kontrolü
// (rol, randevunun sahibi, izinli durum geçişleri) veritabanı fonksiyonundadır.

const SETTABLE_STATUSES: readonly SettableAppointmentStatus[] = [
  "confirmed",
  "completed",
  "cancelled",
  "no_show",
];

function invalid(message: string): ActionResult<never> {
  return { ok: false, code: "INVALID_INPUT", message };
}

async function mutate<T>(fn: string, args: Record<string, unknown>): Promise<ActionResult<T>> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, code: "UNAUTHENTICATED", message: "Oturum açmanız gerekiyor" };
  }

  const { data, error } = await supabase.rpc(fn, args);
  if (error) {
    // Fonksiyonların bilinçli fırlattığı hatalar: kod "details", mesaj kullanıcıya gösterilebilir.
    if (error.code === "P0001" && error.details) {
      return { ok: false, code: error.details as PanelErrorCode, message: error.message };
    }
    console.error(`${fn} failed`, error);
    return {
      ok: false,
      code: "UNKNOWN",
      message: "İşlem tamamlanamadı, lütfen tekrar deneyin",
    };
  }

  refresh();
  return { ok: true, data: data as T };
}

/**
 * Randevuyu tamamlandı / gelmedi / iptal olarak işaretler ya da geri alır
 * ("confirmed"). İzinli geçişler için bkz. public.update_appointment_status.
 */
export async function updateAppointmentStatus(
  appointmentId: string,
  status: SettableAppointmentStatus,
  reason?: string,
): Promise<ActionResult<AppointmentStatusChange>> {
  if (!isUuid(appointmentId)) return invalid("Geçersiz randevu");
  if (!SETTABLE_STATUSES.includes(status)) return invalid("Geçersiz durum");
  if (reason !== undefined && (typeof reason !== "string" || reason.length > 500)) {
    return invalid("İptal nedeni en fazla 500 karakter olabilir");
  }

  return mutate<AppointmentStatusChange>("update_appointment_status", {
    p_appointment_id: appointmentId,
    p_status: status,
    p_reason: reason ?? null,
  });
}

/**
 * Randevuyu yeni bir saate, istenirse başka personele taşır.
 * startsAt saat dilimi içeren ISO 8601 olmalıdır (ör. "2026-10-12T10:00:00+03:00").
 */
export async function rescheduleAppointment(
  appointmentId: string,
  startsAt: string,
  barberId?: string,
): Promise<ActionResult<RescheduledAppointment>> {
  if (!isUuid(appointmentId)) return invalid("Geçersiz randevu");
  if (!isIsoTimestamp(startsAt)) return invalid("Geçersiz başlangıç saati");
  if (barberId !== undefined && !isUuid(barberId)) return invalid("Geçersiz personel");

  return mutate<RescheduledAppointment>("reschedule_appointment", {
    p_appointment_id: appointmentId,
    p_starts_at: startsAt,
    p_barber_id: barberId ?? null,
  });
}

/**
 * Ödenmemiş primleri "ödendi" olarak işaretler (yalnızca yönetici).
 * barberId verilmezse tüm personel; until verilmezse bugüne kadar birikenlerin tamamı.
 */
export async function markEarningsPaid(
  salonId: string,
  options: { barberId?: string; until?: string } = {},
): Promise<ActionResult<EarningsPayout>> {
  if (!isUuid(salonId)) return invalid("Geçersiz salon");
  const { barberId, until } = options ?? {};
  if (barberId !== undefined && !isUuid(barberId)) return invalid("Geçersiz personel");
  if (until !== undefined && !isIsoDate(until)) return invalid("Geçersiz tarih");

  return mutate<EarningsPayout>("mark_earnings_paid", {
    p_salon_id: salonId,
    p_barber_id: barberId ?? null,
    p_until: until ?? null,
  });
}
