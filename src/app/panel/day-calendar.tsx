"use client";

import { useRef, useState, useTransition } from "react";

import {
  formatDuration,
  formatMoney,
  minutesToLabel,
  timeToMinutes,
  zonedToIso,
} from "@/lib/format";
import {
  completeAppointment,
  getCustomerLink,
  rescheduleAppointment,
  updateAppointmentStatus,
} from "@/lib/panel/actions";
import type {
  ActionResult,
  AgendaItem,
  AppointmentStatus,
  PaymentMethod,
  SettableAppointmentStatus,
} from "@/lib/panel/types";

const PAYMENT_OPTIONS: [PaymentMethod, string][] = [
  ["cash", "Nakit"],
  ["card", "Kart"],
  ["transfer", "Havale / EFT"],
];

const fieldClass =
  "rounded-lg border border-zinc-300 bg-transparent px-2 py-1.5 text-sm dark:border-zinc-700";

/** Randevu + salon saatine göre gün içi dakikaları (sunucuda hesaplanır). */
export type CalendarAppointment = AgendaItem & { startMin: number; endMin: number };

/** Personel şeridi; workStart/workEnd null ise o gün çalışmıyor. */
export type CalendarColumn = {
  id: string;
  name: string;
  workStart: number | null;
  workEnd: number | null;
};

/** Bu süreden kısa boşluklar gösterilmez (gürültü olur, randevu da sığmaz). */
const MIN_GAP_MINUTES = 30;

const STATUS_LABEL: Record<AppointmentStatus, string> = {
  pending_payment: "Kapora bekleniyor",
  confirmed: "Onaylı",
  completed: "Tamamlandı",
  cancelled: "İptal edildi",
  no_show: "Gelmedi",
};

// Durum küçük bir renk noktası + etiketle gösterilir; metin nötr mürekkeptedir.
const STATUS_DOT: Record<AppointmentStatus, string> = {
  pending_payment: "bg-amber-500",
  confirmed: "bg-blue-600",
  completed: "bg-emerald-600",
  cancelled: "bg-zinc-400",
  no_show: "bg-red-600",
};

type Action = { status: SettableAppointmentStatus; label: string; primary?: boolean };

function actionsFor(status: AppointmentStatus, canReopen: boolean): Action[] {
  switch (status) {
    case "confirmed":
      // "Tamamlandı" ödeme yöntemi düğmeleriyle ayrıca gösterilir.
      return [
        { status: "no_show", label: "Gelmedi" },
        { status: "cancelled", label: "İptal et" },
      ];
    case "pending_payment":
      return [
        ...(canReopen
          ? [{ status: "confirmed", label: "Kapora alındı, onayla", primary: true } as Action]
          : []),
        { status: "cancelled", label: "İptal et" },
      ];
    default:
      return canReopen ? [{ status: "confirmed", label: "Geri al (onaylıya döndür)" }] : [];
  }
}

type LaneEntry =
  | { kind: "appointment"; appointment: CalendarAppointment }
  | { kind: "gap"; start: number; end: number };

/** Randevuları ve aralarındaki (henüz geçmemiş) boşlukları saat sırasıyla dizer. */
function buildLane(
  column: CalendarColumn,
  appointments: CalendarAppointment[],
  nowMin: number,
): LaneEntry[] {
  const entries: LaneEntry[] = [];
  let cursor = column.workStart;

  const pushGap = (until: number) => {
    if (cursor === null) return;
    const start = Math.max(cursor, nowMin);
    if (until - start >= MIN_GAP_MINUTES) entries.push({ kind: "gap", start, end: until });
  };

  for (const appointment of appointments) {
    pushGap(appointment.startMin);
    entries.push({ kind: "appointment", appointment });
    if (cursor !== null) cursor = Math.max(cursor, appointment.endMin);
  }
  if (column.workEnd !== null) pushGap(column.workEnd);

  return entries;
}

