import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { getCustomerDetail, listCustomers } from "@/lib/business/queries";
import { REGULAR_VISITS, VIP_TAG, type CustomerRow } from "@/lib/business/types";
import { dateInZone, formatDay, formatMoney, formatTime } from "@/lib/format";
import { firstParam, requireMembership } from "@/lib/panel/session";
import type { AppointmentStatus, PanelMembership } from "@/lib/panel/types";
import { isUuid } from "@/lib/panel/validation";

import { NoAccess, PageHeader, PageSkeleton, StatTile } from "../_components/page-parts";
import { inputClass, secondaryButton } from "../_components/ui";
import { CustomerCardForm, CustomerNoteForm } from "./customer-forms";

export const metadata: Metadata = {
  title: "Müşteriler",
};

const STATUS_LABEL: Record<AppointmentStatus, string> = {
  pending_payment: "Kapora bekleniyor",
  confirmed: "Onaylı",
  completed: "Tamamlandı",
  cancelled: "İptal edildi",
  no_show: "Gelmedi",
};

export default function CustomersPage({ searchParams }: PageProps<"/panel/musteriler">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Customers searchParams={searchParams} />
    </Suspense>
  );
}

/** Müşterinin durumunu anlatan etiketler: el ile verilenler + ziyaret sayısından türetilenler. */
function labelsFor(customer: CustomerRow): string[] {
  const labels = [...customer.tags];
  if (customer.total_visits >= REGULAR_VISITS) labels.push("Düzenli");
  else if (customer.total_visits <= 1) labels.push("Yeni");
  if (customer.is_blocked) labels.push("Engelli");
  return labels;
}

