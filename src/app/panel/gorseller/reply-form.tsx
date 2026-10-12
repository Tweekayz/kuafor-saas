"use client";

import { useActionState } from "react";

import { replyConsultation } from "@/lib/feedback/actions";

import { FormMessage, inputClass, labelClass, primaryButton } from "../_components/ui";

export function ReplyForm({
  salonId,
  consultationId,
  reply,
  estimate,
}: {
  salonId: string;
  consultationId: string;
  reply: string | null;
  estimate: number | null;
}) {
  const [state, action, pending] = useActionState(replyConsultation, null);

  return (
    <form action={action}>
      <input type="hidden" name="salon_id" value={salonId} />
      <input type="hidden" name="consultation_id" value={consultationId} />
      <label className={labelClass}>
        Müşteriye yanıtınız
        <textarea
          name="staff_reply"
          required
          rows={3}
          maxLength={1500}
          defaultValue={reply ?? ""}
          placeholder="örn. Bu model saçınıza uygun; önce 2 ton açmamız gerekir, işlem yaklaşık 3 saat sürer."
          className={`mt-1 ${inputClass}`}
        />
      </label>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className={`w-40 ${labelClass}`}>
          Fiyat tahmini (isteğe bağlı)
          <input
            name="price_estimate"
            type="number"
            min={0}
            step="0.01"
            defaultValue={estimate ?? ""}
            className={`mt-1 ${inputClass}`}
          />
        </label>
        <button type="submit" disabled={pending} className={primaryButton}>
          {pending ? "Kaydediliyor…" : reply ? "Yanıtı güncelle" : "Yanıtla"}
        </button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
