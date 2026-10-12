"use client";

import { useRef, useState, useTransition } from "react";

import { formatDuration, formatMoney, minutesToLabel } from "@/lib/format";
import { updateAppointmentStatus } from "@/lib/panel/actions";
import type {
  AgendaItem,
  AppointmentStatus,
  SettableAppointmentStatus,
} from "@/lib/panel/types";

/** Randevu + salon saatine göre gün içi dakikaları (sunucuda hesaplanır). */
export type CalendarAppointment = AgendaItem & { startMin: number; endMin: number };

/** Personel sütunu; workStart/workEnd null ise o gün çalışmıyor. */
export type CalendarColumn = {
  id: string;
  name: string;
  workStart: number | null;
  workEnd: number | null;
};

const PX_PER_MINUTE = 1.25;
const DEFAULT_START = 9 * 60;
const DEFAULT_END = 19 * 60;

const STATUS_LABEL: Record<AppointmentStatus, string> = {
  pending_payment: "Kapora bekleniyor",
  confirmed: "Onaylı",
  completed: "Tamamlandı",
  cancelled: "İptal edildi",
  no_show: "Gelmedi",
};

// Durum hem renkle hem etiketle gösterilir; metin her zaman nötr mürekkeptedir.
const STATUS_STYLE: Record<AppointmentStatus, string> = {
  pending_payment: "border-l-amber-500 bg-amber-50 dark:bg-amber-950/60",
  confirmed: "border-l-blue-600 bg-blue-50 dark:bg-blue-950/60",
  completed: "border-l-emerald-600 bg-emerald-50 dark:bg-emerald-950/60",
  cancelled: "border-l-zinc-400 bg-zinc-100 dark:bg-zinc-900",
  no_show: "border-l-red-600 bg-red-50 dark:bg-red-950/60",
};

type Action = { status: SettableAppointmentStatus; label: string; primary?: boolean };

