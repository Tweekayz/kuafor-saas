import Link from "next/link";
import { Suspense } from "react";

import { addDays, formatDay, formatMoney, monthRange, todayInZone, zonedToIso } from "@/lib/format";
import { requireSupervisor } from "@/lib/supervisor/auth";
import { getPlatformStats } from "@/lib/supervisor/queries";
import { PLAN_LABEL, type PlanKey } from "@/lib/supervisor/types";
import { isVercelConfigured } from "@/lib/vercel";

import { PageHeader, PageSkeleton, StatTile } from "../panel/_components/page-parts";

/** Platform raporlarının takvim ayı bu saat dilimine göre hesaplanır. */
const PLATFORM_TIMEZONE = "Europe/Istanbul";

export default function SupervisorOverviewPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Overview />
    </Suspense>
  );
}

async function Overview() {
  await requireSupervisor("/supervisor");

  const today = todayInZone(PLATFORM_TIMEZONE);
  const month = monthRange(today);
  const stats = await getPlatformStats(
    zonedToIso(month.from, 0, PLATFORM_TIMEZONE),
    zonedToIso(addDays(month.to, 1), 0, PLATFORM_TIMEZONE),
  );

  // Kurulum denetimi: eksik olan her şey burada, teknik adıyla görünür.
  const checks: [string, boolean, string][] = [
    [
      "Veritabanı güncellemeleri",
      stats !== null,
      "supabase/migrations klasöründeki 20261013000000_business_modules.sql ve 20261014000000_supervisor.sql dosyalarını Supabase SQL Editor'de çalıştırın.",
    ],
    [
      "Barındırma (Vercel) API erişimi",
      isVercelConfigured(),
      "VERCEL_AUTH_TOKEN ve VERCEL_PROJECT_ID ortam değişkenlerini tanımlayın (takım projesiyse VERCEL_TEAM_ID). Tanımlı değilken domain onayı yapılamaz.",
    ],
    [
      "Kök alan adı (subdomain adresleri)",
      Boolean(process.env.NEXT_PUBLIC_ROOT_DOMAIN),
      "NEXT_PUBLIC_ROOT_DOMAIN değişkenini tanımlayın ve barındırmada wildcard alan adını (*.alanadiniz.com) ekleyin.",
    ],
  ];

  return (
    <>
      <PageHeader
        title="Genel Bakış"
        description={`${formatDay(today, { month: "long", year: "numeric" })} · platform geneli`}
      />

      {stats && (
        <>
          <section aria-label="Platform özeti" className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile
              label="Kayıtlı salon"
              value={String(stats.salons_total)}
              detail={`Bu ay ${stats.salons_new} yeni salon`}
            />
            <StatTile
              label="Aktif üyelik"
              value={String(stats.salons_active)}
              detail={`${stats.salons_total - stats.salons_active} dondurulmuş`}
            />
            <StatTile
              label="Bu ay oluşturulan randevu"
              value={String(stats.appointments_created)}
              detail={`${stats.appointments_completed} randevu tamamlandı`}
            />
            <StatTile
              label="Salonların bu ayki cirosu"
              value={formatMoney(stats.revenue, "TRY")}
              detail="Tamamlanan randevuların toplamı"
            />
          </section>

          <section className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {(Object.keys(PLAN_LABEL) as PlanKey[]).map((plan) => (
              <StatTile
                key={plan}
                label={`${PLAN_LABEL[plan]} paketi`}
                value={String(stats.plans[plan] ?? 0)}
                detail="salon"
              />
            ))}
            <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
              <p className="text-sm text-zinc-500">Bekleyen domain talebi</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{stats.domains_pending}</p>
              <Link
                href="/supervisor/domainler"
                className="mt-1 inline-block text-xs font-medium underline underline-offset-4"
              >
                Talepleri incele
              </Link>
            </div>
          </section>
          <p className="mt-2 text-xs text-zinc-500">
            Ciro, salonların müşterilerinden aldığı tutardır; platformun abonelik geliri
            değildir. Abonelik tahsilatı bu sistemde tutulmaz.
          </p>
        </>
      )}

      <section className="mt-10">
        <h2 className="text-lg font-medium">Sistem durumu</h2>
        <ul className="mt-3 divide-y divide-zinc-100 rounded-xl border border-zinc-200 text-sm dark:divide-zinc-900 dark:border-zinc-800">
          {checks.map(([label, ok, hint]) => (
            <li key={label} className="px-4 py-3">
              <p className="font-medium">
                <span aria-hidden="true">{ok ? "✓" : "⚠"}</span> {label}:{" "}
                {ok ? "hazır" : "eksik"}
              </p>
              {!ok && <p className="mt-1 text-zinc-500">{hint}</p>}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
