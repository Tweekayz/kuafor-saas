export type PlanKey = "starter" | "professional" | "premium";

export const PLAN_LABEL: Record<PlanKey, string> = {
  starter: "Başlangıç",
  professional: "Profesyonel",
  premium: "Premium",
};

export type DomainStatus = "pending" | "active" | "rejected";

export const DOMAIN_STATUS_LABEL: Record<DomainStatus, string> = {
  pending: "Onay bekliyor",
  active: "Aktif",
  rejected: "Reddedildi",
};

export type PlatformStats = {
  salons_total: number;
  salons_active: number;
  salons_new: number;
  plans: Partial<Record<PlanKey, number>>;
  appointments_created: number;
  appointments_completed: number;
  revenue: number;
  customers_total: number;
  domains_pending: number;
};

export type SupervisorSalon = {
  id: string;
  name: string;
  slug: string;
  phone: string | null;
  city: string | null;
  is_active: boolean;
  plan: PlanKey;
  custom_domain: string | null;
  custom_domain_status: DomainStatus | null;
  created_at: string;
  owner: {
    id: string;
    email: string | null;
    full_name: string;
    phone: string | null;
    /** Kimlik sunucusundaki son giriş; hiç girmediyse null. */
    last_sign_in_at: string | null;
  };
};
