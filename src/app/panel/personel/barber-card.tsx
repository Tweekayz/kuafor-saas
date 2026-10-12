"use client";

import { useActionState, useState, useTransition } from "react";

import { saveBreak } from "@/lib/business/actions";
import { formatDuration, formatMoney } from "@/lib/format";
import {
  deleteBarber,
  saveBarber,
  saveBarberServices,
  saveWorkingHours,
} from "@/lib/settings/actions";
import type { FormState, SettingsBarber, SettingsService } from "@/lib/settings/types";

import { FormMessage, inputClass, labelClass, primaryButton, secondaryButton } from "../_components/ui";

// Pazartesi'den başlar; değerler working_hours.day_of_week (0 = Pazar).
const WEEK = [
  [1, "Pazartesi"],
  [2, "Salı"],
  [3, "Çarşamba"],
  [4, "Perşembe"],
  [5, "Cuma"],
  [6, "Cumartesi"],
  [0, "Pazar"],
] as const;

export function NewBarberForm({ salonId }: { salonId: string }) {
  const [state, action, pending] = useActionState(saveBarber, null);

  return (
    <form action={action} className="p-4">
      <input type="hidden" name="salon_id" value={salonId} />
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <label className={labelClass}>
          Ad soyad
          <input
            name="display_name"
            required
            maxLength={100}
            placeholder="örn. Ahmet Yılmaz"
            className={`mt-1 ${inputClass}`}
          />
        </label>
        <label className={labelClass}>
          Unvan
          <input
            name="title"
            maxLength={60}
            placeholder="örn. Usta berber"
            className={`mt-1 ${inputClass}`}
          />
        </label>
        <button type="submit" disabled={pending} className={primaryButton}>
          {pending ? "Ekleniyor…" : "Personel ekle"}
        </button>
      </div>
      <div className="mt-2">
        <FormMessage state={state} />
      </div>
    </form>
  );
}

export function BarberCard({
  salonId,
  currency,
  barber,
  services,
}: {
  salonId: string;
  currency: string;
  barber: SettingsBarber;
  services: SettingsService[];
}) {
  const serviceCount = Object.keys(barber.services).length;
  const dayCount = Object.keys(barber.hours).length;
  // Hizmeti ya da mesaisi olmayan personel randevu sayfasında görünmez.
  const incomplete = serviceCount === 0 || dayCount === 0;
  const [open, setOpen] = useState(incomplete);

  return (
    <details
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
      className="rounded-xl border border-zinc-200 dark:border-zinc-800"
    >
      <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
        <span className="font-medium">{barber.display_name}</span>
        {barber.title && <span className="text-sm text-zinc-500">{barber.title}</span>}
        <span className="ml-auto text-sm text-zinc-500">
          {!barber.is_active
            ? "Pasif"
            : incomplete
              ? `⚠ ${serviceCount === 0 ? "Hizmet seçilmedi" : "Çalışma saati girilmedi"} — randevu alınamaz`
              : `${serviceCount} hizmet · haftada ${dayCount} gün`}
        </span>
      </summary>

      <div className="space-y-8 border-t border-zinc-200 p-4 dark:border-zinc-800">
        <ProfileForm salonId={salonId} barber={barber} />
        <ServicesForm salonId={salonId} currency={currency} barber={barber} services={services} />
        <HoursForm salonId={salonId} barber={barber} />
        <BreakForm salonId={salonId} barber={barber} />
      </div>
    </details>
  );
}

