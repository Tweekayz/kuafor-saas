import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

import { Stars } from "@/components/review-form";
import { isAiConfigured } from "@/lib/ai/style-advice";
import { getSalonCatalog } from "@/lib/booking/queries";
import { getSalonReviews } from "@/lib/customer/queries";
import { dateInZone, formatDay, minutesInZone, todayInZone } from "@/lib/format";
import { closedWeekdays, firstOpenDay } from "@/lib/schedule";

import { BookingWizard } from "./booking-wizard";

export const metadata: Metadata = {
  title: "Online randevu",
};

const ratingFormat = new Intl.NumberFormat("tr-TR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export default function BookingPage({ params }: PageProps<"/randevu/[slug]">) {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:py-12">
      <Suspense fallback={<BookingSkeleton />}>
        <Booking params={params} />
      </Suspense>
    </main>
  );
}

async function Booking({ params }: Pick<PageProps<"/randevu/[slug]">, "params">) {
  const { slug } = await params;
  const catalog = await getSalonCatalog(slug);
  if (!catalog) notFound();
  const reviews = await getSalonReviews(catalog.salon.id);

  // "Bugün" istek anına bağlıdır; salonun saat dilimine göre hesaplanır.
  await connection();
  const { salon } = catalog;
  const today = todayInZone(salon.timezone);

  // Kapanış saati geçtiyse ya da salon bugün kapalıysa takvim bir sonraki
  // çalışma gününde açılır.
  const staffHours = catalog.barbers.map((b) => b.hours);
  const initialDate = firstOpenDay(
    today,
    minutesInZone(new Date(), salon.timezone),
    staffHours,
    salon.max_booking_days_ahead,
  );

  const location = [salon.address, salon.city].filter(Boolean).join(", ");

  return (
    <>
      <header className="mb-8">
        <p className="text-sm font-medium text-zinc-500">Online randevu</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">{salon.name}</h1>
        {location && <p className="mt-1 text-zinc-600 dark:text-zinc-400">{location}</p>}
        {reviews && reviews.average !== null && (
          <a
            href={reviews.reviews.length > 0 ? "#yorumlar" : undefined}
            className="mt-3 inline-flex items-center gap-2 rounded-full border border-zinc-200 px-3 py-1 text-sm dark:border-zinc-800"
          >
            <span className="font-semibold tabular-nums">
              {ratingFormat.format(reviews.average)}
            </span>
            <Stars value={reviews.average} />
            <span className="text-zinc-500">{reviews.total} değerlendirme</span>
          </a>
        )}
      </header>

      {catalog.services.length === 0 ? (
        <p className="rounded-xl border border-zinc-200 p-6 text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
          Bu salon şu anda online randevu kabul etmiyor.
          {salon.phone && (
            <>
              {" "}
              Randevu için{" "}
              <a className="font-medium underline" href={`tel:${salon.phone}`}>
                {salon.phone}
              </a>{" "}
              numarasını arayabilirsiniz.
            </>
          )}
        </p>
      ) : (
        <BookingWizard
          catalog={catalog}
          today={today}
          initialDate={initialDate}
          closedWeekdays={closedWeekdays(staffHours)}
          extrasEnabled={reviews !== null}
          aiAvailable={isAiConfigured()}
        />
      )}

      {reviews && reviews.reviews.length > 0 && (
        <section id="yorumlar" className="mt-16 scroll-mt-6">
          <h2 className="text-xl font-semibold tracking-tight">Müşteri Değerlendirmeleri</h2>
          {reviews.average !== null && (
            <p className="mt-1 flex items-center gap-2 text-sm text-zinc-500">
              <Stars value={reviews.average} />
              {ratingFormat.format(reviews.average)} · {reviews.total} değerlendirme
            </p>
          )}
          <ul className="mt-4 space-y-3">
            {reviews.reviews.map((review) => (
              <li
                key={review.id}
                className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
              >
                <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  <Stars value={review.rating} />
                  <span className="font-medium">{review.author_name}</span>
                  <span className="text-zinc-500">
                    {formatDay(dateInZone(review.created_at, salon.timezone), {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </span>
                </p>
                {review.comment && (
                  <p className="mt-2 text-sm whitespace-pre-wrap">{review.comment}</p>
                )}
                {review.photoUrls.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {review.photoUrls.map((url, index) => (
                      // eslint-disable-next-line @next/next/no-img-element -- depodaki müşteri fotoğrafı
                      <img
                        key={url}
                        src={url}
                        alt={`${review.author_name} tarafından paylaşılan fotoğraf ${index + 1}`}
                        loading="lazy"
                        className="size-24 rounded-lg object-cover"
                      />
                    ))}
                  </div>
                )}
                {review.reply && (
                  <p className="mt-3 rounded-lg bg-zinc-100 p-3 text-sm dark:bg-zinc-900">
                    <span className="block text-xs font-medium text-zinc-500">
                      {salon.name} yanıtladı
                    </span>
                    {review.reply}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function BookingSkeleton() {
  return (
    <div className="animate-pulse" aria-busy="true" aria-label="Yükleniyor">
      <div className="h-4 w-28 rounded bg-zinc-200 dark:bg-zinc-800" />
      <div className="mt-3 h-8 w-64 rounded bg-zinc-200 dark:bg-zinc-800" />
      <div className="mt-10 space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-16 rounded-xl bg-zinc-100 dark:bg-zinc-900" />
        ))}
      </div>
    </div>
  );
}
