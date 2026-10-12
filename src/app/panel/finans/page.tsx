import type { Metadata } from "next";
import { Suspense } from "react";

import { formatDay, formatMoney, monthRange, todayInZone } from "@/lib/format";
import {
  getBarberPerformance,
  getCommissionBalances,
  getSalonDashboard,
} from "@/lib/panel/queries";
import { firstParam, requireMembership } from "@/lib/panel/session";
import { isIsoDate } from "@/lib/panel/validation";

import {
  DateNav,
  NoAccess,
  PageHeader,
  PageSkeleton,
  StatTile,
  dayTitle,
} from "../_components/page-parts";
import { PayoutButton } from "./payout-button";

export const metadata: Metadata = {
  title: "Ciro ve prim raporları",
};

export default function FinancePage({ searchParams }: PageProps<"/panel/finans">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Finance searchParams={searchParams} />
    </Suspense>
  );
}

async function Finance({ searchParams }: Pick<PageProps<"/panel/finans">, "searchParams">) {
  const query = await searchParams;
  const { membership, isAdmin } = await requireMembership(query, "/panel/finans");
  if (!isAdmin) return <NoAccess />;

  const { salon_id: salonId, timezone, currency } = membership;
  const today = todayInZone(timezone);
  const requestedDay = firstParam(query.gun);
  const day = isIsoDate(requestedDay) ? requestedDay : today;
  const month = monthRange(day);

  const [daily, monthly, performance, balances] = await Promise.all([
    getSalonDashboard(salonId, { from: day, to: day }),
    getSalonDashboard(salonId, month),
    getBarberPerformance(salonId, month),
    getCommissionBalances(salonId),
  ]);
  if (!daily || !monthly) return <NoAccess />;

  const unpaidByBarber = new Map(balances.map((b) => [b.barber_id, b]));
  const money = (amount: number) => formatMoney(amount, currency);
  const monthLabel = formatDay(day, { month: "long", year: "numeric" });

  return (
    <>
      <PageHeader title="Ciro & Prim Raporları" description={dayTitle(day)}>
        <DateNav basePath="/panel/finans" membership={membership} day={day} today={today} />
      </PageHeader>

      <section className="mt-6">
        <h2 className="text-lg font-medium">Seçili gün</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile
            label="Günün cirosu"
            value={money(daily.revenue)}
            detail={`${daily.appointments.completed} randevu tamamlandı`}
          />
          <StatTile
            label="Beklenen ciro"
            value={money(daily.expected_revenue)}
            detail={`${daily.appointments.confirmed} onaylı randevu bekliyor`}
          />
          <StatTile
            label="Günün primi"
            value={money(daily.commission_total)}
            detail={`Net ${money(daily.revenue - daily.commission_total)}`}
          />
          <StatTile
            label="İptal / gelmedi"
            value={String(daily.appointments.cancelled + daily.appointments.no_show)}
            detail={`${daily.appointments.cancelled} iptal · ${daily.appointments.no_show} gelmedi`}
          />
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-medium">{monthLabel}</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile
            label="Aylık ciro"
            value={money(monthly.revenue)}
            detail={`${monthly.appointments.completed} randevu tamamlandı`}
          />
          <StatTile
            label="Aylık prim"
            value={money(monthly.commission_total)}
            detail={`Net ${money(monthly.revenue - monthly.commission_total)}`}
          />
          <StatTile
            label="Beklenen ciro"
            value={money(monthly.expected_revenue)}
            detail={`${monthly.appointments.confirmed} onaylı randevu bekliyor`}
          />
          <StatTile
            label="Yeni müşteri"
            value={String(monthly.new_customers)}
            detail={`${money(monthly.deposits_collected)} kapora tahsil edildi`}
          />
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-medium">Personel primleri</h2>
        <div className="mt-3 overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="text-left text-zinc-500">
              <tr className="border-b border-zinc-200 dark:border-zinc-800">
                <th scope="col" className="px-4 py-3 font-medium">Personel</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Tamamlanan</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Ciro (ay)</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Prim (ay)</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Ödenmemiş prim</th>
                <th scope="col" className="px-4 py-3">
                  <span className="sr-only">İşlem</span>
                </th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {performance.map((row) => {
                const unpaid = unpaidByBarber.get(row.barber_id)?.unpaid_amount ?? 0;
                return (
                  <tr
                    key={row.barber_id}
                    className="border-b border-zinc-100 last:border-0 dark:border-zinc-900"
                  >
                    <th scope="row" className="px-4 py-3 text-left font-medium">
                      {row.display_name}
                      {!row.is_active && (
                        <span className="ml-2 font-normal text-zinc-500">(pasif)</span>
                      )}
                    </th>
                    <td className="px-4 py-3 text-right">{row.completed_count}</td>
                    <td className="px-4 py-3 text-right">{money(row.revenue)}</td>
                    <td className="px-4 py-3 text-right">{money(row.commission)}</td>
                    <td className="px-4 py-3 text-right font-medium">{money(unpaid)}</td>
                    <td className="px-4 py-3 text-right">
                      {unpaid > 0 && (
                        <PayoutButton
                          salonId={salonId}
                          barberId={row.barber_id}
                          barberName={row.display_name}
                          amountLabel={money(unpaid)}
                        />
                      )}
                    </td>
                  </tr>
                );
              })}
              {performance.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">
                    Henüz personel eklenmemiş.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-zinc-500">
          Tamamlanan, ciro ve prim sütunları {monthLabel} içindir. Ödenmemiş prim, aydan bağımsız
          olarak bugüne kadar birikmiş tutardır.
        </p>
      </section>
    </>
  );
}
