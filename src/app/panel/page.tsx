import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import {
  addDays,
  dateInZone,
  dayOfWeek,
  formatDay,
  minutesInZone,
  timeToMinutes,
  todayInZone,
} from "@/lib/format";
import { getAgenda, getSalonBarbers, getWorkingHours } from "@/lib/panel/queries";
import { firstParam, requireMembership } from "@/lib/panel/session";
import { isIsoDate } from "@/lib/panel/validation";
import { firstOpenDay, type WeeklyHours } from "@/lib/schedule";

import { DateNav, PageHeader, PageSkeleton, StatTile, dayTitle } from "./_components/page-parts";
import { DayCalendar, type CalendarAppointment, type CalendarColumn } from "./day-calendar";
import { WeekBoard, type WeekAppointment } from "./week-board";

export const metadata: Metadata = {
  title: "Takvim ve randevular",
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
  const { salon_id: salonId, salon_slug: slug, timezone, currency, role } = membership;
  const seesWholeSalon = role !== "barber";
  const weekView = firstParam(query.gorunum) === "hafta";

  const [barbers, workingHours] = await Promise.all([
    getSalonBarbers(salonId),
    getWorkingHours(salonId),
  ]);

  // Personel bazında haftalık mesai (dakika); salonun kapanışı bunlardan türetilir.
  const weekly = new Map<string, WeeklyHours>();
  for (const row of workingHours) {
    const hours = weekly.get(row.barber_id) ?? {};
    hours[row.day_of_week] = {
      start: timeToMinutes(row.start_time),
      end: timeToMinutes(row.end_time),
    };
    weekly.set(row.barber_id, hours);
  }

  // Gün seçilmediyse: kapanış saati geçtiyse ya da bugün kapalıysa bir sonraki
  // çalışma günü gösterilir.
  const today = todayInZone(timezone);
  const nowMin = minutesInZone(new Date(), timezone);
  const requestedDay = firstParam(query.gun);
  const defaultDay = firstOpenDay(today, nowMin, [...weekly.values()]);
  const day = isIsoDate(requestedDay) ? requestedDay : defaultDay;
  const shifted = !isIsoDate(requestedDay) && defaultDay !== today;

  const monday = addDays(day, -((dayOfWeek(day) + 6) % 7));
  const range = weekView ? { from: monday, to: addDays(monday, 6) } : { from: day, to: day };
  const agenda = await getAgenda(salonId, range, { includeClosed: !weekView });

  const viewLink = (view: "gun" | "hafta") =>
    `/panel?${new URLSearchParams({ salon: slug, gun: day, ...(view === "hafta" ? { gorunum: "hafta" } : {}) })}`;

  const header = (
    <PageHeader
      title="Takvim & Randevular"
      description={
        weekView
          ? `${formatDay(range.from, { day: "numeric", month: "long" })} – ${formatDay(range.to, { day: "numeric", month: "long", year: "numeric" })}`
          : dayTitle(day)
      }
    >
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg border border-zinc-300 p-0.5 text-sm dark:border-zinc-700">
          {(["gun", "hafta"] as const).map((view) => (
            <Link
              key={view}
              href={viewLink(view)}
              aria-current={(view === "hafta") === weekView ? "page" : undefined}
              className="rounded-md px-3 py-1 font-medium aria-[current]:bg-zinc-900 aria-[current]:text-white dark:aria-[current]:bg-zinc-100 dark:aria-[current]:text-zinc-900"
            >
              {view === "gun" ? "Gün" : "Hafta"}
            </Link>
          ))}
        </div>
        <DateNav
          basePath="/panel"
          membership={membership}
          day={day}
          today={today}
          step={weekView ? 7 : 1}
          params={weekView ? { gorunum: "hafta" } : {}}
        />
      </div>
    </PageHeader>
  );

  if (weekView) {
    const appointments: WeekAppointment[] = agenda.map((item) => ({
      appointment_id: item.appointment_id,
      customer_name: item.customer_name,
      barber_name: item.barber_name,
      status: item.status,
      day: dateInZone(item.starts_at, timezone),
      startMin: minutesInZone(item.starts_at, timezone),
    }));
    return (
      <>
        {header}
        <section aria-label="Haftalık randevular" className="mt-6">
          <WeekBoard
            key={`${salonId}:${monday}`}
            days={Array.from({ length: 7 }, (_, i) => addDays(monday, i))}
            today={today}
            appointments={appointments}
            timezone={timezone}
            salonSlug={slug}
            canMove={seesWholeSalon || membership.barber_id !== null}
          />
        </section>
      </>
    );
  }

  const appointments: CalendarAppointment[] = agenda.map((item) => ({
    ...item,
    startMin: minutesInZone(item.starts_at, timezone),
    endMin: minutesInZone(item.ends_at, timezone),
  }));

  // Şeritler: aktif personel + o gün randevusu olan pasif personel. Personel
  // rolü yalnızca kendi randevularını görebildiği için tek şerit gösterilir.
  const weekday = dayOfWeek(day);
  const busyBarbers = new Set(agenda.map((a) => a.barber_id));
  const columns: CalendarColumn[] = barbers
    .filter((b) =>
      seesWholeSalon ? b.is_active || busyBarbers.has(b.id) : b.id === membership.barber_id,
    )
    .map((b) => {
      const hours = weekly.get(b.id)?.[weekday];
      return {
        id: b.id,
        name: b.display_name,
        workStart: hours?.start ?? null,
        workEnd: hours?.end ?? null,
      };
    });

  const count = (...statuses: string[]) =>
    agenda.filter((a) => statuses.includes(a.status)).length;
  const closedCount = count("cancelled", "no_show");

  return (
    <>
      {header}

      {shifted && (
        <p className="mt-4 rounded-lg bg-zinc-100 px-4 py-3 text-sm dark:bg-zinc-900">
          Bugünün mesaisi sona erdi; bir sonraki çalışma günü gösteriliyor.{" "}
          <Link
            href={`/panel?${new URLSearchParams({ salon: slug, gun: today })}`}
            className="font-medium underline underline-offset-4"
          >
            Bugünü göster
          </Link>
        </p>
      )}

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
          timezone={timezone}
          day={day}
          canReopen={seesWholeSalon}
          nowMin={day < today ? 24 * 60 : day > today ? -1 : nowMin}
        />
        {isAdmin && columns.length === 0 && (
          <p className="mt-3 text-sm">
            <Link href={`/panel/personel?salon=${slug}`} className="font-medium underline">
              Personel ekleyin
            </Link>{" "}
            ve çalışma saatlerini girin; personel şeritleri burada görünür.
          </p>
        )}
      </section>
    </>
  );
}
