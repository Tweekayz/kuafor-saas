import "server-only";

import { cache } from "react";

import { createClient } from "@/lib/supabase/server";

import type {
  AgendaItem,
  BarberEarningsRow,
  BarberPerformance,
  BarberSummary,
  BarberWorkingHours,
  CommissionBalance,
  DateRange,
  MemberRole,
  PanelBarber,
  PanelContext,
  SalonDashboard,
  ServicePerformance,
} from "./types";
import { isIsoDate, isUuid } from "./validation";

// Yönetici ve personel panellerinin okuma katmanı. Yetkilendirme veritabanında
// (RLS + fonksiyon içi rol kontrolü) yapılır: yetkisi olmayan kullanıcı hata
// değil boş sonuç (null / []) alır. Bu yüzden sayfalar ayrıca getPanelContext
// ile rolü kontrol edip uygun paneli göstermelidir.

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(fn, args);
  if (error) {
    throw new Error(`${fn}: ${error.message}`, { cause: error });
  }
  return data as T;
}

function assertUuid(value: unknown, name: string): asserts value is string {
  if (!isUuid(value)) throw new TypeError(`${name} geçerli bir UUID değil`);
}

function assertRange(range: DateRange): void {
  if (!isIsoDate(range.from) || !isIsoDate(range.to) || range.from > range.to) {
    throw new TypeError("Tarih aralığı geçersiz (YYYY-MM-DD, from <= to)");
  }
}

// ---------------------------------------------------------------------------
// Oturum bağlamı
// ---------------------------------------------------------------------------

/**
 * Oturumdaki kullanıcının çalıştığı salonlar, rolleri ve (varsa) personel kaydı.
 * Oturum yoksa null. İstek başına bir kez çalışır (React.cache).
 */
export const getPanelContext = cache(async (): Promise<PanelContext | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [members, barbers] = await Promise.all([
    supabase
      .from("salon_members")
      .select("role, salons (id, name, slug, timezone, currency, is_active)")
      .eq("user_id", user.id),
    supabase.from("barbers").select("id, salon_id").eq("user_id", user.id),
  ]);
  if (members.error) throw new Error(members.error.message, { cause: members.error });
  if (barbers.error) throw new Error(barbers.error.message, { cause: barbers.error });

  type MemberRow = {
    role: MemberRole;
    salons: {
      id: string;
      name: string;
      slug: string;
      timezone: string;
      currency: string;
      is_active: boolean;
    };
  };
  type BarberRow = { id: string; salon_id: string };

  const barberBySalon = new Map(
    (barbers.data as BarberRow[]).map((b) => [b.salon_id, b.id]),
  );

  return {
    user_id: user.id,
    memberships: (members.data as unknown as MemberRow[]).map((m) => ({
      salon_id: m.salons.id,
      salon_name: m.salons.name,
      salon_slug: m.salons.slug,
      timezone: m.salons.timezone,
      currency: m.salons.currency,
      is_active: m.salons.is_active,
      role: m.role,
      barber_id: barberBySalon.get(m.salons.id) ?? null,
    })),
  };
});

// ---------------------------------------------------------------------------
// Yönetici paneli (owner / manager)
// ---------------------------------------------------------------------------

/** Ciro, randevu sayıları ve günlük seri. Yönetici değilse null. */
export async function getSalonDashboard(
  salonId: string,
  range: DateRange,
): Promise<SalonDashboard | null> {
  assertUuid(salonId, "salonId");
  assertRange(range);
  return rpc<SalonDashboard | null>("get_salon_dashboard", {
    p_salon_id: salonId,
    p_from: range.from,
    p_to: range.to,
  });
}

/** Personel bazında performans, ciroya göre sıralı. */
export async function getBarberPerformance(
  salonId: string,
  range: DateRange,
): Promise<BarberPerformance[]> {
  assertUuid(salonId, "salonId");
  assertRange(range);
  return rpc<BarberPerformance[]>("get_barber_performance", {
    p_salon_id: salonId,
    p_from: range.from,
    p_to: range.to,
  });
}

/** Hizmet bazında tamamlanan adet ve ciro. */
export async function getServicePerformance(
  salonId: string,
  range: DateRange,
): Promise<ServicePerformance[]> {
  assertUuid(salonId, "salonId");
  assertRange(range);
  return rpc<ServicePerformance[]>("get_service_performance", {
    p_salon_id: salonId,
    p_from: range.from,
    p_to: range.to,
  });
}

/** Personel bazında bugüne kadar birikmiş, ödenmemiş primler. */
export async function getCommissionBalances(salonId: string): Promise<CommissionBalance[]> {
  assertUuid(salonId, "salonId");
  return rpc<CommissionBalance[]>("get_commission_balances", { p_salon_id: salonId });
}

// ---------------------------------------------------------------------------
// Ajanda ve personel paneli
// ---------------------------------------------------------------------------

/**
 * Tarih aralığındaki randevular. Yönetici ve resepsiyon tüm salonu, personel
 * yalnızca kendi randevularını alır.
 */
export async function getAgenda(
  salonId: string,
  range: DateRange,
  options: { barberId?: string; includeClosed?: boolean } = {},
): Promise<AgendaItem[]> {
  assertUuid(salonId, "salonId");
  assertRange(range);
  if (options.barberId !== undefined) assertUuid(options.barberId, "barberId");
  return rpc<AgendaItem[]>("get_agenda", {
    p_salon_id: salonId,
    p_from: range.from,
    p_to: range.to,
    p_barber_id: options.barberId ?? null,
    p_include_closed: options.includeClosed ?? false,
  });
}

/** Salonun personeli (takvim sütunları), pasifler dahil. */
export async function getSalonBarbers(salonId: string): Promise<PanelBarber[]> {
  assertUuid(salonId, "salonId");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("barbers")
    .select("id, display_name, is_active")
    .eq("salon_id", salonId)
    .order("sort_order")
    .order("display_name");
  if (error) throw new Error(`barbers: ${error.message}`, { cause: error });
  return data;
}

/** Salonun tüm haftalık mesai satırları (0 = Pazar). Satırı olmayan gün çalışılmıyor. */
export async function getWorkingHours(salonId: string): Promise<BarberWorkingHours[]> {
  assertUuid(salonId, "salonId");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("working_hours")
    .select("barber_id, day_of_week, start_time, end_time")
    .eq("salon_id", salonId);
  if (error) throw new Error(`working_hours: ${error.message}`, { cause: error });
  return data;
}

/** Personelin dönem özeti. Kendi kaydı ya da yöneticisi olduğu salon değilse null. */
export async function getBarberSummary(
  barberId: string,
  range: DateRange,
): Promise<BarberSummary | null> {
  assertUuid(barberId, "barberId");
  assertRange(range);
  return rpc<BarberSummary | null>("get_barber_summary", {
    p_barber_id: barberId,
    p_from: range.from,
    p_to: range.to,
  });
}

/** Hizmet bazında prim dökümü (personel kendi kaydı, yönetici herkes için). */
export async function getBarberEarnings(
  barberId: string,
  range: DateRange,
): Promise<BarberEarningsRow[]> {
  assertUuid(barberId, "barberId");
  assertRange(range);
  return rpc<BarberEarningsRow[]>("get_barber_earnings", {
    p_barber_id: barberId,
    p_from: range.from,
    p_to: range.to,
  });
}
