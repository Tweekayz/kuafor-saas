import Link from "next/link";
import { Suspense } from "react";

import { dateInZone, formatDay } from "@/lib/format";
import { requireSupervisor } from "@/lib/supervisor/auth";
import { listSalons } from "@/lib/supervisor/queries";
import { PLAN_LABEL } from "@/lib/supervisor/types";

import { PageHeader, PageSkeleton } from "../../panel/_components/page-parts";
import { NewSalonForm, SalonEditForm } from "../_components/forms";

const TIMEZONE = "Europe/Istanbul";

export default function SupervisorSalonsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Salons />
    </Suspense>
  );
}

function day(value: string | null): string {
  return value
    ? formatDay(dateInZone(value, TIMEZONE), { day: "numeric", month: "short", year: "numeric" })
    : "Hiç giriş yapmadı";
}

async function Salons() {
  await requireSupervisor("/supervisor/salonlar");
  const salons = await listSalons();

  return (
    <>
      <PageHeader
        title="Salonlar & Kullanıcılar"
        description="Kayıtlı salonlar, sahiplerinin iletişim bilgileri, paket ve üyelik durumları."
      />

      {salons === null ? (
        <p className="mt-6 rounded-xl bg-amber-50 p-5 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">
          Bu sayfa için veritabanı güncellemesi gerekiyor:{" "}
          <code className="font-mono">supabase/migrations/20261014000000_supervisor.sql</code>{" "}
          dosyasını Supabase SQL Editor&apos;de çalıştırın.
        </p>
      ) : (
        <>
          <section className="mt-6">
            <h2 className="text-lg font-medium">Yeni salon ve kullanıcı</h2>
            <p className="mt-1 mb-3 text-sm text-zinc-500">
              E-posta kayıtlı değilse yeni bir giriş hesabı açılır; kayıtlıysa o hesap salonun
              sahibi olur. Geçici şifreyi salon sahibine siz iletirsiniz.
            </p>
            <div className="rounded-xl border border-dashed border-zinc-300 p-4 dark:border-zinc-700">
              <NewSalonForm />
            </div>
          </section>

          <section className="mt-10">
            <h2 className="text-lg font-medium">
              Salonlar <span className="font-normal text-zinc-500">({salons.length})</span>
            </h2>
            {salons.length === 0 ? (
              <p className="mt-3 text-sm text-zinc-500">Henüz salon yok.</p>
            ) : (
              <div className="mt-3 space-y-3">
                {salons.map((salon) => (
                  <details
                    key={salon.id}
                    className="rounded-xl border border-zinc-200 dark:border-zinc-800"
                  >
                    <summary className="grid cursor-pointer gap-x-4 gap-y-1 px-4 py-3 text-sm sm:grid-cols-[1.4fr_1.6fr_auto_auto] sm:items-center">
                      <span>
                        <span className="block font-medium">{salon.name}</span>
                        <span className="block text-zinc-500">
                          /{salon.slug}
                          {salon.city && ` · ${salon.city}`}
                        </span>
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate">
                          {salon.owner.full_name || "Sahip"} · {salon.owner.email ?? "e-posta yok"}
                        </span>
                        <span className="block text-zinc-500">
                          {salon.phone ?? salon.owner.phone ?? "telefon yok"} · Son giriş:{" "}
                          {day(salon.owner.last_sign_in_at)}
                        </span>
                      </span>
                      <span className="rounded-full border border-zinc-300 px-2 py-0.5 text-xs font-medium dark:border-zinc-700">
                        {PLAN_LABEL[salon.plan]}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          salon.is_active
                            ? "bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100"
                            : "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                        }`}
                      >
                        {salon.is_active ? "Aktif" : "Donduruldu"}
                      </span>
                    </summary>
                    <div className="border-t border-zinc-200 p-4 dark:border-zinc-800">
                      <p className="mb-4 text-sm text-zinc-500">
                        Kayıt: {day(salon.created_at)} ·{" "}
                        <Link
                          href={`/randevu/${salon.slug}`}
                          target="_blank"
                          className="underline underline-offset-4"
                        >
                          Randevu sayfası
                        </Link>
                        {salon.custom_domain && ` · Alan adı: ${salon.custom_domain}`}
                      </p>
                      <SalonEditForm salon={salon} />
                    </div>
                  </details>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </>
  );
}