export function DayCalendar({
  appointments,
  columns,
  currency,
  timezone,
  day,
  canReopen,
  nowMin,
}: {
  appointments: CalendarAppointment[];
  columns: CalendarColumn[];
  currency: string;
  timezone: string;
  /** Gösterilen takvim günü, "YYYY-MM-DD". */
  day: string;
  /** Ön büro (sahip, yönetici, resepsiyon): kapanmış randevuyu geri açabilir, personeli değiştirebilir. */
  canReopen: boolean;
  /** Salon saatine göre şu an (dakika). Geçmiş gün için 1440, gelecek gün için -1. */
  nowMin: number;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [laneFilter, setLaneFilter] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [linkNote, setLinkNote] = useState<string | null>(null);
  const [dragLane, setDragLane] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const active = appointments.filter((a) => a.status !== "cancelled" && a.status !== "no_show");
  const closed = appointments.filter((a) => a.status === "cancelled" || a.status === "no_show");
  const selected = appointments.find((a) => a.appointment_id === selectedId) ?? null;
  const visibleColumns = laneFilter ? columns.filter((c) => c.id === laneFilter) : columns;

  function open(id: string) {
    setError(null);
    setLinkNote(null);
    setSelectedId(id);
    dialogRef.current?.showModal();
  }

  /** Detay penceresindeki işlemi çalıştırır; başarılıysa pencereyi kapatır. */
  function run(action: () => Promise<ActionResult<unknown>>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.ok) dialogRef.current?.close();
      else setError(result.message);
    });
  }

  function apply(action: Action) {
    if (!selected) return;
    let reason: string | undefined;
    if (action.status === "cancelled") {
      const answer = window.prompt("İptal nedeni (isteğe bağlı):");
      if (answer === null) return;
      reason = answer.trim() || undefined;
    }
    run(() => updateAppointmentStatus(selected.appointment_id, action.status, reason));
  }

  function reschedule(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const data = new FormData(event.currentTarget);
    const date = String(data.get("date") ?? "");
    const time = String(data.get("time") ?? "");
    const barberId = String(data.get("barber") ?? "");
    if (!date || !time) return;
    run(() =>
      rescheduleAppointment(
        selected.appointment_id,
        zonedToIso(date, timeToMinutes(time), timezone),
        barberId && barberId !== selected.barber_id ? barberId : undefined,
      ),
    );
  }

  /**
   * Müşterinin randevu sayfası bağlantısını kopyalar ya da müşterinin
   * numarasına hazır mesajla WhatsApp sohbeti açar (mesajı personel gönderir).
   */
  function shareLink(mode: "copy" | "whatsapp") {
    if (!selected) return;
    const appointment = selected;
    setLinkNote(null);
    // Açılır pencere engeline takılmamak için sekme tıklama anında açılır.
    const popup = mode === "whatsapp" ? window.open("", "_blank") : null;
    startTransition(async () => {
      const result = await getCustomerLink(appointment.appointment_id);
      if (!result.ok) {
        popup?.close();
        setLinkNote(result.message);
        return;
      }
      const url = `${window.location.origin}${result.data}`;
      if (mode === "copy") {
        try {
          await navigator.clipboard.writeText(url);
          setLinkNote("Kopyalandı");
        } catch {
          setLinkNote(url);
        }
        return;
      }
      const message =
        appointment.status === "completed"
          ? `Merhaba ${appointment.customer_name}, bizi tercih ettiğiniz için teşekkür ederiz. Deneyiminizi buradan değerlendirebilirsiniz: ${url}`
          : `Merhaba ${appointment.customer_name}, randevu sayfanız: ${url}`;
      const target = `https://wa.me/${appointment.customer_phone.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;
      if (popup) popup.location.href = target;
      else window.location.href = target;
    });
  }

  /** Sürükle-bırak: randevuyu aynı saatte başka personele taşır. */
  function moveToLane(appointmentId: string, barberId: string) {
    setDragLane(null);
    const appointment = active.find((a) => a.appointment_id === appointmentId);
    if (!appointment || appointment.barber_id === barberId) return;
    setMoveError(null);
    startTransition(async () => {
      const result = await rescheduleAppointment(appointmentId, appointment.starts_at, barberId);
      if (!result.ok) setMoveError(result.message);
    });
  }

  const movable = selected?.status === "confirmed" || selected?.status === "pending_payment";

  if (columns.length === 0) {
    return (
      <p className="rounded-2xl border border-zinc-200 p-8 text-center text-zinc-500 dark:border-zinc-800">
        Takvimde gösterilecek personel yok.
      </p>
    );
  }

  return (
    <>
      {columns.length > 1 && (
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Personel filtresi">
          <FilterChip active={laneFilter === null} onClick={() => setLaneFilter(null)}>
            Tümü <span className="tabular-nums opacity-60">{active.length}</span>
          </FilterChip>
          {columns.map((column) => (
            <FilterChip
              key={column.id}
              active={laneFilter === column.id}
              onClick={() => setLaneFilter(column.id)}
            >
              {column.name}{" "}
              <span className="tabular-nums opacity-60">
                {active.filter((a) => a.barber_id === column.id).length}
              </span>
            </FilterChip>
          ))}
        </div>
      )}

      {canReopen && columns.length > 1 && (
        <p className="mb-3 text-sm text-zinc-500">
          Bekleyen bir randevuyu başka personelin şeridine sürükleyerek aynı saatte ona
          aktarabilirsiniz.{isPending && " İşleniyor…"}
        </p>
      )}
      {moveError && (
        <p
          role="alert"
          className="mb-3 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200"
        >
          {moveError}
        </p>
      )}

      <div className="grid items-start gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(100%,19rem),1fr))]">
        {visibleColumns.map((column) => (
          <Lane
            key={column.id}
            column={column}
            appointments={active.filter((a) => a.barber_id === column.id)}
            currency={currency}
            nowMin={nowMin}
            onOpen={open}
            canDrag={canReopen && columns.length > 1}
            highlighted={dragLane === column.id}
            onDragState={(over) =>
              setDragLane((current) => (over ? column.id : current === column.id ? null : current))
            }
            onDropAppointment={(id) => moveToLane(id, column.id)}
          />
        ))}
      </div>

      {closed.length > 0 && (
        <details className="mt-6 rounded-2xl border border-zinc-200 dark:border-zinc-800">
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium">
            İptal edilen ve gelinmeyen randevular{" "}
            <span className="font-normal text-zinc-500">({closed.length})</span>
          </summary>
          <ul className="divide-y divide-zinc-100 border-t border-zinc-200 text-sm dark:divide-zinc-900 dark:border-zinc-800">
            {closed.map((a) => (
              <li key={a.appointment_id}>
                <button
                  type="button"
                  onClick={() => open(a.appointment_id)}
                  className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-900"
                >
                  <span className="tabular-nums">{minutesToLabel(a.startMin)}</span>
                  <span className="font-medium">{a.customer_name}</span>
                  <span className="text-zinc-500">{a.barber_name}</span>
                  <StatusPill status={a.status} className="ml-auto" />
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}

      <dialog
        ref={dialogRef}
        onClose={() => setSelectedId(null)}
        className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-2xl bg-background p-6 text-foreground shadow-xl backdrop:bg-black/40"
      >
        {selected && (
          <>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold">{selected.customer_name}</h3>
                <a className="text-sm underline" href={`tel:${selected.customer_phone}`}>
                  {selected.customer_phone}
                </a>
              </div>
              <button
                type="button"
                onClick={() => dialogRef.current?.close()}
                aria-label="Kapat"
                className="rounded-lg px-2 py-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                ✕
              </button>
            </div>

            <dl className="mt-4 space-y-2 text-sm">
              <DetailRow label="Durum">
                <StatusPill status={selected.status} />
              </DetailRow>
              <DetailRow label="Saat">
                {minutesToLabel(selected.startMin)} – {minutesToLabel(selected.endMin)} (
                {formatDuration(selected.endMin - selected.startMin)})
              </DetailRow>
              <DetailRow label="Personel">{selected.barber_name}</DetailRow>
            </dl>

            <ul className="mt-4 space-y-1 border-t border-zinc-200 pt-4 text-sm dark:border-zinc-800">
              {selected.services.map((service) => (
                <li key={service.service_id} className="flex justify-between gap-4">
                  <span>{service.name}</span>
                  <span className="tabular-nums">{formatMoney(service.price, currency)}</span>
                </li>
              ))}
              <li className="flex justify-between gap-4 pt-1 font-semibold">
                <span>Toplam</span>
                <span className="tabular-nums">{formatMoney(selected.total_price, currency)}</span>
              </li>
              {selected.deposit_amount > 0 && (
                <li className="flex justify-between gap-4 text-zinc-500">
                  <span>Kapora</span>
                  <span className="tabular-nums">
                    {formatMoney(selected.deposit_amount, currency)}
                  </span>
                </li>
              )}
            </ul>

            {selected.customer_note && (
              <p className="mt-4 rounded-lg bg-zinc-100 p-3 text-sm dark:bg-zinc-900">
                <span className="font-medium">Müşteri notu:</span> {selected.customer_note}
              </p>
            )}

            {error && (
              <p role="alert" className="mt-4 text-sm text-red-700 dark:text-red-300">
                {error}
              </p>
            )}

            {selected.status !== "cancelled" && selected.status !== "no_show" && (
              <div className="mt-6 rounded-lg bg-zinc-100 p-3 text-sm dark:bg-zinc-900">
                <p className="font-medium">
                  {selected.status === "completed"
                    ? "Değerlendirme bağlantısı"
                    : "Müşterinin randevu sayfası"}
                </p>
                <p className="text-xs text-zinc-500">
                  {selected.status === "completed"
                    ? "Müşteri bu bağlantıdan puan verir ve yorum yazar."
                    : "Müşteri bu bağlantıdan görsel yükleyip yorum isteyebilir."}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => shareLink("whatsapp")}
                    className="rounded-lg bg-emerald-600 px-3 py-1.5 font-medium text-white hover:bg-emerald-700 disabled:opacity-40"
                  >
                    WhatsApp&apos;tan gönder
                  </button>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => shareLink("copy")}
                    className="rounded-lg border border-zinc-300 px-3 py-1.5 font-medium hover:bg-zinc-200 disabled:opacity-40 dark:border-zinc-700 dark:hover:bg-zinc-800"
                  >
                    Bağlantıyı kopyala
                  </button>
                  {linkNote && <span role="status">{linkNote}</span>}
                </div>
              </div>
            )}

            {selected.status === "confirmed" && (
              <div className="mt-6">
                <p className="text-sm font-medium">Tamamlandı olarak işaretle</p>
                <p className="text-xs text-zinc-500">Ödemenin nasıl alındığını seçin.</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {PAYMENT_OPTIONS.map(([method, label]) => (
                    <button
                      key={method}
                      type="button"
                      disabled={isPending}
                      onClick={() => run(() => completeAppointment(selected.appointment_id, method))}
                      className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {movable && (
              <form
                key={selected.appointment_id}
                onSubmit={reschedule}
                className="mt-6 border-t border-zinc-200 pt-4 dark:border-zinc-800"
              >
                <p className="text-sm font-medium">Ertele / taşı</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <input
                    type="date"
                    name="date"
                    required
                    defaultValue={day}
                    aria-label="Yeni tarih"
                    className={fieldClass}
                  />
                  <input
                    type="time"
                    name="time"
                    required
                    step={300}
                    defaultValue={minutesToLabel(selected.startMin)}
                    aria-label="Yeni saat"
                    className={fieldClass}
                  />
                  {canReopen && columns.length > 1 && (
                    <select
                      name="barber"
                      defaultValue={selected.barber_id}
                      aria-label="Personel"
                      className={fieldClass}
                    >
                      {columns.map((column) => (
                        <option key={column.id} value={column.id}>
                          {column.name}
                        </option>
                      ))}
                    </select>
                  )}
                  <button
                    type="submit"
                    disabled={isPending}
                    className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-700 dark:hover:bg-zinc-800"
                  >
                    Ertele
                  </button>
                </div>
              </form>
            )}

            <div className="mt-6 flex flex-wrap gap-2">
              {actionsFor(selected.status, canReopen).map((action) => (
                <button
                  key={action.status}
                  type="button"
                  disabled={isPending}
                  onClick={() => apply(action)}
                  className={`rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-40 ${
                    action.primary
                      ? "bg-zinc-900 text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                      : "border border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                  }`}
                >
                  {action.label}
                </button>
              ))}
            </div>
          </>
        )}
      </dialog>
    </>
  );
}

function Lane({
  column,
  appointments,
  currency,
  nowMin,
  onOpen,
  canDrag,
  highlighted,
  onDragState,
  onDropAppointment,
}: {
  column: CalendarColumn;
  appointments: CalendarAppointment[];
  currency: string;
  nowMin: number;
  onOpen: (id: string) => void;
  canDrag: boolean;
  /** Üzerinde sürüklenen bir randevu var. */
  highlighted: boolean;
  onDragState: (over: boolean) => void;
  onDropAppointment: (appointmentId: string) => void;
}) {
  const working = column.workStart !== null && column.workEnd !== null;
  const entries = buildLane(column, appointments, nowMin);
  const bookedMinutes = appointments.reduce((sum, a) => sum + (a.endMin - a.startMin), 0);
  const workMinutes = working ? column.workEnd! - column.workStart! : 0;
  const occupancy = workMinutes > 0 ? Math.min(100, Math.round((bookedMinutes / workMinutes) * 100)) : 0;

  return (
    <section
      aria-label={column.name}
      onDragOver={(event) => {
        if (!canDrag) return;
        event.preventDefault();
        onDragState(true);
      }}
      onDragLeave={() => onDragState(false)}
      onDrop={(event) => {
        event.preventDefault();
        onDropAppointment(event.dataTransfer.getData("text/plain"));
      }}
      className={`rounded-2xl border bg-zinc-50/60 transition-colors dark:bg-zinc-900/40 ${
        highlighted ? "border-blue-600 ring-1 ring-blue-600" : "border-zinc-200 dark:border-zinc-800"
      }`}
    >
      <header className="p-4">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-sm font-semibold text-white uppercase dark:bg-zinc-100 dark:text-zinc-900"
          >
            {column.name.trim().charAt(0)}
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-semibold">{column.name}</h3>
            <p className="text-xs text-zinc-500 tabular-nums">
              {working
                ? `${minutesToLabel(column.workStart!)} – ${minutesToLabel(column.workEnd!)}`
                : "Bugün çalışmıyor"}
            </p>
          </div>
          <p className="text-right text-xs text-zinc-500">
            <span className="block text-lg leading-none font-semibold text-foreground tabular-nums">
              {appointments.length}
            </span>
            randevu
          </p>
        </div>

        {working && (
          <div className="mt-3 flex items-center gap-2">
            <div
              role="meter"
              aria-label="Doluluk"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={occupancy}
              className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800"
            >
              <div
                className="h-full rounded-full bg-zinc-900 dark:bg-zinc-100"
                style={{ width: `${occupancy}%` }}
              />
            </div>
            <span className="text-xs text-zinc-500 tabular-nums">%{occupancy} dolu</span>
          </div>
        )}
      </header>

      {entries.length > 0 ? (
        <ul className="space-y-2 px-3 pb-3">
          {entries.map((entry) =>
            entry.kind === "gap" ? (
              <li
                key={`gap-${entry.start}`}
                className="flex items-center justify-between rounded-xl border border-dashed border-zinc-300 px-3 py-1.5 text-xs text-zinc-500 dark:border-zinc-700"
              >
                <span className="tabular-nums">
                  Boş · {minutesToLabel(entry.start)} – {minutesToLabel(entry.end)}
                </span>
                <span>{formatDuration(entry.end - entry.start)}</span>
              </li>
            ) : (
              <li key={entry.appointment.appointment_id}>
                <AppointmentCard
                  appointment={entry.appointment}
                  currency={currency}
                  nowMin={nowMin}
                  onOpen={onOpen}
                  canDrag={canDrag}
                />
              </li>
            ),
          )}
        </ul>
      ) : (
        <p className="px-4 pb-4 text-sm text-zinc-500">
          {working ? "Bu gün için randevu yok." : "Randevu alınamaz."}
        </p>
      )}
    </section>
  );
}

function AppointmentCard({
  appointment: a,
  currency,
  nowMin,
  onOpen,
  canDrag,
}: {
  appointment: CalendarAppointment;
  currency: string;
  nowMin: number;
  onOpen: (id: string) => void;
  canDrag: boolean;
}) {
  const services = a.services.map((s) => s.name).join(", ");

  // Biten işler tek satıra iner; dikkat bekleyen ve sıradaki randevulara kalır.
  if (a.status === "completed") {
    return (
      <button
        type="button"
        onClick={() => onOpen(a.appointment_id)}
        className="flex w-full items-center gap-3 rounded-xl px-3 py-1.5 text-left text-sm text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
      >
        <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${STATUS_DOT.completed}`} />
        <span className="tabular-nums">{minutesToLabel(a.startMin)}</span>
        <span className="min-w-0 flex-1 truncate">
          {a.customer_name} <span className="sr-only">· Tamamlandı</span>
        </span>
        <span className="tabular-nums">{formatMoney(a.total_price, currency)}</span>
      </button>
    );
  }

  const inProgress = a.status === "confirmed" && a.startMin <= nowMin && nowMin < a.endMin;
  const overdue = a.status === "confirmed" && a.endMin <= nowMin;

  return (
    <button
      type="button"
      draggable={canDrag}
      onDragStart={(event) => {
        event.dataTransfer.setData("text/plain", a.appointment_id);
        event.dataTransfer.effectAllowed = "move";
      }}
      onClick={() => onOpen(a.appointment_id)}
      className={`flex w-full gap-3 rounded-xl border bg-background p-3 text-left transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-zinc-900 dark:focus-visible:outline-zinc-100 ${
        inProgress
          ? "border-blue-600 ring-1 ring-blue-600"
          : "border-zinc-200 dark:border-zinc-800"
      }`}
    >
      <span className="w-12 shrink-0 tabular-nums">
        <span className="block font-semibold">{minutesToLabel(a.startMin)}</span>
        <span className="block text-xs text-zinc-500">{minutesToLabel(a.endMin)}</span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className="truncate font-medium">{a.customer_name}</span>
          <span className="shrink-0 text-sm tabular-nums">
            {formatMoney(a.total_price, currency)}
          </span>
        </span>
        <span className="block truncate text-sm text-zinc-500">{services}</span>
        <span className="mt-2 flex flex-wrap items-center gap-2">
          {inProgress ? (
            <Pill dot="bg-blue-600 animate-pulse">Şimdi koltukta</Pill>
          ) : overdue ? (
            <Pill dot="bg-amber-500">Kapatılmadı: tamamlandı mı?</Pill>
          ) : (
            <StatusPill status={a.status} />
          )}
          {a.customer_note && <Pill>Not var</Pill>}
        </span>
      </span>
    </button>
  );
}

function Pill({
  dot,
  className = "",
  children,
}: {
  dot?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-zinc-200 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-300 ${className}`}
    >
      {dot && <span aria-hidden="true" className={`size-1.5 rounded-full ${dot}`} />}
      {children}
    </span>
  );
}

function StatusPill({ status, className }: { status: AppointmentStatus; className?: string }) {
  return (
    <Pill dot={STATUS_DOT[status]} className={className}>
      {STATUS_LABEL[status]}
    </Pill>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className="shrink-0 rounded-full border border-zinc-300 px-3 py-1.5 text-sm font-medium transition-colors hover:bg-zinc-100 aria-pressed:border-zinc-900 aria-pressed:bg-zinc-900 aria-pressed:text-white dark:border-zinc-700 dark:hover:bg-zinc-800 dark:aria-pressed:border-zinc-100 dark:aria-pressed:bg-zinc-100 dark:aria-pressed:text-zinc-900"
    >
      {children}
    </button>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-zinc-500">{label}</dt>
      <dd className="text-right font-medium">{children}</dd>
    </div>
  );
}
