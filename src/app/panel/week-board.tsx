"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { formatDay, minutesToLabel, zonedToIso } from "@/lib/format";
import { rescheduleAppointment } from "@/lib/panel/actions";
import type { AppointmentStatus } from "@/lib/panel/types";

export type WeekAppointment = {
  appointment_id: string;
  customer_name: string;
  barber_name: string;
  status: AppointmentStatus;
  /** Salon saatine göre takvim günü, "YYYY-MM-DD". */
  day: string;
  startMin: number;
};

const STATUS_DOT: Record<AppointmentStatus, string> = {
  pending_payment: "bg-amber-500",
  confirmed: "bg-blue-600",
  completed: "bg-emerald-600",
  cancelled: "bg-zinc-400",
  no_show: "bg-red-600",
};

/**
 * Haftalık pano: her gün bir sütun. Bekleyen bir randevu başka güne
 * sürüklenirse aynı saatte o güne ertelenir (çakışma ve mesai kurallarını
 * veritabanı uygular).
 */
export function WeekBoard({
  days,
  today,
  appointments,
  timezone,
  salonSlug,
  canMove,
}: {
  days: string[];
  today: string;
  appointments: WeekAppointment[];
  timezone: string;
  salonSlug: string;
  canMove: boolean;
}) {
  const [overDay, setOverDay] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function drop(day: string, appointmentId: string) {
    setOverDay(null);
    const appointment = appointments.find((a) => a.appointment_id === appointmentId);
    if (!appointment || appointment.day === day) return;
    setMessage(null);
    startTransition(async () => {
      const result = await rescheduleAppointment(
        appointmentId,
        zonedToIso(day, appointment.startMin, timezone),
      );
      setMessage(
        result.ok
          ? {
              ok: true,
              text: `${appointment.customer_name}: ${formatDay(day, { weekday: "long", day: "numeric", month: "long" })} ${minutesToLabel(appointment.startMin)} olarak ertelendi.`,
            }
          : { ok: false, text: result.message },
      );
    });
  }

  return (
    <>
      <p className="mb-3 text-sm text-zinc-500">
        {canMove
          ? "Bekleyen bir randevuyu başka bir güne sürükleyerek aynı saate erteleyebilirsiniz."
          : "Haftanın randevuları."}
        {isPending && " Taşınıyor…"}
      </p>
      {message && (
        <p
          role={message.ok ? "status" : "alert"}
          className={`mb-3 rounded-lg px-4 py-3 text-sm ${
            message.ok
              ? "bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100"
              : "bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200"
          }`}
        >
          {message.text}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {days.map((day) => {
          const items = appointments.filter((a) => a.day === day);
          return (
            <section
              key={day}
              aria-label={formatDay(day, { weekday: "long", day: "numeric", month: "long" })}
              onDragOver={(event) => {
                if (!canMove) return;
                event.preventDefault();
                setOverDay(day);
              }}
              onDragLeave={() => setOverDay((current) => (current === day ? null : current))}
              onDrop={(event) => {
                event.preventDefault();
                drop(day, event.dataTransfer.getData("text/plain"));
              }}
              className={`min-h-40 rounded-2xl border bg-zinc-50/60 p-3 transition-colors dark:bg-zinc-900/40 ${
                overDay === day
                  ? "border-blue-600 ring-1 ring-blue-600"
                  : "border-zinc-200 dark:border-zinc-800"
              }`}
            >
              <Link
                href={`/panel?${new URLSearchParams({ salon: salonSlug, gun: day })}`}
                className="flex items-baseline justify-between gap-2 underline-offset-4 hover:underline"
              >
                <span className="font-semibold">
                  {day === today ? "Bugün" : formatDay(day, { weekday: "short" })}{" "}
                  <span className="font-normal text-zinc-500 tabular-nums">
                    {formatDay(day, { day: "numeric", month: "short" })}
                  </span>
                </span>
                <span className="text-sm text-zinc-500 tabular-nums">{items.length}</span>
              </Link>

              <ul className="mt-3 space-y-1.5">
                {items.map((a) => {
                  const movable =
                    canMove && (a.status === "confirmed" || a.status === "pending_payment");
                  return (
                    <li
                      key={a.appointment_id}
                      draggable={movable}
                      onDragStart={(event) => {
                        event.dataTransfer.setData("text/plain", a.appointment_id);
                        event.dataTransfer.effectAllowed = "move";
                      }}
                      className={`rounded-lg border border-zinc-200 bg-background px-2.5 py-1.5 text-sm dark:border-zinc-800 ${
                        movable ? "cursor-grab active:cursor-grabbing" : "text-zinc-500"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span
                          aria-hidden="true"
                          className={`size-1.5 shrink-0 rounded-full ${STATUS_DOT[a.status]}`}
                        />
                        <span className="font-medium tabular-nums">
                          {minutesToLabel(a.startMin)}
                        </span>
                        <span className="min-w-0 truncate">{a.customer_name}</span>
                      </span>
                      <span className="block truncate pl-3.5 text-xs text-zinc-500">
                        {a.barber_name}
                      </span>
                    </li>
                  );
                })}
                {items.length === 0 && <li className="text-sm text-zinc-500">Randevu yok</li>}
              </ul>
            </section>
          );
        })}
      </div>
    </>
  );
}
