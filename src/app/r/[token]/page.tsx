import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ConsultationBox } from "@/components/consultation-box";
import { ReviewForm, Stars } from "@/components/review-form";
import { getCustomerAppointment } from "@/lib/customer/queries";
import { dateInZone, formatDay, formatMoney, formatTime } from "@/lib/format";
import type { AppointmentStatus } from "@/lib/panel/types";

// Müşterinin randevu sayfası. Adresteki gizli bağlantı randevunun anahtarıdır;
// bilen herkes bu randevuyu görebilir, bu yüzden sayfa aranmaz ve bağlantı
// başka sitelere gönderilmez.
export const metadata: Metadata = {
  title: "Randevunuz",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

const STATUS_TEXT: Record<AppointmentStatus, string> = {
  pending_payment: "Kapora bekleniyor",
  confirmed: "Onaylandı",
  completed: "Tamamlandı",
  cancelled: "İptal edildi",
  no_show: "Gelinmedi",
};

export default function CustomerAppointmentPage({ params }: PageProps<"/r/[token]">) {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:py-12">
      <Suspense
        fallback={
          <div className="animate-pulse" aria-busy="true" aria-label="Yükleniyor">
            <div className="h-8 w-56 rounded bg-zinc-200 dark:bg-zinc-800" />
            <div className="mt-6 h-40 rounded-2xl bg-zinc-100 dark:bg-zinc-900" />
          </div>
        }
      >
        <Appointment params={params} />
      </Suspense>
    </main>
  );
}

async function Appointment({ params }: Pick<PageProps<"/r/[token]">, "params">) {
  const { token } = await params;
  const appointment = await getCustomerAppointment(token);
  if (!appointment) notFound();

  const { salon, review } = appointment;
  const closed = appointment.status === "cancelled" || appointment.status === "no_show";
  const card = "mt-6 rounded-2xl border border-zinc-200 p-6 dark:border-zinc-800";

  return (
    <>
      <p className="text-sm font-medium text-zinc-500">Randevunuz</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">{salon.name}</h1>

      <section className={card}>
        <dl className="space-y-3 text-sm">
          <Row label="Durum">{STATUS_TEXT[appointment.status]}</Row>
          <Row label="Tarih">
            {formatDay(dateInZone(appointment.startsAt, salon.timezone), {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </Row>
          <Row label="Saat">
            {formatTime(appointment.startsAt, salon.timezone)} –{" "}
            {formatTime(appointment.endsAt, salon.timezone)}
          </Row>
          {appointment.barberName && <Row label="Personel">{appointment.barberName}</Row>}
          <Row label="Hizmetler">{appointment.services.join(", ")}</Row>
          <Row label="Toplam">{formatMoney(appointment.totalPrice, salon.currency)}</Row>
        </dl>
        {salon.phone && (
          <p className="mt-4 text-sm text-zinc-500">
            Değişiklik ya da iptal için:{" "}
            <a href={`tel:${salon.phone}`} className="font-medium underline underline-offset-4">
              {salon.phone}
            </a>
          </p>
        )}
      </section>

      {appointment.status === "completed" && review !== undefined && (
        <section className={card}>
          <h2 className="text-xl font-semibold tracking-tight">Deneyiminizi değerlendirin</h2>
          {review ? (
            <div className="mt-4 space-y-3 text-sm">
              <p className="flex items-center gap-2">
                <Stars value={review.rating} className="size-5" />
                <span className="text-zinc-500">Değerlendirmeniz alındı, teşekkür ederiz.</span>
              </p>
              {review.comment && <p className="whitespace-pre-wrap">{review.comment}</p>}
              {review.reply && (
                <p className="rounded-lg bg-zinc-100 p-3 dark:bg-zinc-900">
                  <span className="block text-xs font-medium text-zinc-500">Salonun yanıtı</span>
                  {review.reply}
                </p>
              )}
            </div>
          ) : (
            <div className="mt-4">
              <ReviewForm token={token} barberName={appointment.barberName} />
            </div>
          )}
        </section>
      )}

      {!closed && appointment.consultations !== null && (
        <section className={card}>
          <h2 className="text-xl font-semibold tracking-tight">Görsel / ilham yükle</h2>
          <p className="mt-1 mb-4 text-sm text-zinc-500">
            İsteğe bağlı. Saçınızın ya da tırnaklarınızın fotoğrafını ve beğendiğiniz modeli
            paylaşın; randevunuza hazırlıklı gelelim.
          </p>
          <ConsultationBox
            token={token}
            currency={salon.currency}
            initial={appointment.consultations}
            aiAvailable={appointment.aiAvailable}
          />
        </section>
      )}

      <p className="mt-8 text-sm text-zinc-500">
        <Link href={`/randevu/${salon.slug}`} className="underline underline-offset-4">
          {salon.name} için yeni randevu al
        </Link>
      </p>
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="shrink-0 text-zinc-500">{label}</dt>
      <dd className="text-right font-medium">{children}</dd>
    </div>
  );
}
