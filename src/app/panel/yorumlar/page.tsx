import type { Metadata } from "next";
import { Suspense } from "react";

import { Stars } from "@/components/review-form";
import { listReviews } from "@/lib/feedback/queries";
import { dateInZone, formatDay } from "@/lib/format";
import { requireMembership } from "@/lib/panel/session";

import {
  MigrationNotice,
  NoAccess,
  PageHeader,
  PageSkeleton,
  StatTile,
} from "../_components/page-parts";
import { ReviewModeration } from "./review-moderation";

export const metadata: Metadata = {
  title: "Müşteri yorumları",
};

const ratingFormat = new Intl.NumberFormat("tr-TR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export default function ReviewsPage({ searchParams }: PageProps<"/panel/yorumlar">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Reviews searchParams={searchParams} />
    </Suspense>
  );
}

async function Reviews({ searchParams }: Pick<PageProps<"/panel/yorumlar">, "searchParams">) {
  const { membership, isAdmin } = await requireMembership(await searchParams, "/panel/yorumlar");
  if (!isAdmin) return <NoAccess />;

  const { salon_id: salonId, timezone } = membership;
  const reviews = await listReviews(salonId);

  const header = (
    <PageHeader
      title="Müşteri Yorumları"
      description="Tamamlanan randevulardan gelen değerlendirmeler. Yayınladıklarınız randevu sayfanızda görünür."
    />
  );
  if (reviews === null) {
    return (
      <>
        {header}
        <MigrationNotice feature="Müşteri yorumları" />
      </>
    );
  }

  const average =
    reviews.length > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : null;
  const waiting = reviews.filter((r) => !r.is_approved).length;

  return (
    <div className="max-w-3xl">
      {header}

      <section aria-label="Yorum özeti" className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatTile
          label="Ortalama puan"
          value={average === null ? "—" : `${ratingFormat.format(average)} / 5`}
          detail="Tüm değerlendirmeler"
        />
        <StatTile label="Değerlendirme" value={String(reviews.length)} />
        <StatTile label="Yayında olmayan" value={String(waiting)} />
      </section>
      <p className="mt-2 text-xs text-zinc-500">
        Randevu sayfanızdaki ortalama puan, yayınlayıp yayınlamadığınızdan bağımsız olarak tüm
        değerlendirmelerden hesaplanır. Yayınlama yalnızca yorum metninin ve fotoğrafların
        görünürlüğünü belirler.
      </p>

      {reviews.length === 0 ? (
        <p className="mt-6 text-sm text-zinc-500">
          Henüz değerlendirme yok. Tamamlanan randevunun detayındaki “Değerlendirme bağlantısı”
          ile müşterinizden yorum isteyebilirsiniz.
        </p>
      ) : (
        <ul className="mt-6 space-y-4">
          {reviews.map((review) => (
            <li key={review.id} className="rounded-2xl border border-zinc-200 p-5 dark:border-zinc-800">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <Stars value={review.rating} className="size-5" />
                <span className="font-semibold">{review.customer_name || review.author_name}</span>
                <span className="text-sm text-zinc-500">
                  {formatDay(dateInZone(review.created_at, timezone), {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
                <span className="ml-auto text-sm text-zinc-500">
                  {review.is_approved ? (review.is_featured ? "Öne çıkarıldı" : "Yayında") : "Yayında değil"}
                </span>
              </div>
              {review.barber_name && (
                <p className="mt-1 text-sm text-zinc-500">
                  Personel: {review.barber_name}
                  {review.staff_rating !== null && ` · personel puanı ${review.staff_rating}/5`}
                </p>
              )}
              {review.comment ? (
                <p className="mt-3 whitespace-pre-wrap">{review.comment}</p>
              ) : (
                <p className="mt-3 text-sm text-zinc-500">Yorum yazılmadı, yalnızca puan verildi.</p>
              )}
              {review.photoUrls.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {review.photoUrls.map((url, index) => (
                    <a key={url} href={url} target="_blank" rel="noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element -- depodaki müşteri fotoğrafı */}
                      <img
                        src={url}
                        alt={`Müşterinin paylaştığı fotoğraf ${index + 1}`}
                        loading="lazy"
                        className="size-28 rounded-xl object-cover"
                      />
                    </a>
                  ))}
                </div>
              )}
              <div className="mt-4 border-t border-zinc-200 pt-4 dark:border-zinc-800">
                <ReviewModeration
                  salonId={salonId}
                  reviewId={review.id}
                  approved={review.is_approved}
                  featured={review.is_featured}
                  reply={review.reply}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
