"use client";

import { useActionState } from "react";

import { addCustomerNote, saveCustomer } from "@/lib/business/actions";
import { VIP_TAG, type CustomerDetail } from "@/lib/business/types";

import { FormMessage, inputClass, labelClass, primaryButton } from "../_components/ui";

export function CustomerCardForm({ salonId, customer }: { salonId: string; customer: CustomerDetail }) {
  const [state, action, pending] = useActionState(saveCustomer, null);
  const otherTags = customer.tags.filter((tag) => tag !== VIP_TAG);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="salon_id" value={salonId} />
      <input type="hidden" name="customer_id" value={customer.id} />
      <label className="flex items-center gap-2 text-sm font-medium">
        <input type="checkbox" name="vip" defaultChecked={customer.tags.includes(VIP_TAG)} />
        VIP müşteri
      </label>
      <label className={labelClass}>
        Etiketler (virgülle ayırın)
        <input
          name="tags"
          defaultValue={otherTags.join(", ")}
          placeholder="örn. Boya, Öğrenci"
          className={`mt-1 ${inputClass}`}
        />
      </label>
      <label className={labelClass}>
        Alerji / hassasiyet
        <textarea
          name="allergies"
          rows={2}
          maxLength={500}
          defaultValue={customer.allergies ?? ""}
          className={`mt-1 ${inputClass}`}
        />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="is_blocked" defaultChecked={customer.is_blocked} />
        Online randevu almasını engelle
      </label>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className={primaryButton}>
          {pending ? "Kaydediliyor…" : "Kaydet"}
        </button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}

export function CustomerNoteForm({ salonId, customerId }: { salonId: string; customerId: string }) {
  const [state, action, pending] = useActionState(addCustomerNote, null);

  return (
    <form action={action}>
      <input type="hidden" name="salon_id" value={salonId} />
      <input type="hidden" name="customer_id" value={customerId} />
      <label className={labelClass}>
        Yeni not (müşteri görmez)
        <textarea name="note" required rows={2} maxLength={1000} className={`mt-1 ${inputClass}`} />
      </label>
      <div className="mt-2 flex items-center gap-3">
        <button type="submit" disabled={pending} className={primaryButton}>
          {pending ? "Ekleniyor…" : "Not ekle"}
        </button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
