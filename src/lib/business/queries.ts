import "server-only";

import { addDays, zonedToIso } from "@/lib/format";
import { isMissingSchema } from "@/lib/panel/guard";
import type { AppointmentStatus, DateRange } from "@/lib/panel/types";
import { createClient } from "@/lib/supabase/server";

import type {
  AutomationSettings,
  BookingRules,
  CustomerDetail,
  CustomerRow,
  Expense,
  PaymentBreakdown,
  Product,
  QueuedNotification,
  TimeOff,
} from "./types";

// İşletme modüllerinin okuma katmanı. Yetki RLS'tedir. Veritabanı güncellemesi
// (…_business_modules.sql) gerektiren sorgular, güncelleme uygulanmadıysa hata
// fırlatmak yerine null döner; sayfa "güncelleme gerekli" uyarısı gösterir.

type DbError = { code?: string; message: string };

function check(scope: string, error: DbError | null): void {
  if (error) throw new Error(`${scope}: ${error.message}`, { cause: error });
}

// ---------------------------------------------------------------------------
// Finans
// ---------------------------------------------------------------------------

/** Aralıkta tamamlanan randevuların ödeme yöntemine göre toplamı. */
export async function getPaymentBreakdown(
  salonId: string,
  range: DateRange,
  timeZone: string,
): Promise<PaymentBreakdown | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("appointments")
    .select("total_price, payment_method")
    .eq("salon_id", salonId)
    .eq("status", "completed")
    .gte("starts_at", zonedToIso(range.from, 0, timeZone))
    .lt("starts_at", zonedToIso(addDays(range.to, 1), 0, timeZone));
  if (isMissingSchema(error)) return null;
  check("payment breakdown", error);

  const totals: PaymentBreakdown = { cash: 0, card: 0, transfer: 0, unspecified: 0 };
  for (const row of (data ?? []) as { total_price: number; payment_method: string | null }[]) {
    const key = (row.payment_method ?? "unspecified") as keyof PaymentBreakdown;
    totals[key] += Number(row.total_price);
  }
  return totals;
}

export async function getExpenses(salonId: string, range: DateRange): Promise<Expense[] | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("expenses")
    .select("id, category, description, amount, spent_on")
    .eq("salon_id", salonId)
    .gte("spent_on", range.from)
    .lte("spent_on", range.to)
    .order("spent_on", { ascending: false })
    .order("created_at", { ascending: false });
  if (isMissingSchema(error)) return null;
  check("expenses", error);
  return (data ?? []).map((row) => ({ ...row, amount: Number(row.amount) }));
}

// ---------------------------------------------------------------------------
// Müşteriler
// ---------------------------------------------------------------------------

type StatsRow = {
  customer_id: string;
  total_visits: number;
  no_show_count: number;
  total_spent: number;
  last_visit_at: string | null;
};

const EMPTY_STATS = { total_visits: 0, no_show_count: 0, total_spent: 0, last_visit_at: null };

export async function listCustomers(salonId: string, search?: string): Promise<CustomerRow[]> {
  const supabase = await createClient();

  let query = supabase
    .from("customers")
    .select("id, full_name, phone, tags, is_blocked, created_at")
    .eq("salon_id", salonId)
    .order("full_name")
    .limit(300);
  // Filtre sözdizimini bozabilecek karakterler ayıklanır.
  const term = (search ?? "").replace(/[%,()\\*]/g, " ").trim();
  if (term) query = query.or(`full_name.ilike.%${term}%,phone.ilike.%${term}%`);

  const [customers, stats] = await Promise.all([
    query,
    supabase
      .from("customer_stats")
      .select("customer_id, total_visits, no_show_count, total_spent, last_visit_at")
      .eq("salon_id", salonId),
  ]);
  check("customers", customers.error);
  check("customer_stats", stats.error);

  const statsById = new Map((stats.data as StatsRow[]).map((s) => [s.customer_id, s]));
  return (customers.data ?? []).map((customer) => {
    const s = statsById.get(customer.id) ?? EMPTY_STATS;
    return {
      ...customer,
      total_visits: Number(s.total_visits),
      no_show_count: Number(s.no_show_count),
      total_spent: Number(s.total_spent),
      last_visit_at: s.last_visit_at,
    };
  });
}

