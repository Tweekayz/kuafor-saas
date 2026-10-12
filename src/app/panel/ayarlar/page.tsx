import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { getPanelContext } from "@/lib/panel/queries";
import { firstParam, isAdminRole } from "@/lib/panel/session";
import { getSalonProfile } from "@/lib/settings/queries";

import { NoAccess, PageHeader, PageSkeleton } from "../_components/page-parts";
import { SalonForm } from "./salon-form";

export const metadata: Metadata = {
  title: "Salon ayarları",
};

export default function SettingsPage({ searchParams }: PageProps<"/panel/ayarlar">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Settings searchParams={searchParams} />
    </Suspense>
  );
}

async function Settings({ searchParams }: Pick<PageProps<"/panel/ayarlar">, "searchParams">) {
  const [context, query] = await Promise.all([getPanelContext(), searchParams]);
  if (!context) redirect("/giris?next=/panel/ayarlar");

  // İlk kurulum: kullanıcının henüz salonu yok.
  if (context.memberships.length === 0) {
    return (
      <div className="max-w-md">
        <PageHeader
          title="Salonunuzu oluşturun"
          description="Ardından hizmetlerinizi, personelinizi ve çalışma saatlerini ekleyebilirsiniz."
        />
        <div className="mt-6">
          <SalonForm />
        </div>
      </div>
    );
  }

  const slug = firstParam(query.salon);
  const membership =
    context.memberships.find((m) => m.salon_slug === slug) ?? context.memberships[0];
  if (!isAdminRole(membership)) return <NoAccess />;

  const salon = await getSalonProfile(membership.salon_id);
  if (!salon) return <NoAccess />;

  return (
    <div className="max-w-md">
      <PageHeader
        title="Salon Ayarları"
        description="Salonunuzun adı, iletişim bilgileri ve online randevu adresi."
      />
      <div className="mt-6">
        <SalonForm salon={salon} />
      </div>
      <p className="mt-8 border-t border-zinc-200 pt-4 text-sm text-zinc-500 dark:border-zinc-800">
        Müşterilerinizle paylaşacağınız bağlantı:{" "}
        <Link
          href={`/randevu/${salon.slug}`}
          target="_blank"
          className="font-medium text-foreground underline underline-offset-4"
        >
          /randevu/{salon.slug}
        </Link>
      </p>
    </div>
  );
}
