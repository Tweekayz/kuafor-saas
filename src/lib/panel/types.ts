// Panel RPC'lerinin (supabase/migrations/*_dashboard_reports.sql ve
// *_panel_functions.sql) dönüş tipleri. Alan adları SQL ile birebir aynıdır.

export type MemberRole = "owner" | "manager" | "receptionist" | "barber";

export type AppointmentStatus =
  | "pending_payment"
  | "confirmed"
  | "completed"
  | "cancelled"
  | "no_show";

export type AppointmentSource = "online" | "walk_in" | "phone" | "staff";

/** Salonun yerel takvim günü, "YYYY-MM-DD". */
export type IsoDate = string;

export type DateRange = { from: IsoDate; to: IsoDate };

// ---------------------------------------------------------------------------
// Oturum bağlamı
// ---------------------------------------------------------------------------

export type PanelMembership = {
  salon_id: string;
  salon_name: string;
  salon_slug: string;
  timezone: string;
  currency: string;
  role: MemberRole;
  /** Kullanıcının bu salondaki personel kaydı (randevu alınabilen kişi değilse null). */
  barber_id: string | null;
};

export type PanelContext = {
  user_id: string;
  memberships: PanelMembership[];
};

// ---------------------------------------------------------------------------
// Yönetici raporları
// ---------------------------------------------------------------------------

export type SalonDashboard = {
  revenue: number;
  expected_revenue: number;
  appointments: {
    total: number;
    completed: number;
    confirmed: number;
    pending_payment: number;
    cancelled: number;
    no_show: number;
  };
  commission_total: number;
  deposits_collected: number;
  new_customers: number;
  daily: { day: IsoDate; revenue: number; appointments: number }[];
};

export type BarberPerformance = {
  barber_id: string;
  display_name: string;
  is_active: boolean;
  completed_count: number;
  upcoming_count: number;
  no_show_count: number;
  cancelled_count: number;
  revenue: number;
  commission: number;
  booked_minutes: number;
};

export type ServicePerformance = {
  service_id: string;
  service_name: string;
  category: string | null;
  item_count: number;
  revenue: number;
  booked_minutes: number;
};

export type CommissionBalance = {
  barber_id: string;
  display_name: string;
  is_active: boolean;
  unpaid_amount: number;
  unpaid_items: number;
  oldest_unpaid_at: string | null;
  last_paid_out_at: string | null;
};

// ---------------------------------------------------------------------------
// Ajanda ve personel paneli
// ---------------------------------------------------------------------------

export type AgendaItem = {
  appointment_id: string;
  barber_id: string;
  barber_name: string;
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  starts_at: string;
  ends_at: string;
  status: AppointmentStatus;
  source: AppointmentSource;
  total_price: number;
  deposit_amount: number;
  customer_note: string | null;
  services: {
    service_id: string;
    name: string;
    duration_minutes: number;
    price: number;
  }[];
};

export type PanelBarber = {
  id: string;
  display_name: string;
  is_active: boolean;
};

/** Personelin bir gündeki mesaisi; saatler salonun yerel saatinde "HH:MM:SS". */
export type BarberWorkingHours = {
  barber_id: string;
  start_time: string;
  end_time: string;
};

export type BarberSummary = {
  barber_id: string;
  display_name: string;
  appointments: {
    completed: number;
    upcoming: number;
    no_show: number;
    cancelled: number;
  };
  revenue: number;
  commission: { earned: number; paid_out: number; unpaid: number };
  next_appointment_at: string | null;
};

export type BarberEarningsRow = {
  service_name: string;
  item_count: number;
  base_amount: number;
  commission_amount: number;
  paid_out_amount: number;
};

// ---------------------------------------------------------------------------
// İşlemler (Server Actions)
// ---------------------------------------------------------------------------

export type PanelErrorCode =
  | "UNAUTHENTICATED"
  | "INVALID_INPUT"
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "INVALID_TRANSITION"
  | "APPOINTMENT_NOT_STARTED"
  | "EARNINGS_PAID_OUT"
  | "NOT_RESCHEDULABLE"
  | "BARBER_UNAVAILABLE"
  | "SLOT_UNAVAILABLE"
  | "SLOT_TAKEN"
  | "UNKNOWN";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: PanelErrorCode; message: string };

/** Panelden elle ayarlanabilen durumlar (pending_payment yalnızca rezervasyonda oluşur). */
export type SettableAppointmentStatus = Exclude<AppointmentStatus, "pending_payment">;

export type AppointmentStatusChange = {
  appointment_id: string;
  status: AppointmentStatus;
  previous_status: AppointmentStatus;
};

export type RescheduledAppointment = {
  appointment_id: string;
  status: AppointmentStatus;
  barber_id: string;
  starts_at: string;
  ends_at: string;
};

export type EarningsPayout = {
  item_count: number;
  amount: number;
  paid_out_at: string;
};
