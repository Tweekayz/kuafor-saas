import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { dayOfWeek, minutesInZone, timeToMinutes, todayInZone } from "@/lib/format";
import { getAgenda, getSalonBarbers, getWorkingHours } from "@/lib/panel/queries";
import { firstParam, requireMembership } from "@/lib/panel/session";
import { isIsoDate } from "@/lib/panel/validation";

import { DateNav, PageHeader, PageSkeleton, StatTile, dayTitle } from "./_components/page-parts";
import { DayCalendar, type CalendarAppointment, type CalendarColumn } from "./day-calendar";

export const metadata: Metadata = {
  title: "Genel bakış",
};

export default function OverviewPage({ searchParams }: PageProps<"/panel">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Overview searchParams={searchParams} />
    </Suspense>
  );
}

async function Overview({ searchParams }: Pick<PageProps<"/panel">, "searchParams">) {
  const query = await searchParams;
  const { membership, isAdmin } = await requireMembership(query, "/panel");
  const { salon_id: salonId, timezone, currency, role } = membership;
  const seesWholeSalon = role !== "barber";

  const today = todayInZone(timezone);
  const requestedDay = firstParam(query.gun);
  const day = isIsoDate(requestedDay) ? requestedDay : today;

  const [agenda, barbers, workingHours] = await Promise.all([
    getAgenda(salonId, { from: day, to: day }, { includeClosed: true }),
    getSalonBarbers(salonId),
    getWorkingHours(salonId, dayOfWeek(day)),
  ]);

  const appointments: CalendarAppointment[] = agenda.map((item) => ({
    ...item,
    startMin: minutesInZone(item.starts_at, timezone),
    endMin: minutesInZone(item.ends_at, timezone),
  }));

  // Sütunlar: aktif personel + o gün randevusu olan pasif personel. Personel
  // rolü yalnızca kendi randevularını görebildiği için tek sütun gösterilir.
  const hoursByBarber = new Map(workingHours.map((w) => [w.barber_id, w]));
  const busyBarbers = new Set(agenda.map((a) => a.barber_id));
  const columns: CalendarColumn[] = barbers
    .filter((b) =>
      seesWholeSalon ? b.is_active || busyBarbers.has(b.id) : b.id === membership.barber_id,
    )
    .map((b) => {
      const hours = hoursByBarber.get(b.id);
      return {
        id: b.id,
        name: b.display_name,
        workStart: hours ? timeToMinutes(hours.start_time) : null,
        workEnd: hours ? timeToMinutes(hours.end_time) : null,
      };
    });

  const count = (...statuses: string[]) =>
    agenda.filter((a) => statuses.includes(a.status)).length;
  const closedCount = count("cancelled", "no_show");

  return (
    <>
      <PageHeader title="Genel Bakış" description={dayTitle(day)}>
        <DateNav basePath="/panel" membership={membership} day={day} today={today} />
      </PageHeader>

      <section aria-label="Günün randevu özeti" className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Randevu" value={String(agenda.length - closedCount)} />
        <StatTile label="Tamamlanan" value={String(count("completed"))} />
        <StatTile
          label="Bekleyen"
          value={String(count("confirmed", "pending_payment"))}
          detail={
            count("pending_payment") > 0
              ? `${count("pending_payment")} randevu kapora bekliyor`
              : undefined
          }
        />
        <StatTile
          label="İptal / gelmedi"
          value={String(closedCount)}
          detail={closedCount > 0 ? `${count("cancelled")} iptal · ${count("no_show")} gelmedi` : undefined}
        />
      </section>

      <section aria-label="Günlük randevu takvimi" className="mt-6">
        <DayCalendar
          key={`${salonId}:${day}`}
          appointments={appointments}
          columns={columns}
          currency={currency}
          canReopen={seesWholeSalon}
        />
        {isAdmin && columns.length === 0 && (
          <p className="mt-3 text-sm">
            <Link href={`/panel/personel?salon=${membership.salon_slug}`} className="font-medium underline">
              Personel ekleyin
            </Link>{" "}
            ve çalışma saatlerini girin; takvim sütunları burada görünür.
          </p>
        )}
      </section>
    </>
  );
}
