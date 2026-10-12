import type { Metadata } from "next";
import Link from "next/link";

import { ThemeToggle } from "@/components/theme";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: `${site.name} — Kuaför ve güzellik salonları için online randevu ve takip`,
  description:
    "Müşterileriniz günün her saati kendi randevusunu alsın. Takviminizi, günlük cironuzu ve personel primlerini tek ekrandan takip edin.",
};

const demoHref = `/randevu/${site.demoSalonSlug}`;

const primaryButton =
  "inline-flex items-center justify-center rounded-full bg-amber-700 px-6 py-3 font-medium text-white transition-colors hover:bg-amber-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 dark:bg-amber-500 dark:text-zinc-950 dark:hover:bg-amber-400";
const secondaryButton =
  "inline-flex items-center justify-center rounded-full border border-zinc-300 px-6 py-3 font-medium transition-colors hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 dark:border-zinc-700 dark:hover:bg-zinc-800 dark:focus-visible:outline-zinc-100";
const eyebrow = "text-sm font-semibold tracking-wide text-amber-700 uppercase dark:text-amber-400";
const sectionTitle = "mt-3 max-w-2xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl";
const muted = "text-pretty text-zinc-600 dark:text-zinc-400";
const container = "mx-auto w-full max-w-6xl px-4 sm:px-6";

const icons = {
  scissors:
    "M6 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm0 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM20 4 8.1 15.9M14.5 14.5 20 20M8.1 8.1 12 12",
  calendar:
    "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm4 10 2 2 4-4",
  clock: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Zm0-16v6l4 2",
  chart: "M3 3v18h18M7 15l4-4 3 3 5-6",
  card: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm8-6h5m-5 4h5m-3 4h3",
  check: "M5 12l5 5 9-10",
  phoneRinging:
    "M15 3a6 6 0 0 1 6 6M15 7a2 2 0 0 1 2 2M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z",
  overlap: "M3 5h12v10H3zM9 9h12v10H9z",
  calculator:
    "M6 2h12a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm2 4h8v3H8zM8 13h.01M12 13h.01M16 13h.01M8 17h.01M12 17h.01M16 17h.01",
  wallet:
    "M3 7a2 2 0 0 1 2-2h13v4M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V11a2 2 0 0 0-2-2H5a2 2 0 0 1-2-2Zm14 7h.01",
  mail: "M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm-1 1 9 7 9-7",
  phone:
    "M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z",
};

const problems = [
  {
    icon: icons.phoneRinging,
    title: "Eliniz makastayken telefon çalıyor",
    description:
      "Ya müşterinizi bekletip telefona bakıyorsunuz ya da aramayı kaçırıyorsunuz. Açılmayan her arama, başka salona gidebilecek bir müşteri.",
  },
  {
    icon: icons.overlap,
    title: "Defterde aynı saate iki isim",
    description:
      "Biri koltukta, diğeri kapıda bekliyor. Yanlışlıkla yazılan tek bir randevu, iki müşterinin de gününü bozuyor.",
  },
  {
    icon: icons.wallet,
    title: "“Bugün ne kazandık?” sorusu akşama kalıyor",
    description:
      "Günün cirosunu ancak dükkânı kapatıp defteri topladığınızda öğreniyorsunuz. Ay nasıl gidiyor, kimse tam bilmiyor.",
  },
  {
    icon: icons.calculator,
    title: "Ay sonunda prim hesabı",
    description:
      "Kim kaç iş yaptı, kime ne ödenecek? Defter, hesap makinesi ve çoğu zaman tatsız bir tartışma.",
  },
];

