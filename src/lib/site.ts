// Tanıtım sayfasının (/) düzenlenebilir bilgileri. Marka adı, iletişim, fiyat
// ve demo salonu buradan değişir; sayfa bileşenine dokunmak gerekmez.

export const site = {
  name: "Kuaför Randevu",

  /** Demo butonunun açtığı salon (salons.slug). */
  demoSalonSlug: process.env.NEXT_PUBLIC_DEMO_SALON_SLUG ?? "randevu",

  // TODO: gerçek iletişim bilgilerinizi yazın. null olan satır sayfada gösterilmez.
  contact: {
    email: "iletisim@ornek.com" as string | null,
    /** Görünen biçimiyle, örn. "0532 123 45 67". */
    phone: null as string | null,
    /** Uluslararası biçimde, yalnızca rakam, örn. "905321234567". */
    whatsapp: null as string | null,
  },

  /** Aylık fiyat metni, örn. "₺990". null ise "Salonunuza özel fiyat" gösterilir. */
  monthlyPrice: null as string | null,
};
