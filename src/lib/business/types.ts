import type { AppointmentStatus } from "@/lib/panel/types";

// İşletme modüllerinin tipleri: kasa, müşteriler, stok, otomasyon, izinler.

export type PaymentBreakdown = {
  cash: number;
  card: number;
  transfer: number;
  /** Tamamlanmış ama ödeme yöntemi girilmemiş randevular. */
  unspecified: number;
};

export type Expense = {
  id: string;
  category: string;
  description: string | null;
  amount: number;
  /** "YYYY-MM-DD" */
  spent_on: string;
};

export type CustomerRow = {
  id: string;
  full_name: string;
  phone: string;
  tags: string[];
  is_blocked: boolean;
  created_at: string;
  total_visits: number;
  no_show_count: number;
  total_spent: number;
  last_visit_at: string | null;
};

export type CustomerDetail = CustomerRow & {
  email: string | null;
  allergies: string | null;
  appointments: {
    id: string;
    starts_at: string;
    status: AppointmentStatus;
    total_price: number;
    barber_name: string;
    services: string[];
  }[];
  notes: { id: string; note: string; created_at: string }[];
};

export type Product = {
  id: string;
  name: string;
  category: string | null;
  unit: string;
  quantity: number;
  critical_level: number;
  purchase_price: number | null;
  sale_price: number | null;
  is_active: boolean;
};

export type AutomationSettings = {
  notification_channel: "whatsapp" | "sms" | "email";
  reminders_enabled: boolean;
  confirmation_template: string | null;
  reminder_template: string | null;
  review_request_enabled: boolean;
  review_template: string | null;
  review_url: string | null;
};

export type QueuedNotification = {
  id: string;
  type: string;
  status: string;
  scheduled_at: string;
  customer_name: string;
};

export type TimeOff = {
  id: string;
  /** null = tüm salon kapalı */
  barber_id: string | null;
  starts_at: string;
  ends_at: string;
  reason: string | null;
};

export type BookingRules = {
  slot_interval_minutes: number;
  min_booking_notice_minutes: number;
  max_booking_days_ahead: number;
};

/** Müşteriyi öne çıkaran el ile verilen etiket. */
export const VIP_TAG = "VIP";
/** Bu kadar tamamlanmış ziyaretten sonra müşteri "Düzenli" sayılır. */
export const REGULAR_VISITS = 3;
