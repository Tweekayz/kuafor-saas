import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { requireMembership } from "@/lib/panel/session";
import { getSalonSettings } from "@/lib/settings/queries";

import { NoAccess, PageHeader, PageSkeleton } from "../_components/page-parts";
import { BarberCard, NewBarberForm } from "./barber-card";

export const metadata: Metadata = {
  title: "Personel ve mesai",
};

export default function StaffPage({ searchParams }: PageProps<"/panel/personel">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Staff searchParams={searchParams} />
    </Suspense>
  );
}

async function Staff({ searchParams }: Pick<PageProps<"/panel/personel">, "searchParams">) {
  const { membership, isAdmin } = await requireMembership(await searchParams, "/panel/personel");
  if (!isAdmin) return <NoAccess />;

  const { salon_id: salonId, currency } = membership;
  const { services, barbers } = await getSalonSettings(salonId);
  const hasBookableBarber = barbers.some(
    (b) => b.is_active && Object.keys(b.services).length > 0 && Object.keys(b.hours).length > 0,
  );

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Personel & Mesai"
        description="Her personelin verdiği hizmetler, kişiye özel süre ve fiyatlar, prim oranı ve haftalık çalışma saatleri."
      />

      {!hasBookableBarber && (
        <p className="mt-6 rounded-lg bg-amber-50 p-4 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">
          Online randevu henüz alınamıyor. Bir personelin randevu alabilmesi için aktif olması,
          en az bir hizmet vermesi ve çalışma saatlerinin girilmiş olması gerekir.
          {services.length === 0 && (
            <>
              {" "}
              Önce{" "}
              <Link
                href={`/panel/hizmetler?salon=${membership.salon_slug}`}
                className="font-medium underline"
              >
                hizmet ekleyin
              </Link>
              .
            </>
          )}
        </p>
      )}

      <section className="mt-6">
        <h2 className="text-lg font-medium">Yeni personel</h2>
        <div className="mt-3 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700">
          <NewBarberForm salonId={salonId} />
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-medium">
          Personel <span className="font-normal text-zinc-500">({barbers.length})</span>
        </h2>
        {barbers.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">Henüz personel eklenmemiş.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {barbers.map((barber) => (
              <BarberCard
                key={barber.id}
                salonId={salonId}
                currency={currency}
                barber={barber}
                services={services}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
