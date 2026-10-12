// Tanıtım sayfasının (/) düzenlenebilir bilgileri. Marka adı, iletişim, paketler
// ve demo salonu buradan değişir; sayfa bileşenine dokunmak gerekmez.
//
// İletişim bilgileri ortam değişkeniyle de verilebilir (Vercel → Settings →
// Environment Variables); değişken tanımlı değilse aşağıdaki varsayılan kullanılır.
// Boş ya da null olan satır sayfada gösterilmez.

function fromEnv(value: string | undefined, fallback: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

export type Plan = {
  name: string;
  /** TL, aylık ödeme. */
  monthly: number;
  /** TL, yıllık ödeme (2 ay ücretsiz). */
  yearly: number;
  tagline: string;
  features: string[];
  popular?: boolean;
};

export const site = {
  name: "Kuaför Randevu",

  /**
   * Demo butonunun açtığı salon (salons.slug). Salonun adresi panelden
   * değiştirilirse burası (ya da NEXT_PUBLIC_DEMO_SALON_SLUG) da güncellenmelidir.
   */
  demoSalonSlug: fromEnv(process.env.NEXT_PUBLIC_DEMO_SALON_SLUG, null) ?? "date",

  contact: {
    email: fromEnv(process.env.NEXT_PUBLIC_CONTACT_EMAIL, "aytac.altac98@gmail.com"),
    /** Görünen biçimiyle, örn. "0532 123 45 67". */
    phone: fromEnv(process.env.NEXT_PUBLIC_CONTACT_PHONE, "0537 349 79 98"),
    /** WhatsApp satış ve destek hattı: uluslararası biçimde, yalnızca rakam. */
    whatsapp: fromEnv(process.env.NEXT_PUBLIC_CONTACT_WHATSAPP, "905373497998"),
    /** Açık adres; tanımlı değilse gösterilmez. */
    address: fromEnv(process.env.NEXT_PUBLIC_CONTACT_ADDRESS, null),
  },

  /** Deneme süresi (gün). */
  trialDays: 14,

  plans: [
    {
      name: "Başlangıç",
      monthly: 499,
      yearly: 4990,
      tagline: "Tek başına çalışan ustalar için",
      features: ["1 personel", "Sınırsız randevu", "Standart alt alan adı (subdomain)"],
    },
    {
      name: "Profesyonel",
      monthly: 899,
      yearly: 8990,
      tagline: "Ekibiyle büyüyen salonlar için",
      features: [
        "5 personel",
        "Kasa ve prim takibi",
        "Stok yönetimi",
        "Özel alan adı (domain) bağlama",
      ],
      popular: true,
    },
    {
      name: "Premium",
      monthly: 1499,
      yearly: 14990,
      tagline: "Sınır istemeyen işletmeler için",
      features: ["Sınırsız personel", "Tüm otomasyonlar", "VIP destek"],
    },
  ] satisfies Plan[],
};

/** WhatsApp sohbet bağlantısı (isteğe bağlı hazır mesajla); hat tanımlı değilse null. */
export function whatsappLink(message?: string): string | null {
  if (!site.contact.whatsapp) return null;
  const base = `https://wa.me/${site.contact.whatsapp}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}
