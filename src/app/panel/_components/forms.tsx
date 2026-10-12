"use client";

import { useState, useTransition } from "react";

import type { FormState } from "@/lib/panel/guard";

import { FormMessage, secondaryButton } from "./ui";

/** Onay isteyip bir silme işlemini çalıştıran düğme; hata olursa yanında gösterir. */
export function DeleteButton({
  confirmText,
  action,
  label = "Sil",
}: {
  confirmText: string;
  action: () => Promise<FormState>;
  label?: string;
}) {
  const [state, setState] = useState<FormState>(null);
  const [pending, startTransition] = useTransition();

  return (
    <span className="inline-flex items-center gap-2">
      {state && !state.ok && <FormMessage state={state} />}
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!window.confirm(confirmText)) return;
          startTransition(async () => setState(await action()));
        }}
        className={secondaryButton}
      >
        {pending ? "Siliniyor…" : label}
      </button>
    </span>
  );
}
