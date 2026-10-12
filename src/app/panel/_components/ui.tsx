import type { FormState } from "@/lib/settings/types";

export const inputClass =
  "w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 dark:border-zinc-700 dark:focus:border-zinc-100 dark:focus:ring-zinc-100";

export const labelClass = "block text-xs font-medium text-zinc-500";

export const primaryButton =
  "rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium whitespace-nowrap text-white transition-colors hover:bg-zinc-700 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300";

export const secondaryButton =
  "rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium whitespace-nowrap hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-700 dark:hover:bg-zinc-800";

export function FormMessage({ state }: { state: FormState }) {
  if (!state) return null;
  return (
    <p
      role={state.ok ? "status" : "alert"}
      className={`text-sm ${state.ok ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-300"}`}
    >
      {state.ok ? "✓ " : ""}
      {state.message}
    </p>
  );
}
