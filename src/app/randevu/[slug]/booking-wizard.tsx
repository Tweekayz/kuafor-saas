"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import { ConsultationBox } from "@/components/consultation-box";
import { createBooking } from "@/lib/booking/actions";
import type { BookingConfirmation, SalonCatalog } from "@/lib/booking/types";
import {
  addDays,
  dayOfWeek,
  formatDay,
  formatDuration,
  formatMoney,
  formatTime,
} from "@/lib/format";
import { createClient } from "@/lib/supabase/browser";

const ANY_BARBER = "any";
const MAX_DAYS_SHOWN = 90;

type SlotsResult = { key: string; slots: string[]; failed: boolean };
type SectionRef = React.RefObject<HTMLElement | null>;

const primaryButton =
  "rounded-full bg-zinc-900 px-6 py-3 font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300";
const optionBase =
  "w-full rounded-xl border p-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 dark:focus-visible:outline-zinc-100";
const optionIdle =
  "border-zinc-200 hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600";
const optionSelected =
  "border-zinc-900 bg-zinc-50 ring-1 ring-zinc-900 dark:border-zinc-100 dark:bg-zinc-900 dark:ring-zinc-100";
const inputClass =
  "mt-1 w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2.5 outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 dark:border-zinc-700 dark:focus:border-zinc-100 dark:focus:ring-zinc-100";

/** Bölüme yumuşakça kaydırır ve başlığına odaklanır (hareket azaltma tercihine uyar). */
function scrollToSection(ref: SectionRef) {
  requestAnimationFrame(() => {
    const section = ref.current;
    if (!section) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    section.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    section.querySelector<HTMLElement>("h2")?.focus({ preventScroll: true });
  });
}

