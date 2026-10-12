"use client";

import { useActionState } from "react";

import { addTimeOff, deleteTimeOff } from "@/lib/business/actions";

import { DeleteButton } from "../_components/forms";
import { FormMessage, inputClass, labelClass, primaryButton } from "../_components/ui";

/** Sunucuda salon saatine göre biçimlendirilmiş izin satırı. */
export type TimeOffRow = { id: string; who: string; period: string; reason: string | null };

export function TimeOffSection({
  salonId,
  barbers,
  rows,
  today,
}: {
  salonId: string;
  barbers: { id: string; name: string }[];
  rows: TimeOffRow[];
  today: string;
}) {
  const [state, action, pending] = useActionState(addTimeOff, null);

  return (
    <>
      <form
        action={action}
        className="rounded-xl border border-dashed border-zinc-300 p-4 dark:border-zinc-700"
      >
        <input type="hidden" name="salon_id" value={salonId} />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-[1.2fr_9rem_9rem_1fr_auto] sm:items-end">
          <label className={`col-span-2 sm:col-span-1 ${labelClass}`}>
            Kim
            <select name="barber_id" defaultValue="" className={`mt-1 ${inputClass}`}>
              <option value="">Tüm salon (kapalı gün)</option>
              {barbers.map((barber) => (
                <option key={barber.id} value={barber.id}>
                  {barber.name}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            İlk gün
            <input type="date" name="from" required min={today} className={`mt-1 ${inputClass}`} />
          </label>
          <label className={labelClass}>
            Son gün
            <input type="date" name="to" min={today} className={`mt-1 ${inputClass}`} />
          </label>
          <label className={`col-span-2 sm:col-span-1 ${labelClass}`}>
            Neden
            <input
              name="reason"
              maxLength={100}
              placeholder="örn. Yıllık izin, bayram"
              className={`mt-1 ${inputClass}`}
            />
          </label>
          <button type="submit" disabled={pending} className={primaryButton}>
            {pending ? "Ekleniyor…" : "İzin ekle"}
          </button>
        </div>
        <div className="mt-2">
          <FormMessage state={state} />
        </div>
      </form>

      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-500">Planlanmış izin ya da kapalı gün yok.</p>
      ) : (
        <ul className="mt-3 divide-y divide-zinc-100 rounded-xl border border-zinc-200 text-sm dark:divide-zinc-900 dark:border-zinc-800">
          {rows.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
              <span className="font-medium">{row.who}</span>
              <span className="tabular-nums">{row.period}</span>
              <span className="min-w-0 flex-1 truncate text-zinc-500">{row.reason}</span>
              <DeleteButton
                confirmText="Bu izin kaydı silinsin mi?"
                action={() => deleteTimeOff(salonId, row.id)}
              />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
