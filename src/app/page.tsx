import type { Metadata } from "next";
import Link from "next/link";

import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: `${site.name} — Salonunuz için online randevu ve yönetim`,
  description:
    "Kuaför ve güzellik salonları için 7/24 online randevu, çakışmasız takvim, ciro ve personel prim takibi.",
};

const demoHref = `/randevu/${site.demoSalonSlug}`;

const primaryButton =
  "inline-flex items-center justify-center rounded-full bg-amber-700 px-6 py-3 font-medium text-white transition-colors hover:bg-amber-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 dark:bg-amber-500 dark:text-zinc-950 dark:hover:bg-amber-400";
const secondaryButton =
  "inline-flex items-center justify-center rounded-full border border-zinc-300 px-6 py-3 font-medium transition-colors hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 dark:border-zinc-700 dark:hover:bg-zinc-800 dark:focus-visible:outline-zinc-100";
const eyebrow = "text-sm font-semibold tracking-wide text-amber-700 uppercase dark:text-amber-400";

const features = [
  {
    title: "7/24 Online Randevu",
    description:
      "Müşterileriniz salonunuza özel bağlantıdan hizmeti, personeli ve saati seçip dakikalar içinde randevu alır. Siz uyurken de takviminiz dolar.",
    icon: "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm4 10 2 2 4-4",
    soon: false,
  },
  {
    title: "Akıllı Slot ve Çakışma Önleme",
    description:
      "Boş saatler çalışma saatlerine, molalara, izinlere ve mevcut randevulara göre hesaplanır. Aynı saate iki randevu yazılması sistem düzeyinde engellenir.",
    icon: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Zm0-16v6l4 2",
    soon: false,
  },
  {
    title: "Personel Prim ve Ciro Takibi",
    description:
      "Günlük ve aylık ciroyu, beklenen geliri ve her personelin hak ettiği primi tek ekranda görün. Ödenen primleri tek tıkla işaretleyin.",
    icon: "M3 3v18h18M7 15l4-4 3 3 5-6",
    soon: false,
  },
  {
    title: "Dijital Müşteri Kartı",
    description:
      "Ziyaret geçmişi, özel notlar, alerjiler ve boya formülleri müşterinin kartında durur. Kim gelirse gelsin, müşterinizi tanıyarak karşılarsınız.",
    icon: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm8-6h5m-5 4h5m-3 4h3",
    soon: true,
  },
];

const included = [
  "Salonunuza özel online randevu sayfası",
  "Personel bazında günlük takvim ve çalışma saatleri",
  "Hizmet, süre ve fiyat yönetimi",
  "Ciro ve prim raporları",
  "Sahip, yönetici, resepsiyon ve personel rolleri",
];

