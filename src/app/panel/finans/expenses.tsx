"use client";

import { useActionState } from "react";

import { addExpense, deleteExpense } from "@/lib/business/actions";
import type { Expense } from "@/lib/business/types";
import { formatDay, formatMoney } from "@/lib/format";

import { DeleteButton } from "../_components/forms";
import { FormMessage, inputClass, labelClass, primaryButton } from "../_components/ui";

const CATEGORIES = ["Kira", "Fatura", "Malzeme", "Maaş", "Vergi", "Diğer"];

export function Expenses({
  salonId,
  currency,
  defaultDate,
  expenses,
}: {
  salonId: string;
  currency: string;
  defaultDate: string;
  expenses: Expense[];
}) {
  const [state, action, pending] = useActionState(addExpense, null);

  return (
    <>
      <form
        action={action}
        className="rounded-xl border border-dashed border-zinc-300 p-4 dark:border-zinc-700"
      >
        <input type="hidden" name="salon_id" value={salonId} />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-[9rem_8rem_1fr_8rem_auto] sm:items-end">
          <label className={labelClass}>
            Tarih
            <input
              type="date"
              name="spent_on"
              required
              defaultValue={defaultDate}
              className={`mt-1 ${inputClass}`}
            />
          </label>
          <label className={labelClass}>
            Kategori
            <select name="category" defaultValue="Diğer" className={`mt-1 ${inputClass}`}>
              {CATEGORIES.map((category) => (
                <option key={category}>{category}</option>
              ))}
            </select>
          </label>
          <label className={`col-span-2 sm:col-span-1 ${labelClass}`}>
            Açıklama
            <input name="description" maxLength={200} className={`mt-1 ${inputClass}`} />
          </label>
          <label className={labelClass}>
            Tutar
            <input
              type="number"
              name="amount"
              required
              min={0.01}
              step="0.01"
              className={`mt-1 ${inputClass}`}
            />
          </label>
          <button type="submit" disabled={pending} className={primaryButton}>
            {pending ? "Ekleniyor…" : "Gider ekle"}
          </button>
        </div>
        <div className="mt-2">
          <FormMessage state={state} />
        </div>
      </form>

      {expenses.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-500">Bu ay için gider kaydı yok.</p>
      ) : (
        <ul className="mt-3 divide-y divide-zinc-100 rounded-xl border border-zinc-200 text-sm dark:divide-zinc-900 dark:border-zinc-800">
          {expenses.map((expense) => (
            <li key={expense.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
              <span className="w-24 text-zinc-500 tabular-nums">
                {formatDay(expense.spent_on, { day: "numeric", month: "short" })}
              </span>
              <span className="font-medium">{expense.category}</span>
              <span className="min-w-0 flex-1 truncate text-zinc-500">{expense.description}</span>
              <span className="font-medium tabular-nums">
                {formatMoney(expense.amount, currency)}
              </span>
              <DeleteButton
                confirmText="Bu gider kaydı silinsin mi?"
                action={() => deleteExpense(salonId, expense.id)}
              />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
