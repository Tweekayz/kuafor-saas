"use client";

import { useActionState } from "react";

import { saveBookingRules, saveCustomDomain } from "@/lib/business/actions";
import type { BookingRules } from "@/lib/business/types";

import { FormMessage, inputClass, labelClass, primaryButton } from "../_components/ui";

export function BookingRulesForm({ salonId, rules }: { salonId: string; rules: BookingRules }) {
  const [state, action, pending] = useActionState(saveBookingRules, null);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="salon_id" value={salonId} />
      <label className={labelClass}>
        Randevu saat aralığı
        <select
          name="slot_interval_minutes"
          defaultValue={rules.slot_interval_minutes}
          className={`mt-1 ${inputClass}`}
        >
          {[5, 10, 15, 20, 30, 45, 60].map((minutes) => (
            <option key={minutes} value={minutes}>
              {minutes} dakikada bir (09:00, {minutes < 60 ? `09:${String(minutes).padStart(2, "0")}` : "10:00"}…)
            </option>
          ))}
        </select>
      </label>
      <label className={labelClass}>
        En erken randevu (şu andan kaç dakika sonrası)
        <input
          name="min_booking_notice_minutes"
          type="number"
          required
          min={0}
          max={10080}
          step={5}
          defaultValue={rules.min_booking_notice_minutes}
          className={`mt-1 ${inputClass}`}
        />
      </label>
      <label className={labelClass}>
        En fazla kaç gün sonrasına randevu alınabilir
        <input
          name="max_booking_days_ahead"
          type="number"
          required
          min={1}
          max={365}
          defaultValue={rules.max_booking_days_ahead}
          className={`mt-1 ${inputClass}`}
        />
      </label>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className={primaryButton}>
          {pending ? "Kaydediliyor…" : "Kuralları kaydet"}
        </button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}

export function CustomDomainForm({ salonId, domain }: { salonId: string; domain: string | null }) {
  const [state, action, pending] = useActionState(saveCustomDomain, null);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="salon_id" value={salonId} />
      <label className={labelClass}>
        Kendi alan adınız (isteğe bağlı)
        <input
          name="custom_domain"
          defaultValue={domain ?? ""}
          placeholder="randevu.salonunuz.com"
          autoCapitalize="none"
          spellCheck={false}
          className={`mt-1 ${inputClass}`}
        />
      </label>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className={primaryButton}>
          {pending ? "Kaydediliyor…" : "Alan adını kaydet"}
        </button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