export async function getCustomerDetail(
  salonId: string,
  customerId: string,
): Promise<CustomerDetail | null> {
  const supabase = await createClient();

  const [customer, stats, appointments, notes] = await Promise.all([
    supabase
      .from("customers")
      .select("id, full_name, phone, email, allergies, tags, is_blocked, created_at")
      .eq("salon_id", salonId)
      .eq("id", customerId)
      .maybeSingle(),
    supabase
      .from("customer_stats")
      .select("customer_id, total_visits, no_show_count, total_spent, last_visit_at")
      .eq("customer_id", customerId)
      .maybeSingle(),
    supabase
      .from("appointments")
      .select(
        "id, starts_at, status, total_price, barbers (display_name), appointment_services (service_name)",
      )
      .eq("salon_id", salonId)
      .eq("customer_id", customerId)
      .order("starts_at", { ascending: false })
      .limit(30),
    supabase
      .from("customer_notes")
      .select("id, note, created_at")
      .eq("salon_id", salonId)
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false }),
  ]);
  check("customer", customer.error);
  check("customer_stats", stats.error);
  check("customer appointments", appointments.error);
  check("customer_notes", notes.error);
  if (!customer.data) return null;

  type AppointmentRow = {
    id: string;
    starts_at: string;
    status: AppointmentStatus;
    total_price: number;
    barbers: { display_name: string } | null;
    appointment_services: { service_name: string }[];
  };
  const s = (stats.data as StatsRow | null) ?? EMPTY_STATS;

  return {
    ...customer.data,
    total_visits: Number(s.total_visits),
    no_show_count: Number(s.no_show_count),
    total_spent: Number(s.total_spent),
    last_visit_at: s.last_visit_at,
    appointments: (appointments.data as unknown as AppointmentRow[]).map((a) => ({
      id: a.id,
      starts_at: a.starts_at,
      status: a.status,
      total_price: Number(a.total_price),
      barber_name: a.barbers?.display_name ?? "",
      services: a.appointment_services.map((item) => item.service_name),
    })),
    notes: notes.data ?? [],
  };
}

// ---------------------------------------------------------------------------
// Stok
// ---------------------------------------------------------------------------

export async function listProducts(salonId: string): Promise<Product[] | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select(
      "id, name, category, unit, quantity, critical_level, purchase_price, sale_price, is_active",
    )
    .eq("salon_id", salonId)
    .order("name");
  if (isMissingSchema(error)) return null;
  check("products", error);
  return (data ?? []).map((p) => ({
    ...p,
    quantity: Number(p.quantity),
    critical_level: Number(p.critical_level),
    purchase_price: p.purchase_price === null ? null : Number(p.purchase_price),
    sale_price: p.sale_price === null ? null : Number(p.sale_price),
  }));
}

// ---------------------------------------------------------------------------
// Otomasyon
// ---------------------------------------------------------------------------

export async function getAutomationSettings(salonId: string): Promise<AutomationSettings | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("salons")
    .select(
      "notification_channel, reminders_enabled, confirmation_template, reminder_template, review_request_enabled, review_template, review_url",
    )
    .eq("id", salonId)
    .maybeSingle();
  if (isMissingSchema(error)) return null;
  check("automation settings", error);
  return data as AutomationSettings | null;
}

/** Kuyruktaki son bildirimler (en yeni planlanan önce). */
export async function getNotificationQueue(salonId: string): Promise<QueuedNotification[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("id, type, status, scheduled_at, customers (full_name)")
    .eq("salon_id", salonId)
    .order("scheduled_at", { ascending: false })
    .limit(25);
  check("notifications", error);

  type Row = {
    id: string;
    type: string;
    status: string;
    scheduled_at: string;
    customers: { full_name: string } | null;
  };
  return (data as unknown as Row[]).map((row) => ({
    id: row.id,
    type: row.type,
    status: row.status,
    scheduled_at: row.scheduled_at,
    customer_name: row.customers?.full_name ?? "",
  }));
}

// ---------------------------------------------------------------------------
// İzinler, randevu kuralları, alan adı
// ---------------------------------------------------------------------------

/** Bitmemiş (bugün ve sonrası) izin ve kapalı gün kayıtları. */
export async function getUpcomingTimeOff(salonId: string): Promise<TimeOff[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("time_off")
    .select("id, barber_id, starts_at, ends_at, reason")
    .eq("salon_id", salonId)
    .gte("ends_at", new Date().toISOString())
    .order("starts_at");
  check("time_off", error);
  return data ?? [];
}

export async function getBookingRules(salonId: string): Promise<BookingRules | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("salons")
    .select("slot_interval_minutes, min_booking_notice_minutes, max_booking_days_ahead")
    .eq("id", salonId)
    .maybeSingle();
  check("booking rules", error);
  return data;
}

export type CustomDomain = {
  domain: string | null;
  /** Süper yönetici onayı: pending / active / rejected; alan adı yoksa null. */
  status: "pending" | "active" | "rejected" | null;
};

/** Salonun kendi alan adı ve onay durumu. null = özellik henüz etkin değil (sütunlar yok). */
export async function getCustomDomain(salonId: string): Promise<CustomDomain | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("salons")
    .select("custom_domain, custom_domain_status")
    .eq("id", salonId)
    .maybeSingle();
  if (isMissingSchema(error)) return null;
  check("custom domain", error);
  const row = data as { custom_domain: string | null; custom_domain_status: CustomDomain["status"] } | null;
  return { domain: row?.custom_domain ?? null, status: row?.custom_domain_status ?? null };
}
