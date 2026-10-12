import type { Metadata } from "next";
import { Suspense } from "react";

import { requireMembership } from "@/lib/panel/session";
import { getSalonSettings } from "@/lib/settings/queries";

import { NoAccess, PageHeader, PageSkeleton } from "../_components/page-parts";
import { ServiceForm } from "./service-form";

export const metadata: Metadata = {
  title: "Hizmet yönetimi",
};

export default function ServicesPage({ searchParams }: PageProps<"/panel/hizmetler">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Services searchParams={searchParams} />
    </Suspense>
  );
}

async function Services({ searchParams }: Pick<PageProps<"/panel/hizmetler">, "searchParams">) {
  const { membership, isAdmin } = await requireMembership(await searchParams, "/panel/hizmetler");
  if (!isAdmin) return <NoAccess />;

  const salonId = membership.salon_id;
  const { services } = await getSalonSettings(salonId);

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Hizmet Yönetimi"
        description="Salonunuzda verilen hizmetler, süreleri ve standart fiyatları."
      />

      <section className="mt-6">
        <h2 className="text-lg font-medium">Yeni hizmet</h2>
        <div className="mt-3 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700">
          <ServiceForm salonId={salonId} />
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-medium">
          Hizmetler <span className="font-normal text-zinc-500">({services.length})</span>
        </h2>
        {services.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">Henüz hizmet eklenmemiş.</p>
        ) : (
          <div className="mt-3 divide-y divide-zinc-200 rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {services.map((service) => (
              <ServiceForm key={service.id} salonId={salonId} service={service} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
