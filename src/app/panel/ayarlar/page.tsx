import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { getBookingRules, getCustomDomain } from "@/lib/business/queries";
import { getPanelContext } from "@/lib/panel/queries";
import { firstParam, isAdminRole } from "@/lib/panel/session";
import { getSalonProfile } from "@/lib/settings/queries";

import { MigrationNotice, NoAccess, PageHeader, PageSkeleton } from "../_components/page-parts";
import { SalonForm } from "./salon-form";
import { BookingRulesForm, CustomDomainForm } from "./settings-forms";

export const metadata: Metadata = {
  title: "Salon ayarları",
};

/** Uygulamanın kök alan adı (örn. "saasdomain.com"); salon adresleri bunun alt alan adıdır. */
const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN;

export default function SettingsPage({ searchParams }: PageProps<"/panel/ayarlar">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Settings searchParams={searchParams} />
    </Suspense>
  );
}

async function Settings({ searchParams }: Pick<PageProps<"/panel/ayarlar">, "searchParams">) {
  const [context, query] = await Promise.all([getPanelContext(), searchParams]);
  if (!context) redirect("/giris?next=/panel/ayarlar");

  // İlk kurulum: kullanıcının henüz salonu yok.
  if (context.memberships.length === 0) {
    return (
      <div className="max-w-md">
        <PageHeader
          title="Salonunuzu oluşturun"
          description="Ardından hizmetlerinizi, personelinizi ve çalışma saatlerini ekleyebilirsiniz."
        />
        <div className="mt-6">
          <SalonForm />
        </div>
      </div>
    );
  }

  const slug = firstParam(query.salon);
  const membership =
    context.memberships.find((m) => m.salon_slug === slug) ?? context.memberships[0];
  if (!isAdminRole(membership)) return <NoAccess />;

  const [salon, rules, customDomain] = await Promise.all([
    getSalonProfile(membership.salon_id),
    getBookingRules(membership.salon_id),
    getCustomDomain(membership.salon_id),
  ]);
  if (!salon) return <NoAccess />;

  const card = "rounded-2xl border border-zinc-200 p-6 dark:border-zinc-800";

  return (
    <div className="max-w-xl">
      <PageHeader
        title="Salon Ayarları"
        description="Salon bilgileri, randevu kuralları ve yayın adresi."
      />

      <section className={`mt-6 ${card}`}>
        <h2 className="mb-4 text-lg font-medium">Salon bilgileri</h2>
        <SalonForm salon={salon} />
      </section>

      {rules && (
        <section className={`mt-6 ${card}`}>
          <h2 className="text-lg font-medium">Randevu kuralları</h2>
          <p className="mt-1 mb-4 text-sm text-zinc-500">
            Çalışma saatleri, mola ve izinler personel bazındadır;{" "}
            <Link
              href={`/panel/personel?salon=${salon.slug}`}
              className="font-medium underline underline-offset-4"
            >
              Personel Yönetimi
            </Link>{" "}
            sayfasından girilir.
          </p>
          <BookingRulesForm salonId={salon.id} rules={rules} />
        </section>
      )}

      <section className={`mt-6 ${card}`}>
        <h2 className="text-lg font-medium">Domain ve Yayınlama Ayarları</h2>

        <dl className="mt-4 space-y-3 text-sm">
          <div>
            <dt className="text-zinc-500">Adres takınız (slug)</dt>
            <dd className="font-mono font-medium">{salon.slug}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Randevu sayfanız</dt>
            <dd>
              <Link
                href={`/randevu/${salon.slug}`}
                target="_blank"
                className="font-medium underline underline-offset-4"
              >
                /randevu/{salon.slug}
              </Link>
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">Size özel alt alan adı</dt>
            <dd>
              {ROOT_DOMAIN ? (
                <a
                  href={`https://${salon.slug}.${ROOT_DOMAIN}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium underline underline-offset-4"
                >
                  {salon.slug}.{ROOT_DOMAIN}
                </a>
              ) : (
                <span className="text-zinc-500">
                  Henüz etkin değil: platformun kök alan adı tanımlanmamış.
                </span>
              )}
            </dd>
          </div>
        </dl>

        <div className="mt-6 border-t border-zinc-200 pt-6 dark:border-zinc-800">
          {customDomain === undefined ? (
            <MigrationNotice feature="Özel alan adı" />
          ) : (
            <>
              <CustomDomainForm salonId={salon.id} domain={customDomain} />
              <div className="mt-4 rounded-lg bg-zinc-100 p-4 text-sm dark:bg-zinc-900">
                <p className="font-medium">Alan adınızı bağlamak için</p>
                <ol className="mt-2 list-inside list-decimal space-y-1">
                  <li>Alan adınızı yukarıya yazıp kaydedin.</li>
                  <li>
                    Alan adınızı aldığınız firmanın DNS panelinde şu kaydı ekleyin:
                    <span className="mt-1 block font-mono text-xs">
                      Tür: CNAME · Ad: randevu · Değer: cname.vercel-dns.com
                    </span>
                  </li>
                  <li>
                    Platform yöneticisi aynı alan adını Vercel projesine eklemelidir (Project →
                    Settings → Domains). Bu adım yapılmadan adres açılmaz.
                  </li>
                </ol>
                <p className="mt-2 text-xs text-zinc-500">
                  DNS değişikliğinin yayılması birkaç saat sürebilir. SSL sertifikası Vercel
                  tarafından kendiliğinden oluşturulur.
                </p>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