export default function Home() {
  const { contact } = site;

  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-10 border-b border-zinc-200/70 bg-background/85 backdrop-blur dark:border-zinc-800/70">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-6 px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <span
              aria-hidden="true"
              className="flex size-8 items-center justify-center rounded-lg bg-amber-700 text-white dark:bg-amber-500 dark:text-zinc-950"
            >
              <Icon path="M6 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm0 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM20 4 8.1 15.9M14.5 14.5 20 20M8.1 8.1 12 12" />
            </span>
            {site.name}
          </Link>
          <nav aria-label="Sayfa" className="hidden gap-8 text-sm text-zinc-600 md:flex dark:text-zinc-400">
            <a className="hover:text-foreground" href="#ozellikler">Özellikler</a>
            <a className="hover:text-foreground" href="#demo">Demo</a>
            <a className="hover:text-foreground" href="#fiyat">Fiyatlandırma</a>
            <a className="hover:text-foreground" href="#iletisim">İletişim</a>
          </nav>
          <Link
            href="/giris"
            className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            Giriş Yap
          </Link>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div
            aria-hidden="true"
            className="absolute inset-x-0 top-0 -z-10 h-[32rem] bg-gradient-to-b from-amber-100/70 to-transparent dark:from-amber-950/40"
          />
          <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[1.1fr_1fr]">
            <div>
              <p className={eyebrow}>Kuaför ve güzellik salonları için</p>
              <h1 className="mt-4 text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
                Salonunuzu Dijitalleştirin, Randevu ve Cironuzu Otomatik Yönetin
              </h1>
              <p className="mt-6 max-w-xl text-lg text-pretty text-zinc-600 dark:text-zinc-400">
                Müşterileriniz 7/24 online randevu alsın, takviminiz çakışmasız dolsun. Günün
                cirosunu ve personel primlerini defter tutmadan, tek ekrandan takip edin.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href={demoHref} className={primaryButton}>
                  Hemen Deneyin
                </Link>
                <Link href="/giris" className={secondaryButton}>
                  Giriş Yap
                </Link>
              </div>
              <p className="mt-4 text-sm text-zinc-500">
                Kurulum gerektirmez; telefon, tablet ve bilgisayarda çalışır.
              </p>
            </div>

            <PanelPreview />
          </div>
        </section>

        {/* Özellikler */}
        <section id="ozellikler" className="scroll-mt-20 py-16 sm:py-24">
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
            <p className={eyebrow}>Özellikler</p>
            <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              Randevudan kasaya, salonunuzun günlük işleyişi tek yerde
            </h2>
            <ul className="mt-12 grid gap-4 sm:grid-cols-2">
              {features.map((feature) => (
                <li
                  key={feature.title}
                  className="rounded-2xl border border-zinc-200 p-6 dark:border-zinc-800"
                >
                  <span
                    aria-hidden="true"
                    className="flex size-11 items-center justify-center rounded-xl bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                  >
                    <Icon path={feature.icon} />
                  </span>
                  <h3 className="mt-5 flex flex-wrap items-center gap-2 text-lg font-semibold">
                    {feature.title}
                    {feature.soon && (
                      <span className="rounded-full border border-zinc-300 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
                        Yakında
                      </span>
                    )}
                  </h3>
                  <p className="mt-2 text-pretty text-zinc-600 dark:text-zinc-400">
                    {feature.description}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Canlı demo */}
        <section id="demo" className="scroll-mt-20 px-4 sm:px-6">
          <div className="mx-auto grid w-full max-w-6xl items-center gap-10 rounded-3xl bg-zinc-900 px-6 py-12 text-zinc-50 sm:px-12 sm:py-16 lg:grid-cols-[1.2fr_1fr] dark:bg-zinc-900">
            <div>
              <p className="text-sm font-semibold tracking-wide text-amber-400 uppercase">
                Canlı demo
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
                Müşterinizin gözünden deneyin
              </h2>
              <p className="mt-4 max-w-lg text-pretty text-zinc-300">
                Örnek salonumuzda gerçek randevu akışını baştan sona deneyin. Müşterileriniz
                sizin salonunuzda tam olarak bu ekranı görecek.
              </p>
              <Link
                href={demoHref}
                className="mt-8 inline-flex items-center justify-center rounded-full bg-amber-500 px-6 py-3 font-medium text-zinc-950 transition-colors hover:bg-amber-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
              >
                Örnek salonda randevu al →
              </Link>
            </div>
            <ol className="space-y-4">
              {[
                ["Hizmet seçin", "Saç kesimi, sakal, boya; birden fazla hizmet birlikte."],
                ["Personel seçin", "İstediğiniz personel ya da “fark etmez”."],
                ["Gün ve saat seçin", "Yalnızca gerçekten boş olan saatler listelenir."],
                ["Onaylayın", "Ad ve telefonla randevu saniyeler içinde oluşur."],
              ].map(([title, description], index) => (
                <li key={title} className="flex gap-4">
                  <span
                    aria-hidden="true"
                    className="flex size-8 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-sm font-semibold text-amber-400 tabular-nums"
                  >
                    {index + 1}
                  </span>
                  <span>
                    <span className="block font-medium">{title}</span>
                    <span className="block text-sm text-zinc-400">{description}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Fiyatlandırma ve iletişim */}
        <section id="fiyat" className="scroll-mt-20 py-16 sm:py-24">
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
            <p className={eyebrow}>Fiyatlandırma</p>
            <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              Salonunuz için teklif alın
            </h2>

            <div className="mt-12 grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-zinc-200 p-8 dark:border-zinc-800">
                <h3 className="text-lg font-semibold">Pakete dahil olanlar</h3>
                {site.monthlyPrice ? (
                  <p className="mt-4">
                    <span className="text-4xl font-semibold tracking-tight tabular-nums">
                      {site.monthlyPrice}
                    </span>
                    <span className="text-zinc-500"> / ay</span>
                  </p>
                ) : (
                  <p className="mt-4 text-2xl font-semibold tracking-tight">
                    Salonunuza özel fiyat
                  </p>
                )}
                <p className="mt-2 text-sm text-zinc-500">
                  Fiyat bilgisi için bizimle iletişime geçin.
                </p>
                <ul className="mt-6 space-y-3">
                  {included.map((item) => (
                    <li key={item} className="flex gap-3">
                      <span aria-hidden="true" className="mt-0.5 text-amber-700 dark:text-amber-400">
                        <Icon path="M5 12l5 5 9-10" />
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
                <a href="#iletisim" className={`mt-8 ${primaryButton}`}>
                  Teklif alın
                </a>
              </div>

              <div
                id="iletisim"
                className="scroll-mt-20 rounded-2xl bg-zinc-100 p-8 dark:bg-zinc-900"
              >
                <h3 className="text-lg font-semibold">İletişim</h3>
                <p className="mt-2 text-pretty text-zinc-600 dark:text-zinc-400">
                  Sorularınız, fiyat teklifi ve salonunuzun kurulumu için bize ulaşın.
                </p>
                <ul className="mt-6 space-y-4">
                  {contact.email && (
                    <ContactRow label="E-posta" href={`mailto:${contact.email}`}>
                      {contact.email}
                    </ContactRow>
                  )}
                  {contact.phone && (
                    <ContactRow label="Telefon" href={`tel:${contact.phone.replace(/\s/g, "")}`}>
                      {contact.phone}
                    </ContactRow>
                  )}
                  {contact.whatsapp && (
                    <ContactRow label="WhatsApp" href={`https://wa.me/${contact.whatsapp}`}>
                      WhatsApp&apos;tan yazın
                    </ContactRow>
                  )}
                </ul>
                <p className="mt-8 text-sm text-zinc-500">
                  Zaten hesabınız var mı?{" "}
                  <Link href="/giris" className="font-medium text-foreground underline underline-offset-4">
                    Giriş yapın
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-8 text-sm text-zinc-500 sm:px-6">
          <p>
            <span className="font-medium text-foreground">{site.name}</span> — kuaför ve güzellik
            salonları için randevu ve yönetim.
          </p>
          <nav aria-label="Alt bilgi" className="flex flex-wrap gap-6">
            <a className="hover:text-foreground" href="#ozellikler">Özellikler</a>
            <Link className="hover:text-foreground" href={demoHref}>Demo</Link>
            <a className="hover:text-foreground" href="#fiyat">Fiyatlandırma</a>
            <a className="hover:text-foreground" href="#iletisim">İletişim</a>
            <Link className="hover:text-foreground" href="/giris">Giriş Yap</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

function Icon({ path }: { path: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={path} />
    </svg>
  );
}

function ContactRow({
  label,
  href,
  children,
}: {
  label: string;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <li>
      <span className="block text-xs font-medium text-zinc-500">{label}</span>
      <a href={href} className="text-lg font-medium underline-offset-4 hover:underline">
        {children}
      </a>
    </li>
  );
}

// Hero görseli: salon panelinin temsili, statik bir önizlemesi (örnek veriler).
const previewColumns = [
  {
    name: "Ahmet",
    blocks: [
      { top: 4, height: 22, label: "09:30 Saç kesimi", tone: "done" },
      { top: 34, height: 30, label: "11:00 Saç + sakal", tone: "booked" },
      { top: 74, height: 18, label: "14:30 Sakal", tone: "booked" },
    ],
  },
  {
    name: "Elif",
    blocks: [
      { top: 10, height: 38, label: "10:00 Boya", tone: "done" },
      { top: 56, height: 24, label: "13:00 Fön", tone: "booked" },
    ],
  },
  {
    name: "Mert",
    blocks: [
      { top: 20, height: 20, label: "10:30 Saç kesimi", tone: "booked" },
      { top: 48, height: 18, label: "12:30 Sakal", tone: "pending" },
      { top: 72, height: 22, label: "14:00 Saç kesimi", tone: "booked" },
    ],
  },
];

const previewTone: Record<string, string> = {
  done: "border-l-emerald-600 bg-emerald-50 dark:bg-emerald-950/60",
  booked: "border-l-blue-600 bg-blue-50 dark:bg-blue-950/60",
  pending: "border-l-amber-500 bg-amber-50 dark:bg-amber-950/60",
};

function PanelPreview() {
  return (
    <div
      aria-hidden="true"
      className="rounded-2xl border border-zinc-200 bg-background p-4 shadow-2xl shadow-amber-900/10 select-none sm:p-5 dark:border-zinc-800 dark:shadow-black/40"
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">Bugün</span>
        <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
          Örnek görünüm
        </span>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        {[
          ["Günün cirosu", "₺8.450"],
          ["Randevu", "14"],
          ["Günün primi", "₺2.110"],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
            <p className="truncate text-[11px] text-zinc-500">{label}</p>
            <p className="mt-0.5 text-lg font-semibold tracking-tight tabular-nums">{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        {previewColumns.map((column) => (
          <div key={column.name}>
            <p className="mb-1.5 text-xs font-medium">{column.name}</p>
            <div className="relative h-64 rounded-xl bg-zinc-50 dark:bg-zinc-900">
              {column.blocks.map((block) => (
                <div
                  key={block.label}
                  className={`absolute inset-x-1 overflow-hidden rounded-md border-l-4 px-1.5 py-1 text-[10px] leading-tight font-medium ${previewTone[block.tone]}`}
                  style={{ top: `${block.top}%`, height: `${block.height}%` }}
                >
                  {block.label}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