function ProfileForm({ salonId, barber }: { salonId: string; barber: SettingsBarber }) {
  const [state, action, pending] = useActionState(saveBarber, null);
  const [deleteState, setDeleteState] = useState<FormState>(null);
  const [deleting, startDelete] = useTransition();

  function remove() {
    if (!window.confirm(`${barber.display_name} silinsin mi?`)) return;
    startDelete(async () => {
      setDeleteState(await deleteBarber(salonId, barber.id));
    });
  }

  return (
    <form action={action}>
      <input type="hidden" name="salon_id" value={salonId} />
      <input type="hidden" name="id" value={barber.id} />
      <h4 className="text-sm font-semibold">Bilgiler</h4>
      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_8rem]">
        <label className={labelClass}>
          Ad soyad
          <input
            name="display_name"
            required
            maxLength={100}
            defaultValue={barber.display_name}
            className={`mt-1 ${inputClass}`}
          />
        </label>
        <label className={labelClass}>
          Unvan
          <input
            name="title"
            maxLength={60}
            defaultValue={barber.title ?? ""}
            className={`mt-1 ${inputClass}`}
          />
        </label>
        <label className={labelClass}>
          Prim oranı (%)
          <input
            name="commission_rate"
            type="number"
            min={0}
            max={100}
            step="0.01"
            defaultValue={barber.commission_rate ?? ""}
            placeholder="0"
            className={`mt-1 ${inputClass}`}
          />
        </label>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="is_active" defaultChecked={barber.is_active} />
          Aktif (randevu alınabilir)
        </label>
        <div className="ml-auto flex items-center gap-3">
          <FormMessage state={deleteState ?? state} />
          <button
            type="button"
            onClick={remove}
            disabled={deleting || pending}
            className={secondaryButton}
          >
            Sil
          </button>
          <button type="submit" disabled={pending || deleting} className={primaryButton}>
            {pending ? "Kaydediliyor…" : "Kaydet"}
          </button>
        </div>
      </div>
    </form>
  );
}

function ServicesForm({
  salonId,
  currency,
  barber,
  services,
}: {
  salonId: string;
  currency: string;
  barber: SettingsBarber;
  services: SettingsService[];
}) {
  const [state, action, pending] = useActionState(saveBarberServices, null);
  // Hiç eşleştirme yokken aktif hizmetler önerilir; kaydedilene kadar geçerli değildir.
  const unsaved = Object.keys(barber.services).length === 0;

  return (
    <form action={action}>
      <input type="hidden" name="salon_id" value={salonId} />
      <input type="hidden" name="barber_id" value={barber.id} />
      <h4 className="text-sm font-semibold">Verdiği hizmetler</h4>
      <p className="mt-1 text-xs text-zinc-500">
        Özel süre ve fiyat boş bırakılırsa hizmetin standart değeri kullanılır.
      </p>
      {unsaved && services.length > 0 && <UnsavedHint button="Hizmetleri kaydet" />}

      {services.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-500">Önce yukarıdan hizmet ekleyin.</p>
      ) : (
        <>
          <ul className="mt-3 divide-y divide-zinc-100 dark:divide-zinc-900">
            {services.map((service) => {
              const assigned = barber.services[service.id];
              return (
                <li
                  key={service.id}
                  className="grid grid-cols-[1fr_5.5rem_6.5rem] items-center gap-3 py-2"
                >
                  <label className="flex min-w-0 items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="service"
                      value={service.id}
                      defaultChecked={unsaved ? service.is_active : assigned !== undefined}
                    />
                    <span className="min-w-0">
                      <span className="block truncate font-medium">
                        {service.name}
                        {!service.is_active && (
                          <span className="font-normal text-zinc-500"> (pasif)</span>
                        )}
                      </span>
                      <span className="block text-xs text-zinc-500">
                        {formatDuration(service.duration_minutes)} ·{" "}
                        {formatMoney(service.price, currency)}
                      </span>
                    </span>
                  </label>
                  <input
                    name={`duration:${service.id}`}
                    type="number"
                    min={5}
                    max={600}
                    step={5}
                    defaultValue={assigned?.duration ?? ""}
                    placeholder="Süre"
                    aria-label={`${service.name} için özel süre (dakika)`}
                    className={inputClass}
                  />
                  <input
                    name={`price:${service.id}`}
                    type="number"
                    min={0}
                    step="0.01"
                    defaultValue={assigned?.price ?? ""}
                    placeholder="Fiyat"
                    aria-label={`${service.name} için özel fiyat`}
                    className={inputClass}
                  />
                </li>
              );
            })}
          </ul>
          <div className="mt-3 flex items-center justify-end gap-3">
            <FormMessage state={state} />
            <button type="submit" disabled={pending} className={primaryButton}>
              {pending ? "Kaydediliyor…" : "Hizmetleri kaydet"}
            </button>
          </div>
        </>
      )}
    </form>
  );
}

