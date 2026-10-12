import { addDays, dayOfWeek } from "@/lib/format";

// Salonun açık olduğu günler ve kapanış saati. Salonun kendine ait bir mesai
// kaydı yoktur; personellerin çalışma saatlerinin birleşimi kullanılır.

/** Bir personelin haftalık mesaisi: anahtar 0 = Pazar, değerler gün içi dakika. */
export type WeeklyHours = Record<number, { start: number; end: number }>;

/** O hafta gününde salonun kapanışı (en geç biten mesai); kimse çalışmıyorsa null. */
export function closingMinute(staff: WeeklyHours[], weekday: number): number | null {
  const ends = staff.flatMap((hours) => (hours[weekday] ? [hours[weekday].end] : []));
  return ends.length > 0 ? Math.max(...ends) : null;
}

/**
 * Varsayılan olarak gösterilecek gün: bugün hâlâ açıksa bugün; kapanış saati
 * geçtiyse ya da bugün kapalıysa bir sonraki çalışma günü. Hiç mesai
 * tanımlı değilse bugün döner.
 */
export function firstOpenDay(
  today: string,
  nowMin: number,
  staff: WeeklyHours[],
  maxDaysAhead = 14,
): string {
  for (let offset = 0; offset <= maxDaysAhead; offset++) {
    const day = addDays(today, offset);
    const closing = closingMinute(staff, dayOfWeek(day));
    if (closing === null) continue;
    if (offset === 0 && nowMin >= closing) continue;
    return day;
  }
  return today;
}

/** Salonun kapalı olduğu hafta günleri (0 = Pazar). */
export function closedWeekdays(staff: WeeklyHours[]): number[] {
  return [0, 1, 2, 3, 4, 5, 6].filter((weekday) => closingMinute(staff, weekday) === null);
}
