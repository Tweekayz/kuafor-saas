"use client";

import { useState, useTransition } from "react";

import { markEarningsPaid } from "@/lib/panel/actions";

export function PayoutButton({
  salonId,
  barberId,
  barberName,
  amountLabel,
}: {
  salonId: string;
  barberId: string;
  barberName: string;
  amountLabel: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function pay() {
    if (!window.confirm(`${barberName} için ${amountLabel} prim "ödendi" olarak işaretlensin mi?`)) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await markEarningsPaid(salonId, { barberId });
      if (!result.ok) setError(result.message);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={pay}
        disabled={isPending}
        className="rounded-lg border border-zinc-300 px-3 py-1.5 font-medium whitespace-nowrap hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-700 dark:hover:bg-zinc-800"
      >
        {isPending ? "İşleniyor…" : "Ödendi işaretle"}
      </button>
      {error && (
        <p role="alert" className="mt-1 text-xs text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
    </>
  );
}