function BreakForm({ salonId, barber }: { salonId: string; barber: SettingsBarber }) {
  const [state, action, pending] = useActionState(saveBreak, null);

  return (
    <form action={action}>
      <input type="hidden" name="salon_id" value={salonId} />
      <input type="hidden" name="barber_id" value={barber.id} />
      <h4 className="text-sm font-semibold">Mola</h4>
      <p className="mt-1 text-xs text-zinc-500">
        Mola saatinde randevu alınamaz. Mola, personelin çalıştığı her güne uygulanır.
      </p>
      <div className="mt-3 grid grid-cols-[1fr_6.5rem_6.5rem] items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="break_on" defaultChecked={barber.break !== null} />
          Günlük mola var
        </label>
        <input
          type="time"
          name="break_start"
          defaultValue={barber.break?.start ?? "13:00"}
          aria-label="Mola başlangıç"
          className={inputClass}
        />
        <input
          type="time"
          name="break_end"
          defaultValue={barber.break?.end ?? "14:00"}
          aria-label="Mola bitiş"
          className={inputClass}
        />
      </div>
      <div className="mt-3 flex items-center justify-end gap-3">
        <FormMessage state={state} />
        <button type="submit" disabled={pending} className={primaryButton}>
          {pending ? "Kaydediliyor…" : "Molayı kaydet"}
        </button>
      </div>
    </form>
  );
}

function UnsavedHint({ button }: { button: string }) {
  return (
    <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-100">
      Henüz kayıt yok. Aşağıdaki seçim bir öneridir; düzenleyip “{button}” düğmesine basınca
      geçerli olur.
    </p>
  );
}

function HoursForm({ salonId, barber }: { salonId: string; barber: SettingsBarber }) {
  const [state, action, pending] = useActionState(saveWorkingHours, null);
  // Hiç mesai yokken Pazartesi-Cumartesi önerilir; kaydedilene kadar geçerli değildir.
  const unsaved = Object.keys(barber.hours).length === 0;

  return (
    <form action={action}>
      <input type="hidden" name="salon_id" value={salonId} />
      <input type="hidden" name="barber_id" value={barber.id} />
      <h4 className="text-sm font-semibold">Çalışma saatleri</h4>
      <p className="mt-1 text-xs text-zinc-500">İşaretli olmayan günlerde randevu alınamaz.</p>
      {unsaved && <UnsavedHint button="Saatleri kaydet" />}

      <ul className="mt-3 space-y-2">
        {WEEK.map(([day, label]) => {
          const hours = barber.hours[day];
          return (
            <li key={day} className="grid grid-cols-[1fr_6.5rem_6.5rem] items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name={`on:${day}`}
                  defaultChecked={unsaved ? day !== 0 : hours !== undefined}
                />
                {label}
              </label>
              <input
                type="time"
                name={`start:${day}`}
                defaultValue={hours?.start ?? "09:00"}
                aria-label={`${label} başlangıç`}
                className={inputClass}
              />
              <input
                type="time"
                name={`end:${day}`}
                defaultValue={hours?.end ?? "19:00"}
                aria-label={`${label} bitiş`}
                className={inputClass}
              />
            </li>
          );
        })}
      </ul>
      <div className="mt-3 flex items-center justify-end gap-3">
        <FormMessage state={state} />
        <button type="submit" disabled={pending} className={primaryButton}>
          {pending ? "Kaydediliyor…" : "Saatleri kaydet"}
        </button>
      </div>
    </form>
  );
}