function Labels({ labels }: { labels: string[] }) {
  return (
    <span className="flex flex-wrap gap-1">
      {labels.map((label) => (
        <span
          key={label}
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            label === VIP_TAG
              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
              : "border border-zinc-300 text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
          }`}
        >
          {label}
        </span>
      ))}
    </span>
  );
}

async function Customers({ searchParams }: Pick<PageProps<"/panel/musteriler">, "searchParams">) {
  const query = await searchParams;
  const { membership } = await requireMembership(query, "/panel/musteriler");
  if (membership.role === "barber") return <NoAccess />;

  const selectedId = firstParam(query.musteri);
  if (isUuid(selectedId)) {
    return <CustomerCard membership={membership} customerId={selectedId} />;
  }

  const { salon_id: salonId, salon_slug: slug, timezone, currency } = membership;
  const search = firstParam(query.q)?.slice(0, 60) ?? "";
  const customers = await listCustomers(salonId, search);
  const money = (amount: number) => formatMoney(amount, currency);

  return (
    <>
      <PageHeader
        title="Müşteriler"
        description="Ziyaret geçmişi, harcama toplamları ve etiketler. Müşteri kaydı ilk randevuda kendiliğinden oluşur."
      />

      <form action="/panel/musteriler" className="mt-6 flex max-w-md gap-2">
        <input type="hidden" name="salon" value={slug} />
        <input
          type="search"
          name="q"
          defaultValue={search}
          placeholder="Ad ya da telefon ara"
          aria-label="Müşteri ara"
          className={inputClass}
        />
        <button type="submit" className={secondaryButton}>
          Ara
        </button>
      </form>

      <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="text-left text-zinc-500">
            <tr className="border-b border-zinc-200 dark:border-zinc-800">
              <th scope="col" className="px-4 py-3 font-medium">Müşteri</th>
              <th scope="col" className="px-4 py-3 font-medium">Etiketler</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">Ziyaret</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">Toplam harcama</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">Son ziyaret</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((customer) => (
              <tr
                key={customer.id}
                className="border-b border-zinc-100 last:border-0 dark:border-zinc-900"
              >
                <th scope="row" className="px-4 py-3 text-left">
                  <Link
                    href={`/panel/musteriler?${new URLSearchParams({ salon: slug, musteri: customer.id })}`}
                    className="font-medium underline-offset-4 hover:underline"
                  >
                    {customer.full_name}
                  </Link>
                  <span className="block font-normal text-zinc-500 tabular-nums">
                    {customer.phone}
                  </span>
                </th>
                <td className="px-4 py-3">
                  <Labels labels={labelsFor(customer)} />
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{customer.total_visits}</td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {money(customer.total_spent)}
                </td>
                <td className="px-4 py-3 text-right text-zinc-500 tabular-nums">
                  {customer.last_visit_at
                    ? formatDay(dateInZone(customer.last_visit_at, timezone), {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })
                    : "—"}
                </td>
              </tr>
            ))}
            {customers.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-zinc-500">
                  {search ? "Aramayla eşleşen müşteri yok." : "Henüz müşteri kaydı yok."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-zinc-500">
        “Düzenli”: en az {REGULAR_VISITS} tamamlanmış ziyaret. “Yeni”: en fazla 1 ziyaret. VIP
        etiketini müşteri kartından siz verirsiniz.
      </p>
    </>
  );
}

async function CustomerCard({
  membership,
  customerId,
}: {
  membership: PanelMembership;
  customerId: string;
}) {
  const { salon_id: salonId, salon_slug: slug, timezone, currency } = membership;
  const customer = await getCustomerDetail(salonId, customerId);
  const backHref = `/panel/musteriler?salon=${slug}`;

  if (!customer) {
    return (
      <>
        <PageHeader title="Müşteri bulunamadı" />
        <Link href={backHref} className="mt-4 inline-block font-medium underline">
          Müşteri listesine dön
        </Link>
      </>
    );
  }

  const money = (amount: number) => formatMoney(amount, currency);
  const localDay = (value: string) =>
    formatDay(dateInZone(value, timezone), { day: "numeric", month: "long", year: "numeric" });

  return (
    <>
      <Link href={backHref} className="text-sm text-zinc-500 underline-offset-4 hover:underline">
        ← Müşteriler
      </Link>
      <div className="mt-2">
        <PageHeader title={customer.full_name}>
          <Labels labels={labelsFor(customer)} />
        </PageHeader>
        <p className="mt-1 text-sm text-zinc-500">
          <a href={`tel:${customer.phone}`} className="underline underline-offset-4">
            {customer.phone}
          </a>
          {customer.email && ` · ${customer.email}`} · {localDay(customer.created_at)} tarihinden
          beri müşteri
        </p>
      </div>

      <section aria-label="Özet" className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Ziyaret" value={String(customer.total_visits)} />
        <StatTile label="Toplam harcama" value={money(customer.total_spent)} />
        <StatTile
          label="Son ziyaret"
          value={
            customer.last_visit_at
              ? formatDay(dateInZone(customer.last_visit_at, timezone), {
                  day: "numeric",
                  month: "short",
                })
              : "—"
          }
        />
        <StatTile label="Gelmedi" value={String(customer.no_show_count)} />
      </section>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <section>
          <h2 className="text-lg font-medium">Randevu geçmişi</h2>
          {customer.appointments.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-500">Randevu kaydı yok.</p>
          ) : (
            <ul className="mt-3 divide-y divide-zinc-100 rounded-xl border border-zinc-200 text-sm dark:divide-zinc-900 dark:border-zinc-800">
              {customer.appointments.map((a) => (
                <li key={a.id} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-4 py-3">
                  <span className="tabular-nums">
                    {localDay(a.starts_at)}, {formatTime(a.starts_at, timezone)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-zinc-500">
                    {a.services.join(", ")} · {a.barber_name}
                  </span>
                  <span className="text-zinc-500">{STATUS_LABEL[a.status]}</span>
                  <span className="font-medium tabular-nums">{money(a.total_price)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="space-y-8">
          <section>
            <h2 className="mb-3 text-lg font-medium">Müşteri kartı</h2>
            <CustomerCardForm salonId={salonId} customer={customer} />
          </section>
          <section>
            <h2 className="mb-3 text-lg font-medium">Notlar</h2>
            <CustomerNoteForm salonId={salonId} customerId={customer.id} />
            <ul className="mt-4 space-y-2">
              {customer.notes.map((note) => (
                <li key={note.id} className="rounded-lg bg-zinc-100 p-3 text-sm dark:bg-zinc-900">
                  <p className="whitespace-pre-wrap">{note.note}</p>
                  <p className="mt-1 text-xs text-zinc-500">{localDay(note.created_at)}</p>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </>
  );
}
