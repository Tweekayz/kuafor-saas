"use client";

import { useActionState } from "react";

import { moderateReview } from "@/lib/feedback/actions";

import { FormMessage, inputClass, labelClass, primaryButton } from "../_components/ui";

export function ReviewModeration({
  salonId,
  reviewId,
  approved,
  featured,
  reply,
}: {
  salonId: string;
  reviewId: string;
  approved: boolean;
  featured: boolean;
  reply: string | null;
}) {
  const [state, action, pending] = useActionState(moderateReview, null);

  return (
    <form action={action}>
      <input type="hidden" name="salon_id" value={salonId} />
      <input type="hidden" name="review_id" value={reviewId} />
      <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="is_approved" defaultChecked={approved} />
          Randevu sayfasında yayınla
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="is_featured" defaultChecked={featured} />
          Öne çıkar (en üstte göster)
        </label>
      </div>
      <label className={`mt-3 ${labelClass}`}>
        Müşteriye yanıtınız (yorumla birlikte görünür)
        <textarea
          name="reply"
          rows={2}
          maxLength={1000}
          defaultValue={reply ?? ""}
          className={`mt-1 ${inputClass}`}
        />
      </label>
      <div className="mt-3 flex items-center gap-3">
        <button type="submit" disabled={pending} className={primaryButton}>
          {pending ? "Kaydediliyor…" : "Kaydet"}
        </button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
