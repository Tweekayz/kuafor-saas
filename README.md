# Kuaför Randevu

Kuaför ve güzellik salonları için online randevu ve salon yönetimi. Next.js (App Router, Cache Components) + Supabase.

## Sayfalar

| Adres | Kim görür | İçerik |
| --- | --- | --- |
| `/` | Herkes | Tanıtım sayfası |
| `/randevu/[slug]` | Herkes | Salonun online randevu akışı |
| `/giris` | Herkes | Salon paneline giriş |
| `/panel` | Salon ekibi | Günlük randevu takvimi |
| `/panel/finans` | Sahip, yönetici | Ciro ve prim raporları |
| `/panel/hizmetler` | Sahip, yönetici | Hizmet yönetimi |
| `/panel/personel` | Sahip, yönetici | Personel, hizmet eşleştirme, çalışma saatleri |
| `/panel/ayarlar` | Sahip, yönetici | Salon bilgileri; salonu olmayan hesap için salon oluşturma |

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

Şema ve fonksiyonlar `supabase/migrations/` altındadır; sırayla Supabase SQL Editor'de ya da `supabase db push` ile uygulanır. Yetkilendirme veritabanındadır (RLS + fonksiyon içi rol kontrolü).

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
