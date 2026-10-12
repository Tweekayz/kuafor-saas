# Kuaför Randevu

Kuaför ve güzellik salonları için online randevu ve salon yönetimi. Next.js (App Router, Cache Components) + Supabase.

## Sayfalar

| Adres | Kim görür | İçerik |
| --- | --- | --- |
| `/` | Herkes | Tanıtım sayfası |
| `/randevu/[slug]` | Herkes | Salonun online randevu akışı |
| `/giris` | Herkes | Salon paneline giriş |
| `/panel` | Salon ekibi | Takvim: gün ve hafta görünümü, sürükle-bırak erteleme |
| `/panel/finans` | Sahip, yönetici | Ciro, prim, ödeme yöntemi kırılımı, giderler |
| `/panel/musteriler` | Sahip, yönetici, resepsiyon | Müşteri kartları, geçmiş, etiketler, notlar |
| `/panel/hizmetler` | Sahip, yönetici | Hizmet ve fiyat yönetimi |
| `/panel/personel` | Sahip, yönetici | Personel, hizmet eşleştirme, mesai, mola, izinler |
| `/panel/stok` | Sahip, yönetici, resepsiyon | Ürün stoğu ve kritik stok uyarıları |
| `/panel/otomasyon` | Sahip, yönetici | Mesaj şablonları ve kuyruk (gönderim sağlayıcısı bağlı değil) |
| `/panel/ayarlar` | Sahip, yönetici | Salon bilgileri, randevu kuralları, alan adı; salon oluşturma |
| `/panel/gorseller` | Salon ekibi | Müşterilerin yüklediği görseller; yanıt ve fiyat tahmini |
| `/panel/yorumlar` | Sahip, yönetici | Müşteri değerlendirmeleri: yayınlama, öne çıkarma, yanıt |
| `/r/[anahtar]` | Bağlantıya sahip müşteri | Randevu özeti, görsel danışma, değerlendirme formu |
| `/supervisor` | Süper yönetici | Platform istatistikleri, salon/kullanıcı yönetimi, domain talepleri |

**Süper yönetici:** `/supervisor` yalnızca e-postası `SUPERVISOR_EMAILS` ortam değişkeninde olan, oturum açmış kullanıcıya açılır; başkasına "bulunamadı" döner. Panel veritabanına service role ile eriştiği için her sayfa ve her işlem yetkiyi ayrıca doğrular. Domain onayı `VERCEL_AUTH_TOKEN` + `VERCEL_PROJECT_ID` ile alan adını Vercel projesine ekler. Salon sahipleri paketlerini, dondurulma durumlarını ve domain onayını kendileri değiştiremez (veritabanı tetikleyicisi).

**Görsel danışma ve değerlendirme:** müşteriler hesapsızdır; `/r/<anahtar>` adresindeki gizli anahtar (`appointments.manage_token`) randevunun kimliğidir. Görseller tarayıcıda küçültülür ve sunucunun o randevuya özel verdiği tek kullanımlık izinle Supabase Storage'a yüklenir: danışma görselleri kapalı `consultations` kovasında (personele imzalı bağlantıyla gösterilir), yorum fotoğrafları herkese açık `reviews` kovasında durur. Yapay zekâ önerisi `ANTHROPIC_API_KEY` tanımlıysa ve müşteri onay verirse çalışır. Vitrindeki ortalama puan tüm değerlendirmelerden hesaplanır; yayınlama yalnızca yorum metnini ve fotoğrafları etkiler.

Salona özel adresler: `<slug>.<NEXT_PUBLIC_ROOT_DOMAIN>` ya da salonun kendi alan adı (`salons.custom_domain`) ile gelen ana sayfa isteği `src/proxy.ts` tarafından `/randevu/<slug>` sayfasına yönlendirilir (rewrite). Yerelde `http://<slug>.localhost:3000` ile denenebilir. Canlıda alan adının ayrıca Vercel projesine eklenmesi gerekir (subdomain için wildcard `*.alanadi.com`).

## Ortam değişkenleri

`.env.example` dosyasını `.env.local` olarak kopyalayıp doldurun. Aynı değişkenler Vercel'de de (Project → Settings → Environment Variables) tanımlı olmalıdır.

| Değişken | Zorunlu | Açıklama |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Evet | Supabase proje adresi |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Evet | Supabase anon anahtarı |
| `SUPABASE_SERVICE_ROLE_KEY` | Evet | Yalnızca sunucu. Hesapsız müşterinin randevu alabilmesi için gerekir; yoksa randevu sayfası "kullanılamıyor" der. Asla `NEXT_PUBLIC_` yapmayın. |
| `NEXT_PUBLIC_DEMO_SALON_SLUG` | Hayır | Tanıtım sayfasındaki demo butonunun açtığı salon (varsayılan `randevu`) |

Vercel'de bir değişkeni ekledikten ya da değiştirdikten sonra yeniden deploy gerekir.

## Geliştirme

```bash
npm install
npm run dev      # http://localhost:3000
npm run lint
npm run build
```

## Veritabanı

Şema ve fonksiyonlar `supabase/migrations/` altındadır; sırayla Supabase SQL Editor'de ya da `supabase db push` ile uygulanır. `20261013000000_business_modules.sql` uygulanmadan gider, ödeme yöntemi, stok, otomasyon ayarları ve özel alan adı bölümleri "veritabanı güncellemesi gerekiyor" uyarısı gösterir; sitenin geri kalanı çalışır. Yetkilendirme veritabanındadır (RLS + fonksiyon içi rol kontrolü).

## İlk kurulum

1. Supabase → Authentication → Users altından salon sahibi için bir kullanıcı oluşturun (uygulamada kayıt ekranı yoktur).
2. `/giris` ile girin; `/panel/ayarlar` salon oluşturma formunu gösterir.
3. `/panel/hizmetler` → hizmetleri ekleyin.
4. `/panel/personel` → personeli ekleyin, kartını açıp **Hizmetleri kaydet** ve **Saatleri kaydet** adımlarını tamamlayın. İkisi de kaydedilmeden personel randevu sayfasında görünmez.
5. `/randevu/<salon-adresi>` bağlantısını müşterilerinizle paylaşın.

## Tanıtım sayfası bilgileri

Marka adı, iletişim bilgileri, fiyat ve demo salonu `src/lib/site.ts` dosyasındadır.

## Yayın öncesi kontrol listesi

- [ ] Vercel'de üç zorunlu ortam değişkeni tanımlı
- [ ] `src/lib/site.ts` içindeki iletişim bilgileri gerçek
- [ ] Demo salonda en az bir hizmet ve randevu alabilen bir personel var
- [ ] Vercel Firewall'da `/randevu/*` için IP bazlı hız sınırı tanımlı (uygulama yalnızca telefon ve salon bazında sınırlar)
- [ ] Supabase → Authentication → URL Configuration → Site URL üretim adresi
