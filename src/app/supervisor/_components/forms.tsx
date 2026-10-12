"use client";

import { useActionState, useState, useTransition } from "react";

import type { FormState } from "@/lib/panel/guard";
import {
  approveDomain,
  createSalonWithOwner,
  deleteSalonAsSupervisor,
  rejectDomain,
  updateSalonAsSupervisor,
} from "@/lib/supervisor/actions";
import { PLAN_LABEL, type PlanKey, type SupervisorSalon } from "@/lib/supervisor/types";

import {
  FormMessage,
  inputClass,
  labelClass,
  primaryButton,
  secondaryButton,
} from "../../panel/_components/ui";

const PLAN_OPTIONS = Object.entries(PLAN_LABEL) as [PlanKey, string][];

export function NewSalonForm() {
  const [state, action, pending] = useActionState(createSalonWithOwner, null);

  return (
    <form action={action}>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className={labelClass}>
          Salon adı
          <input name="name" required minLength={2} maxLength={100} className={`mt-1 ${inputClass}`} />
        </label>
        <label className={labelClass}>
          Adres takısı (isteğe bağlı)
          <input
            name="slug"
            maxLength={60}
            placeholder="addan üretilir"
            className={`mt-1 ${inputClass}`}
          />
        </label>
        <label className={labelClass}>
          Paket
          <select name="plan" defaultValue="starter" className={`mt-1 ${inputClass}`}>
            {PLAN_OPTIONS.map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          Şehir
          <input name="city" maxLength={60} className={`mt-1 ${inputClass}`} />
        </label>
        <label className={labelClass}>
          Sahibin adı
          <input name="owner_name" maxLength={100} className={`mt-1 ${inputClass}`} />
        </label>
        <label className={labelClass}>
          Sahibin e-postası
          <input name="email" type="email" required className={`mt-1 ${inputClass}`} />
        </label>
        <label className={labelClass}>
          Geçici şifre (yeni hesapsa)
          <input
            name="password"
            type="text"
            minLength={8}
            maxLength={72}
            autoComplete="off"
            className={`mt-1 ${inputClass}`}
          />
        </label>
        <label className={labelClass}>
          Salon telefonu
          <input name="phone" type="tel" maxLength={30} className={`mt-1 ${inputClass}`} />
        </label>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button type="submit" disabled={pending} className={primaryButton}>
          {pending ? "Oluşturuluyor…" : "Salon ve hesap oluştur"}
        </button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}

export function SalonEditForm({ salon }: { salon: SupervisorSalon }) {
  const [state, action, pending] = useActionState(updateSalonAsSupervisor, null);
  const [deleteState, setDeleteState] = useState<FormState>(null);
  const [deleting, startDelete] = useTransition();

  function remove() {
    const typed = window.prompt(
      `"${salon.name}" salonu; randevuları, müşterileri ve tüm verisiyle birlikte KALICI olarak silinecek.\n\nOnaylamak için adres takısını yazın: ${salon.slug}`,
    );
    if (typed === null) return;
    const deleteOwner = window.confirm(
      `Sahibin giriş hesabı da (${salon.owner.email ?? "e-posta yok"}) silinsin mi?\n\nTamam = hesabı da sil, İptal = hesabı bırak`,
    );
    startDelete(async () => {
      setDeleteState(await deleteSalonAsSupervisor(salon.id, typed.trim(), deleteOwner));
    });
  }

  return (
    <form action={action}>
      <input type="hidden" name="salon_id" value={salon.id} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className={labelClass}>
          Salon adı
          <input
            name="name"
            required
            minLength={2}
            maxLength={100}
            defaultValue={salon.name}
            className={`mt-1 ${inputClass}`}
          />
        </label>
        <label className={labelClass}>
          Paket
          <select name="plan" defaultValue={salon.plan} className={`mt-1 ${inputClass}`}>
            {PLAN_OPTIONS.map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          Telefon
          <input
            name="phone"
            type="tel"
            maxLength={30}
            defaultValue={salon.phone ?? ""}
            className={`mt-1 ${inputClass}`}
          />
        </label>
        <label className={labelClass}>
          Şehir
          <input
            name="city"
            maxLength={60}
            defaultValue={salon.city ?? ""}
            className={`mt-1 ${inputClass}`}
          />
        </label>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="is_active" defaultChecked={salon.is_active} />
          Üyelik aktif (işareti kaldırmak salonu dondurur)
        </label>
        <div className="ml-auto flex items-center gap-3">
          <FormMessage state={deleteState ?? state} />
          <button
            type="button"
            onClick={remove}
            disabled={deleting || pending}
            className={`${secondaryButton} text-red-700 dark:text-red-300`}
          >
            {deleting ? "Siliniyor…" : "Salonu sil"}
          </button>
          <button type="submit" disabled={pending || deleting} className={primaryButton}>
            {pending ? "Kaydediliyor…" : "Kaydet"}
          </button>
        </div>
      </div>
    </form>
  );
}

/** Domain talebi için Onayla / Reddet (aktifse Kaldır) düğmeleri. */
export function DomainActions({
  salonId,
  domain,
  active,
}: {
  salonId: string;
  domain: string;
  active: boolean;
}) {
  const [state, setState] = useState<FormState>(null);
  const [pending, startTransition] = useTransition();

  const run = (action: () => Promise<FormState>) =>
    startTransition(async () => setState(await action()));

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <FormMessage state={state} />
      {!active && (
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => approveDomain(salonId))}
          className={primaryButton}
        >
          {pending ? "İşleniyor…" : "Onayla"}
        </button>
      )}
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!active || window.confirm(`${domain} yayından kaldırılsın mı?`)) {
            run(() => rejectDomain(salonId));
          }
        }}
        className={secondaryButton}
      >
        {active ? "Kaldır" : "Reddet"}
      </button>
    </div>
  );
}
