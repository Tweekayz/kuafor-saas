"use client";

import { useActionState, useState, useTransition } from "react";

import { deleteService, saveService } from "@/lib/settings/actions";
import type { FormState, SettingsService } from "@/lib/settings/types";

import { FormMessage, inputClass, labelClass, primaryButton, secondaryButton } from "../_components/ui";

/** service verilmezse "yeni hizmet" formu olarak çalışır. */
export function ServiceForm({ salonId, service }: { salonId: string; service?: SettingsService }) {
  const [state, action, pending] = useActionState(saveService, null);
  const [deleteState, setDeleteState] = useState<FormState>(null);
  const [deleting, startDelete] = useTransition();

  function remove() {
    if (!service || !window.confirm(`"${service.name}" hizmeti silinsin mi?`)) return;
    startDelete(async () => {
      setDeleteState(await deleteService(salonId, service.id));
    });
  }

  return (
    <form action={action} className="p-4">
      <input type="hidden" name="salon_id" value={salonId} />
      {service && <input type="hidden" name="id" value={service.id} />}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-[2fr_1.5fr_6rem_7rem]">
        <label className={`col-span-2 sm:col-span-1 ${labelClass}`}>
          Hizmet adı
          <input
            name="name"
            required
            maxLength={100}
            defaultValue={service?.name}
            placeholder={service ? undefined : "örn. Saç kesimi"}
            className={`mt-1 ${inputClass}`}
          />
        </label>
        <label className={`col-span-2 sm:col-span-1 ${labelClass}`}>
          Kategori
          <input
            name="category"
            maxLength={60}
            defaultValue={service?.category ?? ""}
            placeholder={service ? undefined : "örn. Saç"}
            className={`mt-1 ${inputClass}`}
          />
        </label>
        <label className={labelClass}>
          Süre (dk)
          <input
            name="duration"
            type="number"
            required
            min={5}
            max={600}
            step={5}
            defaultValue={service?.duration_minutes ?? 30}
            className={`mt-1 ${inputClass}`}
          />
        </label>
        <label className={labelClass}>
          Fiyat
          <input
            name="price"
            type="number"
            required
            min={0}
            step="0.01"
            defaultValue={service?.price}
            className={`mt-1 ${inputClass}`}
          />
        </label>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        {service && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="is_active" defaultChecked={service.is_active} />
            Aktif (randevu alınabilir)
          </label>
        )}
        <div className="ml-auto flex items-center gap-3">
          <FormMessage state={deleteState ?? state} />
          {service && (
            <button
              type="button"
              onClick={remove}
              disabled={deleting || pending}
              className={secondaryButton}
            >
              Sil
            </button>
          )}
          <button type="submit" disabled={pending || deleting} className={primaryButton}>
            {pending ? "Kaydediliyor…" : service ? "Kaydet" : "Hizmet ekle"}
          </button>
        </div>
      </div>
    </form>
  );
}
