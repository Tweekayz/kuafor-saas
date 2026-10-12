"use client";

import { useActionState, useState } from "react";

import { saveAutomation } from "@/lib/business/actions";
import { DEFAULT_TEMPLATES, TEMPLATE_VARIABLES, renderTemplate } from "@/lib/business/templates";
import type { AutomationSettings } from "@/lib/business/types";

import { FormMessage, inputClass, labelClass, primaryButton } from "../_components/ui";

export function AutomationForm({
  salonId,
  salonName,
  settings,
}: {
  salonId: string;
  salonName: string;
  settings: AutomationSettings;
}) {
  const [state, action, pending] = useActionState(saveAutomation, null);
  const [templates, setTemplates] = useState({
    confirmation: settings.confirmation_template ?? "",
    reminder: settings.reminder_template ?? "",
    review: settings.review_template ?? "",
  });
  const [reviewUrl, setReviewUrl] = useState(settings.review_url ?? "");

  // Önizleme örnek verilerle doldurulur.
  const sample = {
    musteri: "Ayşe",
    salon: salonName,
    tarih: "14 Ekim Çarşamba",
    saat: "14:30",
    personel: "Elif",
    hizmet: "Saç kesimi",
    link: reviewUrl || "https://…",
  };

  const editor = (key: keyof typeof templates, name: string, label: string) => (
    <div>
      <label className={labelClass}>
        {label}
        <textarea
          name={name}
          rows={3}
          maxLength={600}
          value={templates[key]}
          onChange={(e) => setTemplates({ ...templates, [key]: e.target.value })}
          placeholder={DEFAULT_TEMPLATES[key]}
          className={`mt-1 ${inputClass}`}
        />
      </label>
      <p className="mt-2 rounded-lg bg-zinc-100 p-3 text-sm dark:bg-zinc-900">
        <span className="block text-xs font-medium text-zinc-500">
          Önizleme{templates[key] ? "" : " (varsayılan metin)"}
        </span>
        {renderTemplate(templates[key] || DEFAULT_TEMPLATES[key], sample)}
      </p>
    </div>
  );

  return (
    <form action={action} className="space-y-10">
      <input type="hidden" name="salon_id" value={salonId} />

      <section>
        <h2 className="text-lg font-medium">Gönderim kanalı</h2>
        <label className={`mt-3 block max-w-xs ${labelClass}`}>
          Kanal
          <select
            name="notification_channel"
            defaultValue={settings.notification_channel === "sms" ? "sms" : "whatsapp"}
            className={`mt-1 ${inputClass}`}
          >
            <option value="whatsapp">WhatsApp</option>
            <option value="sms">SMS</option>
          </select>
        </label>
        <details className="mt-4 text-sm">
          <summary className="cursor-pointer font-medium">Şablonlarda kullanılabilen değişkenler</summary>
          <ul className="mt-2 grid gap-1 sm:grid-cols-2">
            {TEMPLATE_VARIABLES.map(([variable, description]) => (
              <li key={variable}>
                <code className="font-mono">{variable}</code>{" "}
                <span className="text-zinc-500">{description}</span>
              </li>
            ))}
          </ul>
        </details>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-medium">Randevu onayı</h2>
        <p className="text-sm text-zinc-500">Randevu oluşturulduğunda müşteriye gönderilir.</p>
        {editor("confirmation", "confirmation_template", "Onay mesajı")}
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-medium">Otomatik randevu hatırlatma</h2>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            name="reminders_enabled"
            defaultChecked={settings.reminders_enabled}
          />
          Randevudan 24 saat ve 2 saat önce hatırlatma planla
        </label>
        {editor("reminder", "reminder_template", "Hatırlatma mesajı")}
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-medium">Geri bildirim / yorum isteği</h2>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            name="review_request_enabled"
            defaultChecked={settings.review_request_enabled}
          />
          Randevu tamamlandıktan 2 saat sonra yorum isteği planla
        </label>
        <label className={labelClass}>
          Yorum bağlantısı (örn. Google işletme yorum adresiniz)
          <input
            name="review_url"
            type="url"
            value={reviewUrl}
            onChange={(e) => setReviewUrl(e.target.value)}
            placeholder="https://g.page/r/…/review"
            className={`mt-1 ${inputClass}`}
          />
        </label>
        {editor("review", "review_template", "Yorum isteği mesajı")}
      </section>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className={primaryButton}>
          {pending ? "Kaydediliyor…" : "Otomasyon ayarlarını kaydet"}
        </button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
