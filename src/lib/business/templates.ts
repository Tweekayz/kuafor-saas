// Müşteri mesaj şablonları. Salon kendi metnini yazmadıysa varsayılanlar
// kullanılır. Değişkenler süslü parantezle yazılır: {musteri}, {saat}…

export const TEMPLATE_VARIABLES = [
  ["{musteri}", "Müşterinin adı"],
  ["{salon}", "Salon adı"],
  ["{tarih}", "Randevu tarihi"],
  ["{saat}", "Randevu saati"],
  ["{personel}", "Personel adı"],
  ["{hizmet}", "Hizmet(ler)"],
  ["{link}", "Yorum bağlantısı"],
] as const;

export const DEFAULT_TEMPLATES = {
  confirmation:
    "Merhaba {musteri}, {salon} randevunuz oluşturuldu: {tarih} saat {saat}, {personel} ({hizmet}). Görüşmek üzere!",
  reminder:
    "Merhaba {musteri}, {salon} randevunuzu hatırlatırız: {tarih} saat {saat}. Gelemeyecekseniz lütfen bize haber verin.",
  review:
    "Merhaba {musteri}, {salon} olarak bizi tercih ettiğiniz için teşekkür ederiz. Deneyiminizi değerlendirir misiniz? {link}",
};

/** Şablondaki değişkenleri doldurur; bilinmeyen değişkenler olduğu gibi kalır. */
export function renderTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) => values[name] ?? match);
}
