// Tarih, saat ve para biçimlendirme. Hem sunucu hem istemci bileşenlerinde
// kullanılır; saat dilimi her zaman açıkça verilir (salons.timezone), böylece
// sunucu ve tarayıcı aynı çıktıyı üretir.

const LOCALE = "tr-TR";

/** Verilen saat dilimindeki takvim günü, "YYYY-MM-DD". */
export function todayInZone(timeZone: string, now: Date = new Date()): string {
  return dateInZone(now, timeZone);
}

export function dateInZone(value: string | Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

/** Zaman damgasının salon saatine göre gün başından itibaren dakikası. */
export function minutesInZone(value: string | Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return get("hour") * 60 + get("minute");
}

/** "09:30:00" -> 570 */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/** 570 -> "09:30" */
export function minutesToLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function formatTime(value: string | Date, timeZone: string): string {
  return minutesToLabel(minutesInZone(value, timeZone));
}

export function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** 0 = Pazar (working_hours.day_of_week ile aynı). */
export function dayOfWeek(isoDate: string): number {
  return new Date(`${isoDate}T00:00:00Z`).getUTCDay();
}

/** Takvim gününün ayının ilk ve son günü. */
export function monthRange(isoDate: string): { from: string; to: string } {
  const [year, month] = isoDate.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const prefix = isoDate.slice(0, 8);
  return { from: `${prefix}01`, to: `${prefix}${String(lastDay).padStart(2, "0")}` };
}

/** Takvim gününü ("YYYY-MM-DD") biçimlendirir; saat dilimi kayması olmaz. */
export function formatDay(isoDate: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(LOCALE, { ...options, timeZone: "UTC" }).format(
    new Date(`${isoDate}T00:00:00Z`),
  );
}

export function formatMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat(LOCALE, {
    style: "currency",
    currency: currency.trim(),
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} dk`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} sa` : `${h} sa ${m} dk`;
}
