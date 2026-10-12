import type { Metadata } from "next";
import { Suspense } from "react";

import { listConsultations } from "@/lib/feedback/queries";
import { dateInZone, formatDay, formatTime } from "@/lib/format";
import { requireMembership } from "@/lib/panel/session";

import { MigrationNotice, PageHeader, PageSkeleton } from "../_components/page-parts";
import { ReplyForm } from "./reply-form";

export const metadata: Metadata = {
  title: "Görsel talepler",
};

export default function ConsultationsPage({ searchParams }: PageProps<"/panel/gorseller">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Consultations searchParams={searchParams} />
    </Suspense>
  );
}

async function Consultations({ searchParams }: Pick<PageProps<"/panel/gorseller">, "searchParams">) {
  const { membership } = await requireMembership(await searchParams, "/panel/gorseller");
  const { salon_id: salonId, timezone, role } = membership;
  const consultations = await listConsultations(salonId);

  const when = (value: string) =>
    `${formatDay(dateInZone(value, timezone), { day: "numeric", month: "long" })}, ${formatTime(value, timezone)}`;

  const header = (
    <PageHeader
      title="Görsel Talepler & Konsültasyon"
      description={
        role === "barber"
          ? "Randevularınıza gelen müşteri görselleri. Yanıtınızı müşteri randevu sayfasında görür."
          : "Müşterilerin randevu öncesi yüklediği görseller ve talepleri. Yanıtlar müşterinin randevu sayfasında görünür."
      }
    />
  );
  if (consultations === null) {
    return (
      <>
        {header}
        <MigrationNotice feature="Görsel talepler" />
      </>
    );
  }

  const open = consultations.filter((c) => c.kind === "staff" && c.status === "open");

  return (
    <div className="max-w-3xl">
      {header}
      <p className="mt-4 text-sm" role="status">
        {open.length > 0 ? `${open.length} talep yanıtınızı bekliyor.` : "Yanıt bekleyen talep yok."}
      </p>

      {consultations.length === 0 ? (
        <p className="mt-6 text-sm text-zinc-500">Henüz görsel talebi yok.</p>
      ) : (
        <ul className="mt-4 space-y-4">
          {consultations.map((item) => (
            <li key={item.id} className="rounded-2xl border border-zinc-200 p-5 dark:border-zinc-800">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <p className="font-semibold">{item.customer_name}</p>
                <p className="text-sm text-zinc-500">
                  {item.kind === "ai"
                    ? "Yapay zekâ önerisi aldı"
                    : item.status === "open"
                      ? "● Yanıt bekliyor"
                      : "Yanıtlandı"}
                </p>
              </div>
              <p className="text-sm text-zinc-500">
                <a href={`tel:${item.customer_phone}`} className="underline underline-offset-4">
                  {item.customer_phone}
                </a>
                {item.appointment_starts_at && ` · Randevu: ${when(item.appointment_starts_at)}`}
                {item.barber_name && ` · ${item.barber_name}`}
              </p>

              {item.imageUrls.length > 0 && (
                <ul className="mt-4 flex flex-wrap gap-3">
                  {item.imageUrls.map((url, index) => (
                    <li key={url}>
                      <a href={url} target="_blank" rel="noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element -- kısa ömürlü imzalı adres */}
                        <img
                          src={url}
                          alt={`${item.customer_name} tarafından yüklenen görsel ${index + 1}`}
                          loading="lazy"
                          className="size-36 rounded-xl object-cover"
                        />
                      </a>
                    </li>
                  ))}
                </ul>
              )}

              {item.customer_note && (
                <p className="mt-4 rounded-lg bg-zinc-100 p-3 text-sm dark:bg-zinc-900">
                  <span className="block text-xs font-medium text-zinc-500">Müşterinin notu</span>
                  {item.customer_note}
                </p>
              )}

              {item.ai_notes && (
                <details className="mt-3 text-sm">
                  <summary className="cursor-pointer font-medium">
                    Müşteriye verilen yapay zekâ önerisi
                  </summary>
                  <p className="mt-2 whitespace-pre-wrap text-zinc-600 dark:text-zinc-400">
                    {item.ai_notes}
                  </p>
                </details>
              )}

              {item.kind === "staff" && (
                <div className="mt-4 border-t border-zinc-200 pt-4 dark:border-zinc-800">
                  <ReplyForm
                    salonId={salonId}
                    consultationId={item.id}
                    reply={item.staff_reply}
                    estimate={item.price_estimate}
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
