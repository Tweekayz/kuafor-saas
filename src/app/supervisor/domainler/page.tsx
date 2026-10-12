import { Suspense } from "react";

import { requireSupervisor } from "@/lib/supervisor/auth";
import { listSalons } from "@/lib/supervisor/queries";
import { DOMAIN_STATUS_LABEL, type SupervisorSalon } from "@/lib/supervisor/types";
import { isVercelConfigured } from "@/lib/vercel";

import { PageHeader, PageSkeleton } from "../../panel/_components/page-parts";
import { DomainActions } from "../_components/forms";

const ORDER = { pending: 0, active: 1, rejected: 2 };

export default function SupervisorDomainsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Domains />
    </Suspense>
  );
}

async function Domains() {
  await requireSupervisor("/supervisor/domainler");
  const salons = await listSalons();

  const requests = (salons ?? [])
    .filter((s): s is SupervisorSalon & { custom_domain: string } => s.custom_domain !== null)
    .sort(
      (a, b) =>
        ORDER[a.custom_domain_status ?? "pending"] - ORDER[b.custom_domain_status ?? "pending"],
    );
  const pending = requests.filter((s) => (s.custom_domain_status ?? "pending") === "pending");

  return (
    <>
      <PageHeader
        title="Domain Talepleri"
        description="Onaylanan alan adı barındırma projesine otomatik eklenir ve salonun randevu sayfasına yönlendirilir."
      />

      {!isVercelConfigured() && (
        <p className="mt-6 rounded-xl bg-amber-50 p-5 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">
          <strong>Onay şu anda yapılamaz:</strong> VERCEL_AUTH_TOKEN ve VERCEL_PROJECT_ID ortam
          değişkenleri tanımlı değil. Tanımlayıp yeniden deploy ettikten sonra “Onayla” düğmesi
          alan adını projeye ekler.
        </p>
      )}

      {salons === null ? (
        <p className="mt-6 rounded-xl bg-amber-50 p-5 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">
          Bu sayfa için veritabanı güncellemesi gerekiyor:{" "}
          <code className="font-mono">supabase/migrations/20261014000000_supervisor.sql</code>
        </p>
      ) : requests.length === 0 ? (
        <p className="mt-6 text-sm text-zinc-500">Henüz alan adı talebi yok.</p>
      ) : (
        <>
          <p className="mt-6 text-sm" role="status">
            {pending.length > 0
              ? `${pending.length} talep onayınızı bekliyor.`
              : "Bekleyen talep yok."}
          </p>
          <ul className="mt-3 divide-y divide-zinc-100 rounded-xl border border-zinc-200 dark:divide-zinc-900 dark:border-zinc-800">
            {requests.map((salon) => {
              const status = salon.custom_domain_status ?? "pending";
              return (
                <li
                  key={salon.id}
                  className="grid gap-3 px-4 py-4 sm:grid-cols-[1.5fr_1fr_auto] sm:items-center"
                >
                  <div className="min-w-0">
                    <p className="truncate font-mono font-medium">{salon.custom_domain}</p>
                    <p className="truncate text-sm text-zinc-500">
                      {salon.name} · /{salon.slug} · {salon.owner.email ?? "e-posta yok"}
                    </p>
                  </div>
                  <p className="text-sm">
                    <span
                      aria-hidden="true"
                      className={`mr-2 inline-block size-2 rounded-full ${
                        status === "active"
                          ? "bg-emerald-600"
                          : status === "pending"
                            ? "bg-amber-500"
                            : "bg-zinc-400"
                      }`}
                    />
                    {DOMAIN_STATUS_LABEL[status]}
                  </p>
                  <DomainActions
                    salonId={salon.id}
                    domain={salon.custom_domain}
                    active={status === "active"}
                  />
                </li>
              );
            })}
          </ul>
        </>
      )}
    </>
  );
}