const flow = [
  {
    title: "Bağlantınızı paylaşırsınız",
    description:
      "Salonunuza özel randevu adresini Instagram profilinize, WhatsApp durumunuza ya da kartvizitinize koyarsınız.",
  },
  {
    title: "Müşteri randevusunu kendi alır",
    description:
      "Hizmeti, personeli ve boş saatlerden birini seçer; adını ve telefonunu yazar. Uygulama indirmez, üye olmaz.",
  },
  {
    title: "Randevu takviminize düşer",
    description:
      "O saat anında dolu görünür; başka kimse aynı saati alamaz. Siz yalnızca gelen müşteriyi karşılarsınız.",
  },
  {
    title: "İş bitince tek dokunuş",
    description:
      "Randevuyu “tamamlandı” olarak işaretlersiniz. Günün cirosu ve o işi yapan personelin primi kendiliğinden hesaplanır.",
  },
];

const features = [
  {
    title: "7/24 Online Randevu",
    description:
      "Salon kapalıyken de randevu defteriniz açık. Müşteriniz gece yarısı aklına geldiğinde bile, sizi aramadan yerini ayırır.",
    points: ["Uygulama ve üyelik gerekmez", "Birden fazla hizmet tek randevuda", "İsterse personelini kendi seçer"],
    icon: icons.calendar,
    soon: false,
  },
  {
    title: "Akıllı Slot ve Çakışma Önleme",
    description:
      "Müşteriye yalnızca gerçekten boş olan saatler gösterilir. Çalışma saatleriniz ve mevcut randevular hesaba katılır; aynı saate ikinci randevu yazılamaz.",
    points: ["Hizmet süresine göre saat hesabı", "Personele özel çalışma günleri", "Aynı anda iki kişi aynı saati alamaz"],
    icon: icons.clock,
    soon: false,
  },
  {
    title: "Personel Prim ve Ciro Takibi",
    description:
      "Tamamlanan her iş ciroya ve o personelin primine işlenir. Ay sonunu beklemeden kimin ne kadar hak ettiğini görürsünüz.",
    points: ["Günlük ve aylık ciro", "Personele özel prim oranı", "Ödenen primi tek tıkla işaretleme"],
    icon: icons.chart,
    soon: false,
  },
  {
    title: "Dijital Müşteri Kartı",
    description:
      "Müşterinizin ziyaret geçmişi, özel notları, alerjileri ve boya formülleri tek kartta. Kim karşılarsa karşılasın, müşterinizi tanıyarak karşılar.",
    points: ["Ziyaret ve harcama geçmişi", "Boya formülü kayıtları", "Personel notları"],
    icon: icons.card,
    soon: true,
  },
];

const comparison = [
  ["Randevu alma", "Telefonu açabildiğiniz saatlerde", "Günün her saati; müşteri kendi alır"],
  ["Çakışan randevu", "Müşteri kapıya gelince fark edilir", "Aynı saate ikinci randevu yazılamaz"],
  ["Günün cirosu", "Akşam, defter toplanınca", "Her an ekranınızda"],
  ["Prim hesabı", "Ay sonunda elle", "Tamamlanan her işte kendiliğinden"],
  ["Kim neyi görür", "Defteri açan her şeyi görür", "Personel kendi randevularını; ciroyu yalnızca siz"],
];

const setup = [
  ["Hizmetlerinizi girin", "Saç kesimi, sakal, boya… Her birinin süresini ve fiyatını yazın."],
  ["Personelinizi tanımlayın", "Kim hangi hizmeti veriyor, hangi gün ve saatlerde çalışıyor?"],
  ["Bağlantınızı paylaşın", "Randevu adresiniz hazır. Müşterileriniz o andan itibaren randevu alabilir."],
];

