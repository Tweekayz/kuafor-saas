import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import { createPublicClient } from "@/lib/supabase/public";

import type { CatalogBarber, SalonCatalog } from "./types";

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * Salonun vitrin verisi: aktif hizmetler, aktif personel ve kim hangi hizmeti
 * veriyor. Herkes için aynıdır, bu yüzden kısa süreli önbelleğe alınır; boş
 * saatler önbelleğe alınmaz (istemci get_available_slots'u doğrudan çağırır).
 * Salon yoksa ya da pasifse null.
 */
export async function getSalonCatalog(slug: string): Promise<SalonCatalog | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag(`salon:${slug}`);

  if (!SLUG_RE.test(slug)) return null;

  const supabase = createPublicClient();

  const salon = await supabase
    .from("salons")
    .select("id, name, slug, phone, address, city, timezone, currency, max_booking_days_ahead")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();
  if (salon.error) throw new Error(salon.error.message, { cause: salon.error });
  if (!salon.data) return null;

  const [services, barbers, barberServices, workingHours] = await Promise.all([
    supabase
      .from("services")
      .select("id, name, category, description, duration_minutes, price")
      .eq("salon_id", salon.data.id)
      .eq("is_active", true)
      .order("sort_order")
      .order("name"),
    supabase
      .from("barbers")
      .select("id, display_name, title")
      .eq("salon_id", salon.data.id)
      .eq("is_active", true)
      .order("sort_order")
      .order("display_name"),
    supabase
      .from("barber_services")
      .select("barber_id, service_id, duration_override, price_override")
      .eq("salon_id", salon.data.id),
    supabase.from("working_hours").select("barber_id").eq("salon_id", salon.data.id),
  ]);
  for (const result of [services, barbers, barberServices, workingHours]) {
    if (result.error) throw new Error(result.error.message, { cause: result.error });
  }

  // Mesai saati girilmemiş personelin hiçbir zaman boş saati olmaz; listeleme.
  const scheduled = new Set((workingHours.data ?? []).map((w) => w.barber_id));
  const activeServiceIds = new Set((services.data ?? []).map((s) => s.id));
  const catalogBarbers: CatalogBarber[] = (barbers.data ?? [])
    .filter((b) => scheduled.has(b.id))
    .map((b) => ({ ...b, services: {} }));
  const barberById = new Map(catalogBarbers.map((b) => [b.id, b]));

  for (const row of barberServices.data ?? []) {
    const barber = barberById.get(row.barber_id);
    if (!barber || !activeServiceIds.has(row.service_id)) continue;
    barber.services[row.service_id] = {
      duration: row.duration_override,
      price: row.price_override,
    };
  }

  // Hiçbir aktif personelin vermediği hizmet için randevu alınamaz; gösterme.
  const bookable = new Set(catalogBarbers.flatMap((b) => Object.keys(b.services)));

  return {
    salon: salon.data,
    services: (services.data ?? []).filter((s) => bookable.has(s.id)),
    barbers: catalogBarbers.filter((b) => Object.keys(b.services).length > 0),
  };
}
