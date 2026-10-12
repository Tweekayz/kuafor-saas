import type { Metadata } from "next";
import { Suspense } from "react";

import { getAutomationSettings, getNotificationQueue } from "@/lib/business/queries";
import { dateInZone, formatDay, formatTime } from "@/lib/format";
import { requireMembership } from "@/lib/panel/session";

import { MigrationNotice, NoAccess, PageHeader, PageSkeleton } from "../_components/page-parts";
import { AutomationForm } from "./automation-form";

export const metadata: Metadata = {
  title: "Otomasyonlar",
};

const TYPE_LABEL: Record<string, string> = {
  booking_confirmation: "Randevu onayı",
  reminder_24h: "Hatırlatma (24 saat)",
  reminder_2h: "Hatırlatma (2 saat)",
  rescheduled: "Erteleme bildirimi",
  cancellation: "İptal bildirimi",
  review_request: "Yorum isteği",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Gönderilmeyi bekliyor",
  sending: "Gönderiliyor",
  sent: "Gönderildi",
  failed: "Gönderilemedi",
  cancelled: "İptal edildi",
};

export default function AutomationPage({ searchParams }: PageProps<"/panel/otomasyon">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Automation searchParams={searchParams} />
    </Suspense>
  );
}

async function Automation({ searchParams }: Pick<PageProps<"/panel/otomasyon">, "searchParams">) {
  const { membership, isAdmin } = await requireMembership(await searchParams, "/panel/otomasyon");
  if (!isAdmin) return <NoAccess />;

  const { salon_id: salonId, timezone } = membership;
  const [settings, queue] = await Promise.all([
    getAutomationSettings(salonId),
    getNotificationQueue(salonId),
  ]);

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Otomasyonlar"
        description="Randevu onayı, hatırlatma ve yorum isteği mesajlarının metni ve zamanlaması."
      />

      <div className="mt-6 rounded-xl bg-amber-50 p-5 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">
        <p className="font-semibold">Mesaj gönderimi henüz bağlı değil</p>
        <p className="mt-1">
          Buradaki ayarlar mesajların ne zaman ve hangi metinle hazırlanacağını belirler ve
          mesajlar aşağıdaki kuyruğa yazılır. Müşteriye gerçekten ulaşması için bir SMS ya da
          WhatsApp Business sağlayıcı hesabının sisteme bağlanması gerekir; o bağlanana kadar
          hiçbir mesaj gönderilmez.
        </p>
      </div>

      {settings === null ? (
        <MigrationNotice feature="Otomasyon ayarları" />
      ) : (
        <div className="mt-8">
          <AutomationForm salonId={salonId} salonName={membership.salon_name} settings={settings} />
        </div>
      )}

      <section className="mt-12">
        <h2 className="text-lg font-medium">Mesaj kuyruğu</h2>
        <p className="mt-1 text-sm text-zinc-500">Planlanan son 25 mesaj.</p>
        {queue.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">Kuyrukta mesaj yok.</p>
        ) : (
          <ul className="mt-3 divide-y divide-zinc-100 rounded-xl border border-zinc-200 text-sm dark:divide-zinc-900 dark:border-zinc-800">
            {queue.map((item) => (
              <li key={item.id} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-4 py-3">
                <span className="w-36 text-zinc-500 tabular-nums">
                  {formatDay(dateInZone(item.scheduled_at, timezone), {
                    day: "numeric",
                    month: "short",
                  })}
                  , {formatTime(item.scheduled_at, timezone)}
                </span>
                <span className="font-medium">{TYPE_LABEL[item.type] ?? item.type}</span>
                <span className="min-w-0 flex-1 truncate text-zinc-500">{item.customer_name}</span>
                <span className="text-zinc-500">{STATUS_LABEL[item.status] ?? item.status}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