const faq = [
  [
    "Müşterilerim uygulama indirmek ya da üye olmak zorunda mı?",
    "Hayır. Randevu sayfanız telefonun tarayıcısında açılır. Müşteri yalnızca adını ve telefon numarasını yazar.",
  ],
  [
    "Telefonla arayan ya da kapıdan gelen müşteriyi nasıl kaydederim?",
    "Aynı randevu sayfasından müşteri adına siz randevu oluşturursunuz. Takvime düşer ve o saat online randevuya kapanır.",
  ],
  [
    "Bilgisayarım yok, telefondan kullanabilir miyim?",
    "Evet. Hem randevu sayfası hem salon paneli telefon, tablet ve bilgisayarda çalışır; kurulum gerekmez.",
  ],
  [
    "Personelim ciroyu ve diğerlerinin kazancını görür mü?",
    "Hayır. Personel hesabı yalnızca kendi randevularını görür. Ciro ve prim raporları salon sahibi ile yöneticiye açıktır.",
  ],
  [
    "Verilerimi başka salonlar görebilir mi?",
    "Hayır. Her salonun müşteri, randevu ve ciro verisi birbirinden ayrı tutulur; yalnızca o salonun ekibi erişebilir.",
  ],
];

const included = [
  "Salonunuza özel online randevu sayfası",
  "Personel bazında günlük takvim ve çalışma saatleri",
  "Hizmet, süre ve fiyat yönetimi",
  "Günlük ve aylık ciro, personel prim raporları",
  "Sahip, yönetici, resepsiyon ve personel rolleri",
];

