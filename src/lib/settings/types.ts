// Salon kurulum/ayar ekranının (/panel/ayarlar) tipleri.

export type SettingsService = {
  id: string;
  name: string;
  category: string | null;
  duration_minutes: number;
  price: number;
  is_active: boolean;
};

export type SettingsBarber = {
  id: string;
  display_name: string;
  title: string | null;
  is_active: boolean;
  /** Varsayılan prim oranı (%); kural yoksa null (prim 0 sayılır). */
  commission_rate: number | null;
  /** Verdiği hizmetler; null değerler "hizmetin standart süresi/fiyatı" demektir. */
  services: Record<string, { duration: number | null; price: number | null }>;
  /** Haftalık mesai; anahtar 0 = Pazar. Değerler "HH:MM". Olmayan gün çalışmıyor. */
  hours: Record<number, { start: string; end: string }>;
};

export type SalonSettings = {
  services: SettingsService[];
  barbers: SettingsBarber[];
};

export type SalonProfile = {
  id: string;
  name: string;
  slug: string;
  phone: string | null;
  city: string | null;
  address: string | null;
};

/** Ayar formlarının (useActionState) sonucu. */
export type FormState = { ok: boolean; message: string } | null;
