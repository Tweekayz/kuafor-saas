import "server-only";

import { createClient } from "@/lib/supabase/server";

import type { SalonProfile, SalonSettings, SettingsBarber } from "./types";

/** Salonun düzenlenebilir temel bilgileri. Kullanıcı salonu göremiyorsa null. */
export async function getSalonProfile(salonId: string): Promise<SalonProfile | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("salons")
    .select("id, name, slug, phone, city, address")
    .eq("id", salonId)
    .maybeSingle();
  if (error) throw new Error(`salons: ${error.message}`, { cause: error });
  return data;
}

/**
 * Ayar ekranının verisi: pasifler dahil tüm hizmetler ve personel, hizmet
 * eşleştirmeleri, mesai saatleri ve varsayılan prim oranları. Prim oranları
 * RLS gereği yalnızca yöneticiye döner.
 */
export async function getSalonSettings(salonId: string): Promise<SalonSettings> {
  const supabase = await createClient();

  const [breaks, services, barbers, barberServices, workingHours, commissionRules] = await Promise.all([
    supabase
      .from("working_hour_breaks")
      .select("barber_id, start_time, end_time")
      .eq("salon_id", salonId),
    supabase
      .from("services")
      .select("id, name, category, duration_minutes, price, is_active")
      .eq("salon_id", salonId)
      .order("sort_order")
      .order("name"),
    supabase
      .from("barbers")
      .select("id, display_name, title, is_active")
      .eq("salon_id", salonId)
      .order("sort_order")
      .order("display_name"),
    supabase
      .from("barber_services")
      .select("barber_id, service_id, duration_override, price_override")
      .eq("salon_id", salonId),
    supabase
      .from("working_hours")
      .select("barber_id, day_of_week, start_time, end_time")
      .eq("salon_id", salonId),
    supabase
      .from("barber_commission_rules")
      .select("barber_id, rate")
      .eq("salon_id", salonId)
      .is("service_id", null),
  ]);
  for (const result of [breaks, services, barbers, barberServices, workingHours, commissionRules]) {
    if (result.error) throw new Error(result.error.message, { cause: result.error });
  }

  const settingsBarbers: SettingsBarber[] = (barbers.data ?? []).map((b) => ({
    ...b,
    commission_rate: null,
    services: {},
    hours: {},
    break: null,
  }));
  const barberById = new Map(settingsBarbers.map((b) => [b.id, b]));

  for (const row of barberServices.data ?? []) {
    const barber = barberById.get(row.barber_id);
    if (barber) {
      barber.services[row.service_id] = {
        duration: row.duration_override,
        price: row.price_override,
      };
    }
  }
  for (const row of workingHours.data ?? []) {
    const barber = barberById.get(row.barber_id);
    if (barber) {
      barber.hours[row.day_of_week] = {
        start: row.start_time.slice(0, 5),
        end: row.end_time.slice(0, 5),
      };
    }
  }
  // Panel her çalışma gününe aynı molayı yazar; ilk satır temsil eder.
  for (const row of breaks.data ?? []) {
    const barber = barberById.get(row.barber_id);
    if (barber && !barber.break) {
      barber.break = { start: row.start_time.slice(0, 5), end: row.end_time.slice(0, 5) };
    }
  }
  for (const row of commissionRules.data ?? []) {
    const barber = barberById.get(row.barber_id);
    if (barber) barber.commission_rate = row.rate;
  }

  return { services: services.data ?? [], barbers: settingsBarbers };
}