export function BookingWizard({
  catalog,
  today,
  initialDate,
  closedWeekdays,
  extrasEnabled,
  aiAvailable,
}: {
  catalog: SalonCatalog;
  /** Görsel danışma bu kurulumda etkin mi (veritabanı güncellemesi uygulanmış mı). */
  extrasEnabled: boolean;
  aiAvailable: boolean;
  today: string;
  /** Varsayılan gün: bugün kapandıysa bir sonraki çalışma günü. */
  initialDate: string;
  /** Salonun kapalı olduğu hafta günleri (0 = Pazar). */
  closedWeekdays: number[];
}) {
  const { salon, services, barbers } = catalog;

  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [chosenBarber, setChosenBarber] = useState<string | null>(null);
  const [date, setDate] = useState(initialDate);
  const [startsAt, setStartsAt] = useState<string | null>(null);
  const [slotsResult, setSlotsResult] = useState<SlotsResult | null>(null);
  const [reloadCount, setReloadCount] = useState(0);
  const [form, setForm] = useState({ name: "", phone: "", email: "", note: "", website: "" });
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<BookingConfirmation | null>(null);
  const [isPending, startTransition] = useTransition();

  const barberRef = useRef<HTMLElement>(null);
  const timeRef = useRef<HTMLElement>(null);
  const infoRef = useRef<HTMLElement>(null);

  const eligibleFor = (ids: string[]) => barbers.filter((b) => ids.every((id) => id in b.services));
  const selectedServices = services.filter((s) => serviceIds.includes(s.id));
  const eligibleBarbers = eligibleFor(serviceIds);
  // Tek uygun personel varsa seçim yapmaya gerek yok.
  const barberChoice =
    serviceIds.length > 0 && eligibleBarbers.length === 1 ? eligibleBarbers[0].id : chosenBarber;
  const barber =
    barberChoice && barberChoice !== ANY_BARBER
      ? (barbers.find((b) => b.id === barberChoice) ?? null)
      : null;

  const total = selectedServices.reduce(
    (sum, s) => ({
      price: sum.price + (barber?.services[s.id]?.price ?? s.price),
      duration: sum.duration + (barber?.services[s.id]?.duration ?? s.duration_minutes),
    }),
    { price: 0, duration: 0 },
  );
  // "Fark etmez" seçiliyken atanacak personele göre tutar değişebilir.
  const priceMayVary =
    !barber &&
    eligibleBarbers.some((b) =>
      serviceIds.some((id) => b.services[id].price !== null || b.services[id].duration !== null),
    );

  const days = useMemo(
    () =>
      Array.from(
        { length: Math.min(salon.max_booking_days_ahead, MAX_DAYS_SHOWN) + 1 },
        (_, i) => addDays(today, i),
      ),
    [today, salon.max_booking_days_ahead],
  );

  const categories = useMemo(() => {
    const groups = new Map<string, typeof services>();
    for (const service of services) {
      const key = service.category ?? "";
      groups.set(key, [...(groups.get(key) ?? []), service]);
    }
    return [...groups.entries()];
  }, [services]);

  const servicesDone = serviceIds.length > 0 && eligibleBarbers.length > 0;
  const barberDone = servicesDone && barberChoice !== null;

  // Boş saatler önbelleğe alınmaz; seçim değiştikçe veritabanından taze okunur.
  const slotsKey = barberDone
    ? `${serviceIds.join(",")}|${barberChoice}|${date}|${reloadCount}`
    : null;

  useEffect(() => {
    if (!slotsKey) return;
    let cancelled = false;

    createClient()
      .rpc("get_available_slots", {
        p_salon_id: salon.id,
        p_service_ids: serviceIds,
        p_date: date,
        p_barber_id: barberChoice === ANY_BARBER ? null : barberChoice,
      })
      .then(({ data, error: rpcError }) => {
        if (cancelled) return;
        const rows = (data ?? []) as { starts_at: string }[];
        setSlotsResult({
          key: slotsKey,
          // "Fark etmez"de aynı saat birden çok personel için dönebilir.
          slots: [...new Set(rows.map((row) => row.starts_at))],
          failed: rpcError !== null,
        });
      });

    return () => {
      cancelled = true;
    };
  }, [slotsKey, salon.id, serviceIds, date, barberChoice]);

  const slots = slotsResult && slotsResult.key === slotsKey ? slotsResult : null;

  function toggleService(id: string) {
    const next = serviceIds.includes(id)
      ? serviceIds.filter((s) => s !== id)
      : [...serviceIds, id];
    setServiceIds(next);
    setStartsAt(null);
    // Seçili personel yeni hizmet setini vermiyorsa seçimi sıfırla.
    if (chosenBarber && chosenBarber !== ANY_BARBER) {
      const chosen = barbers.find((b) => b.id === chosenBarber);
      if (!chosen || !next.every((s) => s in chosen.services)) setChosenBarber(null);
    }
    // İlk hizmet seçilince sıradaki adıma geç; ek hizmet eklerken sayfa yerinde kalır.
    if (serviceIds.length === 0 && next.length === 1) {
      const eligible = eligibleFor(next);
      if (eligible.length === 1) scrollToSection(timeRef);
      else if (eligible.length > 1) scrollToSection(barberRef);
    }
  }

  function chooseBarber(choice: string) {
    setChosenBarber(choice);
    setStartsAt(null);
    scrollToSection(timeRef);
  }

  function chooseDate(day: string) {
    setDate(day);
    setStartsAt(null);
  }

  function chooseSlot(slot: string) {
    setStartsAt(slot);
    scrollToSection(infoRef);
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!startsAt) return;
    setError(null);

    startTransition(async () => {
      const result = await createBooking({
        salonId: salon.id,
        serviceIds,
        startsAt,
        barberId: barber?.id ?? null,
        name: form.name,
        phone: form.phone,
        email: form.email,
        note: form.note,
        website: form.website,
      });

      if (result.ok) {
        setConfirmation(result.data);
        window.scrollTo({ top: 0 });
        return;
      }
      setError(result.message);
      if (result.code === "SLOT_TAKEN" || result.code === "SLOT_UNAVAILABLE") {
        setStartsAt(null);
        setReloadCount((n) => n + 1);
        scrollToSection(timeRef);
      }
    });
  }

  if (confirmation) {
    const assigned = barbers.find((b) => b.id === confirmation.barber_id);
    return (
      <section
        aria-live="polite"
        className="rounded-2xl border border-zinc-200 p-6 dark:border-zinc-800"
      >
        <h2 className="text-2xl font-semibold tracking-tight">
          {confirmation.requires_payment ? "Randevunuz ön kayda alındı" : "Randevunuz onaylandı"}
        </h2>
        <dl className="mt-6 space-y-3">
          <SummaryRow label="Tarih">
            {formatDay(date, { weekday: "long", day: "numeric", month: "long" })}
          </SummaryRow>
          <SummaryRow label="Saat">
            {formatTime(confirmation.starts_at, salon.timezone)} –{" "}
            {formatTime(confirmation.ends_at, salon.timezone)}
          </SummaryRow>
          {assigned && <SummaryRow label="Personel">{assigned.display_name}</SummaryRow>}
          <SummaryRow label="Hizmetler">
            {selectedServices.map((s) => s.name).join(", ")}
          </SummaryRow>
          <SummaryRow label="Toplam">
            {formatMoney(confirmation.total_price, salon.currency)}
          </SummaryRow>
        </dl>
        {confirmation.requires_payment ? (
          <p className="mt-6 rounded-lg bg-amber-50 p-4 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">
            Randevunuzun kesinleşmesi için{" "}
            <strong>{formatMoney(confirmation.deposit_amount, salon.currency)}</strong> kapora
            gerekiyor.
            {confirmation.hold_expires_at && (
              <>
                {" "}
                Saatiniz {formatTime(confirmation.hold_expires_at, salon.timezone)}&apos;e kadar
                sizin için tutuluyor.
              </>
            )}{" "}
            Ödeme için lütfen salonla iletişime geçin
            {salon.phone && (
              <>
                :{" "}
                <a className="font-medium underline" href={`tel:${salon.phone}`}>
                  {salon.phone}
                </a>
              </>
            )}
            .
          </p>
        ) : (
          <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">
            Randevu saatinizde salonda olmanız yeterli. Değişiklik için salonla iletişime
            geçebilirsiniz.
          </p>
        )}

        <p className="mt-4 text-sm">
          <Link
            href={`/r/${confirmation.manage_token}`}
            className="font-medium underline underline-offset-4"
          >
            Randevu sayfanızı açın
          </Link>{" "}
          <span className="text-zinc-500">
            (bu bağlantıyı saklayın; randevunuzu oradan takip eder, sonrasında değerlendirirsiniz)
          </span>
        </p>

        {extrasEnabled && (
          <div className="mt-8 border-t border-zinc-200 pt-6 dark:border-zinc-800">
            <h3 className="text-lg font-semibold tracking-tight">
              Görsel / ilham yükle <span className="font-normal text-zinc-500">(isteğe bağlı)</span>
            </h3>
            <p className="mt-1 mb-4 text-sm text-zinc-500">
              Saçınızın ya da tırnaklarınızın fotoğrafını ve beğendiğiniz modeli paylaşın;
              randevunuza hazırlıklı gelelim.
            </p>
            <ConsultationBox
              token={confirmation.manage_token}
              currency={salon.currency}
              initial={[]}
              aiAvailable={aiAvailable}
            />
          </div>
        )}
      </section>
    );
  }

  const nextHint = !servicesDone
    ? "Hizmet seçin"
    : !barberDone
      ? "Personel seçin"
      : !startsAt
        ? "Gün ve saat seçin"
        : null;

  return (
    <div className="space-y-10">
      {/* 1. Hizmet */}
      <Step number={1} title="Hizmet" done={servicesDone} summary={selectedServices.map((s) => s.name).join(", ")}>
        {services.length > 1 && (
          <p className="mb-3 text-sm text-zinc-500">Birden fazla hizmet seçebilirsiniz.</p>
        )}
        <div className="space-y-6">
          {categories.map(([category, items]) => (
            <fieldset key={category}>
              {category && (
                <legend className="mb-2 text-sm font-medium text-zinc-500">{category}</legend>
              )}
              <div className="space-y-2">
                {items.map((service) => {
                  const selected = serviceIds.includes(service.id);
                  return (
                    <button
                      key={service.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => toggleService(service.id)}
                      className={`${optionBase} ${selected ? optionSelected : optionIdle} flex items-center justify-between gap-4`}
                    >
                      <span>
                        <span className="block font-medium">{service.name}</span>
                        <span className="block text-sm text-zinc-500">
                          {formatDuration(service.duration_minutes)}
                          {service.description && ` · ${service.description}`}
                        </span>
                      </span>
                      <span className="shrink-0 font-medium tabular-nums">
                        {formatMoney(service.price, salon.currency)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ))}
        </div>
        {serviceIds.length > 0 && eligibleBarbers.length === 0 && (
          <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-300">
            Seçtiğiniz hizmetlerin tamamını veren bir personel yok. Lütfen hizmetleri ayrı
            randevular olarak alın.
          </p>
        )}
      </Step>

      {/* 2. Personel */}
      <Step
        number={2}
        title="Personel"
        sectionRef={barberRef}
        done={barberDone}
        summary={barberDone ? (barber?.display_name ?? "Fark etmez") : ""}
      >
        {!servicesDone ? (
          <Waiting>Önce hizmet seçin.</Waiting>
        ) : (
          <div className="space-y-2">
            {eligibleBarbers.length > 1 && (
              <button
                type="button"
                aria-pressed={barberChoice === ANY_BARBER}
                onClick={() => chooseBarber(ANY_BARBER)}
                className={`${optionBase} ${barberChoice === ANY_BARBER ? optionSelected : optionIdle}`}
              >
                <span className="block font-medium">Fark etmez</span>
                <span className="block text-sm text-zinc-500">
                  Seçtiğiniz saatte müsait olan personel atanır
                </span>
              </button>
            )}
            {eligibleBarbers.map((b) => (
              <button
                key={b.id}
                type="button"
                aria-pressed={barberChoice === b.id}
                onClick={() => chooseBarber(b.id)}
                className={`${optionBase} ${barberChoice === b.id ? optionSelected : optionIdle}`}
              >
                <span className="block font-medium">{b.display_name}</span>
                {b.title && <span className="block text-sm text-zinc-500">{b.title}</span>}
              </button>
            ))}
          </div>
        )}
      </Step>

      {/* 3. Tarih ve saat */}
      <Step
        number={3}
        title="Tarih ve saat"
        sectionRef={timeRef}
        done={startsAt !== null}
        summary={
          startsAt
            ? `${formatDay(date, { day: "numeric", month: "long" })}, ${formatTime(startsAt, salon.timezone)}`
            : ""
        }
      >
        {!barberDone ? (
          <Waiting>Önce hizmet ve personel seçin.</Waiting>
        ) : (
          <>
            {initialDate !== today && date === initialDate && (
              <p className="mb-3 text-sm text-zinc-500">
                Bugün için randevu saatleri sona erdi; en yakın çalışma günü gösteriliyor.
              </p>
            )}
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-3" aria-label="Tarih">
              {days.map((day) => {
                const selected = day === date;
                const closed = closedWeekdays.includes(dayOfWeek(day));
                return (
                  <button
                    key={day}
                    type="button"
                    aria-pressed={selected}
                    disabled={closed}
                    title={closed ? "Kapalı" : undefined}
                    onClick={() => chooseDate(day)}
                    className={`flex w-16 shrink-0 flex-col items-center rounded-xl border py-2 transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${selected ? optionSelected : optionIdle}`}
                  >
                    <span className="text-xs text-zinc-500">
                      {day === today ? "Bugün" : formatDay(day, { weekday: "short" })}
                    </span>
                    <span className="text-lg font-semibold tabular-nums">
                      {formatDay(day, { day: "numeric" })}
                    </span>
                    <span className="text-xs text-zinc-500">
                      {closed ? "Kapalı" : formatDay(day, { month: "short" })}
                    </span>
                  </button>
                );
              })}
            </div>

            <h3 className="mt-4 mb-3 font-medium">
              {formatDay(date, { weekday: "long", day: "numeric", month: "long" })}
            </h3>

            <div aria-live="polite">
              {!slots ? (
                <p className="py-8 text-center text-sm text-zinc-500">
                  Müsait saatler yükleniyor…
                </p>
              ) : slots.failed ? (
                <div className="py-8 text-center text-sm">
                  <p className="text-red-700 dark:text-red-300">Müsait saatler yüklenemedi.</p>
                  <button
                    type="button"
                    className="mt-2 font-medium underline"
                    onClick={() => setReloadCount((n) => n + 1)}
                  >
                    Tekrar dene
                  </button>
                </div>
              ) : slots.slots.length === 0 ? (
                <p className="py-8 text-center text-sm text-zinc-500">
                  Bu tarihte müsait saat yok. Lütfen başka bir gün seçin.
                </p>
              ) : (
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                  {slots.slots.map((slot) => (
                    <button
                      key={slot}
                      type="button"
                      aria-pressed={slot === startsAt}
                      onClick={() => chooseSlot(slot)}
                      className={`rounded-lg border py-2.5 text-sm font-medium tabular-nums transition-colors ${slot === startsAt ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900" : optionIdle}`}
                    >
                      {formatTime(slot, salon.timezone)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </Step>

      {/* 4. Bilgiler */}
      <Step number={4} title="Bilgileriniz" sectionRef={infoRef} done={false} summary="">
        {!startsAt ? (
          <Waiting>Önce gün ve saat seçin.</Waiting>
        ) : (
          <form id="booking-form" onSubmit={submit} className="space-y-4">
            <label className="block text-sm font-medium">
              Ad soyad
              <input
                required
                minLength={2}
                maxLength={100}
                autoComplete="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className={inputClass}
              />
            </label>
            <label className="block text-sm font-medium">
              Cep telefonu
              <input
                required
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="05XX XXX XX XX"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className={inputClass}
              />
            </label>
            <label className="block text-sm font-medium">
              E-posta <span className="font-normal text-zinc-500">(isteğe bağlı)</span>
              <input
                type="email"
                autoComplete="email"
                maxLength={254}
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className={inputClass}
              />
            </label>
            <label className="block text-sm font-medium">
              Notunuz <span className="font-normal text-zinc-500">(isteğe bağlı)</span>
              <textarea
                rows={3}
                maxLength={500}
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                className={inputClass}
              />
            </label>
            {/* Bot tuzağı: ekranda ve erişilebilirlik ağacında görünmez. */}
            <div aria-hidden="true" className="hidden">
              <label>
                Web sitesi
                <input
                  tabIndex={-1}
                  autoComplete="off"
                  value={form.website}
                  onChange={(e) => setForm({ ...form, website: e.target.value })}
                />
              </label>
            </div>
          </form>
        )}
      </Step>

      <div className="sticky bottom-0 -mx-4 border-t border-zinc-200 bg-background px-4 py-4 dark:border-zinc-800">
        {error && (
          <p
            role="alert"
            className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200"
          >
            {error}
          </p>
        )}
        <div className="flex items-center justify-between gap-4">
          <p className="min-w-0 text-sm">
            {serviceIds.length > 0 ? (
              <>
                <span className="font-semibold tabular-nums">
                  {formatMoney(total.price, salon.currency)}
                </span>
                <span className="text-zinc-500">
                  {" "}
                  · {formatDuration(total.duration)}
                  {priceMayVary && " · personele göre değişebilir"}
                </span>
              </>
            ) : (
              <span className="text-zinc-500">Henüz hizmet seçilmedi</span>
            )}
            {nextHint && <span className="block text-xs text-zinc-500">Sıradaki: {nextHint}</span>}
          </p>
          <button
            type="submit"
            form="booking-form"
            disabled={!startsAt || isPending}
            className={primaryButton}
          >
            {isPending ? "Gönderiliyor…" : "Randevuyu onayla"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Step({
  number,
  title,
  done,
  summary,
  sectionRef,
  children,
}: {
  number: number;
  title: string;
  done: boolean;
  /** Tamamlanan adımın kısa özeti (başlığın yanında). */
  summary: string;
  sectionRef?: SectionRef;
  children: React.ReactNode;
}) {
  return (
    <section ref={sectionRef} className="scroll-mt-6">
      <div className="mb-4 flex items-center gap-3">
        <span
          aria-hidden="true"
          className={`flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold tabular-nums ${
            done
              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
              : "border border-zinc-300 text-zinc-500 dark:border-zinc-700"
          }`}
        >
          {done ? "✓" : number}
        </span>
        <h2 tabIndex={-1} className="text-xl font-semibold tracking-tight outline-none">
          {title}
        </h2>
        {done && summary && (
          <span className="min-w-0 truncate text-sm text-zinc-500">{summary}</span>
        )}
      </div>
      {children}
    </section>
  );
}

function Waiting({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-zinc-300 p-4 text-sm text-zinc-500 dark:border-zinc-700">
      {children}
    </p>
  );
}

function SummaryRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <dt className="shrink-0 text-zinc-500">{label}</dt>
      <dd className="text-right font-medium">{children}</dd>
    </div>
  );
}
