import type { AppointmentStatus } from "@/lib/panel/types";
import type { WeeklyHours } from "@/lib/schedule";

// Kamuya açık randevu akışının tipleri.

export type CatalogService = {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  duration_minutes: number;
  price: number;
};

export type CatalogBarber = {
  id: string;
  display_name: string;
  title: string | null;
  /** Verdiği hizmetler; null değerler "hizmetin standart süresi/fiyatı" demektir. */
  services: Record<string, { duration: number | null; price: number | null }>;
  /** Haftalık mesai; anahtar 0 = Pazar, değerler gün içi dakika. */
  hours: WeeklyHours;
};

export type SalonCatalog = {
  salon: {
    id: string;
    name: string;
    slug: string;
    phone: string | null;
    address: string | null;
    city: string | null;
    timezone: string;
    currency: string;
    max_booking_days_ahead: number;
  };
  services: CatalogService[];
  barbers: CatalogBarber[];
};

export type BookingInput = {
  salonId: string;
  serviceIds: string[];
  /** Saat dilimi içeren ISO 8601 (get_available_slots'un döndürdüğü değer). */
  startsAt: string;
  /** null = "fark etmez"; personeli veritabanı atar. */
  barberId: string | null;
  name: string;
  phone: string;
  email?: string;
  note?: string;
  /** Bot tuzağı: gerçek kullanıcılar bu alanı görmez ve boş bırakır. */
  website?: string;
};

export type BookingConfirmation = {
  appointment_id: string;
  status: AppointmentStatus;
  barber_id: string;
  starts_at: string;
  ends_at: string;
  total_price: number;
  deposit_amount: number;
  requires_payment: boolean;
  hold_expires_at: string | null;
  /** Müşterinin randevu sayfasının (/r/<anahtar>) gizli anahtarı. */
  manage_token: string;
};

export type BookingErrorCode =
  | "INVALID_INPUT"
  | "SALON_NOT_FOUND"
  | "SLOT_UNAVAILABLE"
  | "SLOT_TAKEN"
  | "CUSTOMER_INFO_REQUIRED"
  | "INVALID_PHONE"
  | "CUSTOMER_BLOCKED"
  | "TOO_MANY_BOOKINGS"
  | "UNAVAILABLE"
  | "UNKNOWN";

export type BookingResult =
  | { ok: true; data: BookingConfirmation }
  | { ok: false; code: BookingErrorCode; message: string };
