import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

import { getSalonCatalog } from "@/lib/booking/queries";
import { todayInZone } from "@/lib/format";

import { BookingWizard } from "./booking-wizard";

export const metadata: Metadata = {
  title: "Online randevu",
};

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

  // "Bugün" istek anına bağlıdır; salonun saat dilimine göre hesaplanır.
  await connection();
  const today = todayInZone(catalog.salon.timezone);

  const { salon } = catalog;
  const location = [salon.address, salon.city].filter(Boolean).join(", ");

  return (
    <>
      <header className="mb-8">
        <p className="text-sm font-medium text-zinc-500">Online randevu</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">{salon.name}</h1>
        {location && <p className="mt-1 text-zinc-600 dark:text-zinc-400">{location}</p>}
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
        <BookingWizard catalog={catalog} today={today} />
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