export default function Home() {
  const { contact } = site;

  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-10 border-b border-zinc-200/70 bg-background/85 backdrop-blur dark:border-zinc-800/70">
        <div className={`${container} flex h-16 items-center justify-between gap-4`}>
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <span
              aria-hidden="true"
              className="flex size-8 items-center justify-center rounded-lg bg-amber-700 text-white dark:bg-amber-500 dark:text-zinc-950"
            >
              <Icon path={icons.scissors} />
            </span>
            {site.name}
          </Link>
          <nav
            aria-label="Sayfa"
            className="hidden gap-7 text-sm text-zinc-600 lg:flex dark:text-zinc-400"
          >
            <a className="hover:text-foreground" href="#nedir">Nasıl çalışır</a>
            <a className="hover:text-foreground" href="#ozellikler">Özellikler</a>
            <a className="hover:text-foreground" href="#demo">Demo</a>
            <a className="hover:text-foreground" href="#sorular">Sorular</a>
            <a className="hover:text-foreground" href="#fiyat">Fiyat ve iletişim</a>
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link
              href="/giris"
              className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              Giriş Yap
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div
            aria-hidden="true"
            className="absolute inset-x-0 top-0 -z-10 h-[34rem] bg-gradient-to-b from-amber-100/70 to-transparent dark:from-amber-950/40"
          />
          <div
            className={`${container} grid items-center gap-12 py-16 sm:py-24 lg:grid-cols-[1.1fr_1fr]`}
          >
            <div>
              <p className={eyebrow}>Kuaför, berber ve güzellik salonları için</p>
              <h1 className="mt-4 text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-[3.5rem] lg:leading-[1.08]">
                Salonunuzu Dijitalleştirin, Randevu ve Cironuzu Otomatik Yönetin
              </h1>
              <p className={`mt-6 max-w-xl text-lg ${muted}`}>
                Müşteriniz gece yarısı bile kendi randevusunu alır; siz telefona bakmak için
                makası bırakmazsınız. Bugün kim, saat kaçta, hangi personelde; kasaya ne girdi,
                kime ne kadar prim çıktı: hepsi tek ekranda.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href={demoHref} className={primaryButton}>
                  Hemen Deneyin
                </Link>
                <Link href="/giris" className={secondaryButton}>
                  Giriş Yap
                </Link>
              </div>
              <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-zinc-600 dark:text-zinc-400">
                {[
                  "Müşteri uygulama indirmez",
                  "Aynı saate iki randevu yazılamaz",
                  "Telefondan da yönetilir",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <span aria-hidden="true" className="text-amber-700 dark:text-amber-400">
                      <Icon path={icons.check} />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <PanelPreview />
          </div>
        </section>

        {/* Sorun */}
        <section className="py-16 sm:py-20">
          <div className={container}>
            <p className={eyebrow}>Tanıdık geldi mi?</p>
            <h2 className={sectionTitle}>Randevu defteri ve telefonla salon yönetmek yorucu</h2>
            <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {problems.map((problem) => (
                <li
                  key={problem.title}
                  className="rounded-2xl bg-zinc-100 p-6 dark:bg-zinc-900"
                >
                  <span aria-hidden="true" className="text-zinc-500">
                    <Icon path={problem.icon} />
                  </span>
                  <h3 className="mt-4 font-semibold text-balance">{problem.title}</h3>
                  <p className={`mt-2 text-sm ${muted}`}>{problem.description}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Nedir, nasıl çalışır */}
        <section id="nedir" className="scroll-mt-20 py-16 sm:py-20">
          <div className={`${container} grid gap-12 lg:grid-cols-[1fr_1.2fr]`}>
            <div>
              <p className={eyebrow}>Randevu ve takip sistemi nedir?</p>
              <h2 className={sectionTitle}>
                Randevu defteriniz, kasanız ve prim hesabınız tek yerde
              </h2>
              <p className={`mt-6 text-lg ${muted}`}>
                Kısaca: müşterileriniz randevularını internetten kendileri alır, siz de salonda
                olup biten her şeyi telefonunuzdan görürsünüz.
              </p>
              <p className={`mt-4 ${muted}`}>
                Deftere yazmak, telefonda saat aramak, akşam hesap toplamak yok. Randevu
                alındığı anda takviminizde, iş bittiği anda cironuzda görünür.
              </p>
            </div>
            <ol className="space-y-3">
              {flow.map((step, index) => (
                <li
                  key={step.title}
                  className="flex gap-4 rounded-2xl border border-zinc-200 p-5 dark:border-zinc-800"
                >
                  <span
                    aria-hidden="true"
                    className="flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-100 font-semibold text-amber-800 tabular-nums dark:bg-amber-950 dark:text-amber-300"
                  >
                    {index + 1}
                  </span>
                  <div>
                    <h3 className="font-semibold">{step.title}</h3>
                    <p className={`mt-1 text-sm ${muted}`}>{step.description}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Özellikler */}
        <section id="ozellikler" className="scroll-mt-20 py-16 sm:py-20">
          <div className={container}>
            <p className={eyebrow}>Özellikler</p>
            <h2 className={sectionTitle}>Siz işinize bakın, gerisini sistem takip etsin</h2>
            <ul className="mt-10 grid gap-4 sm:grid-cols-2">
              {features.map((feature) => (
                <li
                  key={feature.title}
                  className="rounded-2xl border border-zinc-200 p-6 sm:p-8 dark:border-zinc-800"
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
                  <p className={`mt-2 ${muted}`}>{feature.description}</p>
                  <ul className="mt-4 space-y-2 text-sm">
                    {feature.points.map((point) => (
                      <li key={point} className="flex items-center gap-2">
                        <span aria-hidden="true" className="text-amber-700 dark:text-amber-400">
                          <Icon path={icons.check} />
                        </span>
                        {point}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Karşılaştırma */}
        <section className="py-16 sm:py-20">
          <div className={container}>
            <p className={eyebrow}>Neden kullanmalısınız?</p>
            <h2 className={sectionTitle}>Defterle aynı iş, çok daha az uğraş</h2>
            <div className="mt-10 overflow-x-auto rounded-2xl border border-zinc-200 dark:border-zinc-800">
              <table className="w-full min-w-[640px] text-left">
                <thead>
                  <tr className="border-b border-zinc-200 text-sm dark:border-zinc-800">
                    <th scope="col" className="px-5 py-4 font-medium text-zinc-500">
                      <span className="sr-only">Konu</span>
                    </th>
                    <th scope="col" className="px-5 py-4 font-medium text-zinc-500">
                      Defter ve telefonla
                    </th>
                    <th
                      scope="col"
                      className="bg-amber-50 px-5 py-4 font-semibold dark:bg-amber-950/40"
                    >
                      {site.name} ile
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.map(([topic, before, after]) => (
                    <tr
                      key={topic}
                      className="border-b border-zinc-100 last:border-0 dark:border-zinc-900"
                    >
                      <th scope="row" className="px-5 py-4 font-medium">
                        {topic}
                      </th>
                      <td className="px-5 py-4 text-zinc-600 dark:text-zinc-400">{before}</td>
                      <td className="bg-amber-50 px-5 py-4 font-medium dark:bg-amber-950/40">
                        {after}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Canlı demo */}
        <section id="demo" className="scroll-mt-20 px-4 py-8 sm:px-6">
          <div className="mx-auto grid w-full max-w-6xl items-center gap-10 rounded-3xl bg-zinc-900 px-6 py-12 text-zinc-50 sm:px-12 sm:py-16 lg:grid-cols-[1.2fr_1fr] dark:border dark:border-zinc-800">
            <div>
              <p className="text-sm font-semibold tracking-wide text-amber-400 uppercase">
                Canlı demo
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
                Anlatmak yerine gösterelim
              </h2>
              <p className="mt-4 max-w-lg text-pretty text-zinc-300">
                Örnek salonumuzda bir randevu alın. Bir dakikanızı alır; müşterileriniz sizin
                salonunuzda tam olarak bu ekranı görecek.
              </p>
              <Link
                href={demoHref}
                className="mt-8 inline-flex items-center justify-center rounded-full bg-amber-500 px-6 py-3 font-medium text-zinc-950 transition-colors hover:bg-amber-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
              >
                Örnek salonda randevu al →
              </Link>
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-400">Kendi salonunuz için üç adım</p>
              <ol className="mt-4 space-y-4">
                {setup.map(([title, description], index) => (
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
          </div>
        </section>

        {/* Sık sorulanlar */}
        <section id="sorular" className="scroll-mt-20 py-16 sm:py-20">
          <div className={`${container} grid gap-10 lg:grid-cols-[1fr_1.6fr]`}>
            <div>
              <p className={eyebrow}>Sık sorulanlar</p>
              <h2 className={sectionTitle}>Aklınıza takılanlar</h2>
            </div>
            <div className="divide-y divide-zinc-200 border-y border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
              {faq.map(([question, answer]) => (
                <details key={question} className="group py-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium [&::-webkit-details-marker]:hidden">
                    {question}
                    <span
                      aria-hidden="true"
                      className="text-xl text-zinc-400 transition-transform group-open:rotate-45"
                    >
                      +
                    </span>
                  </summary>
                  <p className={`mt-3 ${muted}`}>{answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Fiyat ve iletişim */}
        <section id="fiyat" className="scroll-mt-20 pb-16 sm:pb-24">
          <div className={container}>
            <p className={eyebrow}>Fiyat ve iletişim</p>
            <h2 className={sectionTitle}>Salonunuzu birlikte konuşalım</h2>

            <div className="mt-10 grid gap-4 lg:grid-cols-2">
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
                  Fiyat bilgisi için bize yazın ya da arayın.
                </p>
                <ul className="mt-6 space-y-3">
                  {included.map((item) => (
                    <li key={item} className="flex gap-3">
                      <span aria-hidden="true" className="mt-0.5 text-amber-700 dark:text-amber-400">
                        <Icon path={icons.check} />
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div
                id="iletisim"
                className="scroll-mt-20 rounded-2xl bg-zinc-100 p-8 dark:bg-zinc-900"
              >
                <h3 className="text-lg font-semibold">Bize ulaşın</h3>
                <p className={`mt-2 ${muted}`}>
                  Sorularınız, fiyat teklifi ve salonunuzun kurulumu için size en uygun yoldan
                  yazın.
                </p>
                <ul className="mt-6 space-y-3">
                  {contact.whatsapp && (
                    <ContactRow
                      label="WhatsApp"
                      href={`https://wa.me/${contact.whatsapp}`}
                      tone="bg-emerald-600 text-white"
                      icon={<WhatsAppIcon />}
                    >
                      WhatsApp&apos;tan yazın
                    </ContactRow>
                  )}
                  {contact.phone && (
                    <ContactRow
                      label="Telefon"
                      href={`tel:${contact.phone.replace(/\s/g, "")}`}
                      tone="bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                      icon={<Icon path={icons.phone} />}
                    >
                      {contact.phone}
                    </ContactRow>
                  )}
                  {contact.email && (
                    <ContactRow
                      label="E-posta"
                      href={`mailto:${contact.email}`}
                      tone="bg-amber-700 text-white dark:bg-amber-500 dark:text-zinc-950"
                      icon={<Icon path={icons.mail} />}
                    >
                      {contact.email}
                    </ContactRow>
                  )}
                </ul>
                <p className="mt-8 text-sm text-zinc-500">
                  Zaten hesabınız var mı?{" "}
                  <Link
                    href="/giris"
                    className="font-medium text-foreground underline underline-offset-4"
                  >
                    Giriş yapın
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-zinc-200 dark:border-zinc-800">
        <div
          className={`${container} flex flex-wrap items-center justify-between gap-4 py-8 text-sm text-zinc-500`}
        >
          <p>
            <span className="font-medium text-foreground">{site.name}</span> — kuaför, berber ve
            güzellik salonları için online randevu ve takip.
          </p>
          <nav aria-label="Alt bilgi" className="flex flex-wrap gap-6">
            <a className="hover:text-foreground" href="#ozellikler">Özellikler</a>
            <Link className="hover:text-foreground" href={demoHref}>Demo</Link>
            <a className="hover:text-foreground" href="#sorular">Sorular</a>
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

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path
        d="M12 3a9 9 0 0 0-7.7 13.6L3 21l4.5-1.2A9 9 0 1 0 12 3Z"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M9.2 7.8c-.3 0-.7.1-.9.5-.4.6-.7 1.300-.5 2.200.4 1.600 1.800 3.500 3.900 4.700 1.100.6 2.100.8 2.900.5.6-.2 1.100-.7 1.300-1.300.1-.3 0-.6-.3-.7l-1.700-.8c-.3-.1-.6 0-.7.2l-.5.7c-.1.2-.4.2-.6.1-1-.5-1.800-1.300-2.300-2.300-.1-.2 0-.4.1-.6l.6-.6c.2-.2.2-.4.1-.7l-.7-1.600c-.1-.2-.4-.3-.7-.3Z"
        fill="currentColor"
      />
    </svg>
  );
}

function ContactRow({
  label,
  href,
  tone,
  icon,
  children,
}: {
  label: string;
  href: string;
  /** Simge kutusunun arka plan ve yazı rengi sınıfları. */
  tone: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <li>
      <a
        href={href}
        className="group flex items-center gap-4 rounded-xl bg-background p-3 transition-shadow hover:shadow-md"
      >
        <span
          aria-hidden="true"
          className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${tone}`}
        >
          {icon}
        </span>
        <span className="min-w-0">
          <span className="block text-xs font-medium text-zinc-500">{label}</span>
          <span className="block truncate font-medium underline-offset-4 group-hover:underline">
            {children}
          </span>
        </span>
      </a>
    </li>
  );
}

// Hero görseli: salon panelindeki günlük akışın temsili, statik bir önizlemesi
// (örnek veriler). Görünüm src/app/panel/day-calendar.tsx ile aynı dildedir.
type PreviewEntry =
  | { kind: "done"; time: string; name: string; price: string }
  | { kind: "card"; time: string; end: string; name: string; service: string; price: string; now?: boolean }
  | { kind: "gap"; label: string };

const previewLanes: { name: string; hours: string; count: number; occupancy: number; entries: PreviewEntry[] }[] = [
  {
    name: "Ahmet",
    hours: "09:00 – 19:00",
    count: 6,
    occupancy: 70,
    entries: [
      { kind: "done", time: "09:30", name: "Kerem A.", price: "₺500" },
      { kind: "card", time: "11:00", end: "11:45", name: "Burak T.", service: "Saç + sakal", price: "₺750", now: true },
      { kind: "gap", label: "Boş · 11:45 – 12:30" },
      { kind: "card", time: "12:30", end: "13:00", name: "Emre K.", service: "Saç kesimi", price: "₺500" },
    ],
  },
  {
    name: "Elif",
    hours: "10:00 – 18:00",
    count: 4,
    occupancy: 55,
    entries: [
      { kind: "done", time: "10:00", name: "Zeynep D.", price: "₺1.800" },
      { kind: "gap", label: "Boş · 11:30 – 13:00" },
      { kind: "card", time: "13:00", end: "13:40", name: "Selin Y.", service: "Fön", price: "₺400" },
      { kind: "card", time: "14:00", end: "16:00", name: "Ayşe G.", service: "Boya", price: "₺1.800" },
    ],
  },
];

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
          ["Randevu", "10"],
          ["Günün primi", "₺2.110"],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
            <p className="truncate text-[11px] text-zinc-500">{label}</p>
            <p className="mt-0.5 text-lg font-semibold tracking-tight tabular-nums">{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        {previewLanes.map((lane) => (
          <div
            key={lane.name}
            className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-2.5 dark:border-zinc-800 dark:bg-zinc-900/40"
          >
            <div className="flex items-center gap-2">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-[11px] font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900">
                {lane.name.charAt(0)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-semibold">{lane.name}</span>
                <span className="block text-[10px] text-zinc-500 tabular-nums">{lane.hours}</span>
              </span>
              <span className="text-sm font-semibold tabular-nums">{lane.count}</span>
            </div>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
              <div
                className="h-full rounded-full bg-zinc-900 dark:bg-zinc-100"
                style={{ width: `${lane.occupancy}%` }}
              />
            </div>

            <div className="mt-2.5 space-y-1.5">
              {lane.entries.map((entry) =>
                entry.kind === "done" ? (
                  <div
                    key={entry.time}
                    className="flex items-center gap-1.5 px-1 text-[10px] text-zinc-500"
                  >
                    <span className="size-1.5 rounded-full bg-emerald-600" />
                    <span className="tabular-nums">{entry.time}</span>
                    <span className="min-w-0 flex-1 truncate">{entry.name}</span>
                    <span className="tabular-nums">{entry.price}</span>
                  </div>
                ) : entry.kind === "gap" ? (
                  <div
                    key={entry.label}
                    className="rounded-lg border border-dashed border-zinc-300 px-2 py-1 text-[10px] text-zinc-500 tabular-nums dark:border-zinc-700"
                  >
                    {entry.label}
                  </div>
                ) : (
                  <div
                    key={entry.time}
                    className={`flex gap-2 rounded-lg border bg-background p-2 ${
                      entry.now
                        ? "border-blue-600 ring-1 ring-blue-600"
                        : "border-zinc-200 dark:border-zinc-800"
                    }`}
                  >
                    <span className="shrink-0 tabular-nums">
                      <span className="block text-[11px] font-semibold">{entry.time}</span>
                      <span className="block text-[9px] text-zinc-500">{entry.end}</span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex justify-between gap-1 text-[11px] font-medium">
                        <span className="truncate">{entry.name}</span>
                        <span className="tabular-nums">{entry.price}</span>
                      </span>
                      <span className="block truncate text-[10px] text-zinc-500">
                        {entry.service}
                      </span>
                      <span className="mt-1 inline-flex items-center gap-1 rounded-full border border-zinc-200 px-1.5 py-px text-[9px] font-medium dark:border-zinc-700">
                        <span className="size-1 rounded-full bg-blue-600" />
                        {entry.now ? "Şimdi koltukta" : "Onaylı"}
                      </span>
                    </span>
                  </div>
                ),
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