function actionsFor(status: AppointmentStatus, canReopen: boolean): Action[] {
  switch (status) {
    case "confirmed":
      return [
        { status: "completed", label: "Tamamlandı", primary: true },
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

export function DayCalendar({
  appointments,
  columns,
  currency,
  canReopen,
}: {
  appointments: CalendarAppointment[];
  columns: CalendarColumn[];
  currency: string;
  /** Ön büro (sahip, yönetici, resepsiyon): kapanmış randevuyu geri açabilir. */
  canReopen: boolean;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const active = appointments.filter((a) => a.status !== "cancelled" && a.status !== "no_show");
  const closed = appointments.filter((a) => a.status === "cancelled" || a.status === "no_show");
  const selected = appointments.find((a) => a.appointment_id === selectedId) ?? null;

  // Görünen aralık: mesai saatleri ile randevuların birleşimi, tam saate yuvarlanır.
  const starts = [
    ...columns.flatMap((c) => (c.workStart === null ? [] : [c.workStart])),
    ...active.map((a) => a.startMin),
  ];
  const ends = [
    ...columns.flatMap((c) => (c.workEnd === null ? [] : [c.workEnd])),
    ...active.map((a) => a.endMin),
  ];
  const rangeStart = Math.floor((starts.length ? Math.min(...starts) : DEFAULT_START) / 60) * 60;
  const rangeEnd = Math.ceil((ends.length ? Math.max(...ends) : DEFAULT_END) / 60) * 60;
  const height = (rangeEnd - rangeStart) * PX_PER_MINUTE;
  const hours = Array.from({ length: (rangeEnd - rangeStart) / 60 + 1 }, (_, i) => rangeStart + i * 60);

  function open(id: string) {
    setError(null);
    setSelectedId(id);
    dialogRef.current?.showModal();
  }

  function apply(action: Action) {
    if (!selected) return;
    let reason: string | undefined;
    if (action.status === "cancelled") {
      const answer = window.prompt("İptal nedeni (isteğe bağlı):");
      if (answer === null) return;
      reason = answer.trim() || undefined;
    }
    setError(null);
    startTransition(async () => {
      const result = await updateAppointmentStatus(selected.appointment_id, action.status, reason);
      if (result.ok) dialogRef.current?.close();
      else setError(result.message);
    });
  }

  if (columns.length === 0) {
    return (
      <p className="rounded-xl border border-zinc-200 p-8 text-center text-zinc-500 dark:border-zinc-800">
        Takvimde gösterilecek personel yok.
      </p>
    );
  }

  return (
    <>
      <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
        <div className="flex min-w-full border-b border-zinc-200 dark:border-zinc-800">
          <div className="w-14 shrink-0" />
          {columns.map((column) => (
            <div
              key={column.id}
              className="min-w-40 flex-1 border-l border-zinc-200 px-3 py-2 text-sm font-medium dark:border-zinc-800"
            >
              {column.name}
              <span className="ml-2 font-normal text-zinc-500">
                {active.filter((a) => a.barber_id === column.id).length}
              </span>
            </div>
          ))}
        </div>

        <div className="flex min-w-full" style={{ height }}>
          <div className="relative w-14 shrink-0" aria-hidden="true">
            {hours.slice(0, -1).map((minute) => (
              <span
                key={minute}
                className="absolute right-2 text-xs text-zinc-500 tabular-nums"
                style={{ top: (minute - rangeStart) * PX_PER_MINUTE + 2 }}
              >
                {minutesToLabel(minute)}
              </span>
            ))}
          </div>

          {columns.map((column) => (
            <div
              key={column.id}
              className="relative min-w-40 flex-1 border-l border-zinc-200 dark:border-zinc-800"
            >
              {hours.slice(1, -1).map((minute) => (
                <div
                  key={minute}
                  aria-hidden="true"
                  className="absolute inset-x-0 border-t border-zinc-100 dark:border-zinc-900"
                  style={{ top: (minute - rangeStart) * PX_PER_MINUTE }}
                />
              ))}

              {/* Mesai dışı saatler */}
              {column.workStart === null || column.workEnd === null ? (
                <div className="absolute inset-0 flex items-start justify-center bg-zinc-100/70 pt-4 text-xs text-zinc-500 dark:bg-zinc-900/70">
                  Bugün çalışmıyor
                </div>
              ) : (
                <>
                  <div
                    aria-hidden="true"
                    className="absolute inset-x-0 top-0 bg-zinc-100/70 dark:bg-zinc-900/70"
                    style={{ height: (column.workStart - rangeStart) * PX_PER_MINUTE }}
                  />
                  <div
                    aria-hidden="true"
                    className="absolute inset-x-0 bottom-0 bg-zinc-100/70 dark:bg-zinc-900/70"
                    style={{ height: (rangeEnd - column.workEnd) * PX_PER_MINUTE }}
                  />
                </>
              )}

              {active
                .filter((a) => a.barber_id === column.id)
                .map((a) => (
                  <button
                    key={a.appointment_id}
                    type="button"
                    onClick={() => open(a.appointment_id)}
                    className={`absolute inset-x-1 overflow-hidden rounded-md border-l-4 px-2 py-1 text-left text-xs leading-tight transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-zinc-900 dark:focus-visible:outline-zinc-100 ${STATUS_STYLE[a.status]}`}
                    style={{
                      top: (a.startMin - rangeStart) * PX_PER_MINUTE + 1,
                      height: Math.max((a.endMin - a.startMin) * PX_PER_MINUTE - 2, 22),
                    }}
                  >
                    <span className="block truncate font-medium">
                      <span className="tabular-nums">{minutesToLabel(a.startMin)}</span>{" "}
                      {a.customer_name}
                    </span>
                    <span className="block truncate text-zinc-600 dark:text-zinc-400">
                      {a.status !== "confirmed" && `${STATUS_LABEL[a.status]} · `}
                      {a.services.map((s) => s.name).join(", ")}
                    </span>
                  </button>
                ))}
            </div>
          ))}
        </div>
      </div>

      {active.length === 0 && (
        <p className="mt-3 text-sm text-zinc-500">Bu gün için aktif randevu yok.</p>
      )}

      {closed.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-medium">İptal edilen ve gelinmeyen randevular</h3>
          <ul className="mt-2 divide-y divide-zinc-100 rounded-xl border border-zinc-200 text-sm dark:divide-zinc-900 dark:border-zinc-800">
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
                  <span className="ml-auto text-zinc-600 dark:text-zinc-400">
                    {STATUS_LABEL[a.status]}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
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
              <DetailRow label="Durum">{STATUS_LABEL[selected.status]}</DetailRow>
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

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-zinc-500">{label}</dt>
      <dd className="text-right font-medium">{children}</dd>
    </div>
  );
}
