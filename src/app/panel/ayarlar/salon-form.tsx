"use client";

import { useActionState } from "react";

import { createSalon, updateSalon } from "@/lib/settings/actions";
import type { SalonProfile } from "@/lib/settings/types";

import { FormMessage, inputClass, labelClass, primaryButton } from "../_components/ui";

/** salon verilmezse "salon oluştur" formu olarak çalışır. */
export function SalonForm({ salon }: { salon?: SalonProfile }) {
  const [state, action, pending] = useActionState(salon ? updateSalon : createSalon, null);

  return (
    <form action={action} className="space-y-4">
      {salon && <input type="hidden" name="salon_id" value={salon.id} />}
      <label className={labelClass}>
        Salon adı
        <input
          name="name"
          required
          minLength={2}
          maxLength={100}
          defaultValue={salon?.name}
          className={`mt-1 ${inputClass}`}
        />
      </label>
      <label className={labelClass}>
        Randevu adresi{!salon && " (isteğe bağlı)"}
        <span className="mt-1 flex items-center gap-1 text-sm text-zinc-500">
          /randevu/
          <input
            name="slug"
            required={salon !== undefined}
            minLength={3}
            maxLength={60}
            defaultValue={salon?.slug}
            placeholder={salon ? undefined : "salon adından üretilir"}
            className={inputClass}
          />
        </span>
        {salon && (
          <span className="mt-1 block font-normal">
            Dikkat: adresi değiştirirseniz müşterilerinizle paylaştığınız eski bağlantı çalışmaz.
          </span>
        )}
      </label>
      <label className={labelClass}>
        Telefon
        <input
          name="phone"
          type="tel"
          autoComplete="tel"
          maxLength={30}
          defaultValue={salon?.phone ?? ""}
          className={`mt-1 ${inputClass}`}
        />
      </label>
      <label className={labelClass}>
        Şehir
        <input
          name="city"
          maxLength={60}
          defaultValue={salon?.city ?? ""}
          className={`mt-1 ${inputClass}`}
        />
      </label>
      <label className={labelClass}>
        Adres
        <input
          name="address"
          maxLength={200}
          defaultValue={salon?.address ?? ""}
          className={`mt-1 ${inputClass}`}
        />
      </label>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className={primaryButton}>
          {pending ? "Kaydediliyor…" : salon ? "Kaydet" : "Salonu oluştur"}
        </button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
