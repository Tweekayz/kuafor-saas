import type { Metadata } from "next";
import { Suspense } from "react";

import { listProducts } from "@/lib/business/queries";
import { formatMoney } from "@/lib/format";
import { requireMembership } from "@/lib/panel/session";

import {
  MigrationNotice,
  NoAccess,
  PageHeader,
  PageSkeleton,
  StatTile,
} from "../_components/page-parts";
import { ProductForm, StockMoveForm } from "./product-forms";

export const metadata: Metadata = {
  title: "Stok ve ürünler",
};

export default function StockPage({ searchParams }: PageProps<"/panel/stok">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Stock searchParams={searchParams} />
    </Suspense>
  );
}

const quantityFormat = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 });

async function Stock({ searchParams }: Pick<PageProps<"/panel/stok">, "searchParams">) {
  const { membership, isAdmin } = await requireMembership(await searchParams, "/panel/stok");
  if (membership.role === "barber") return <NoAccess />;

  const { salon_id: salonId, currency } = membership;
  const products = await listProducts(salonId);

  const header = (
    <PageHeader
      title="Stok & Ürünler"
      description="Salonda kullanılan ve satılan ürünlerin stok takibi."
    />
  );
  if (products === null) {
    return (
      <>
        {header}
        <MigrationNotice feature="Stok takibi" />
      </>
    );
  }

  const active = products.filter((p) => p.is_active);
  const critical = active.filter((p) => p.quantity <= p.critical_level);
  const stockValue = active.reduce((sum, p) => sum + p.quantity * (p.purchase_price ?? 0), 0);

  return (
    <div className="max-w-4xl">
      {header}

      <section aria-label="Stok özeti" className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatTile label="Ürün çeşidi" value={String(active.length)} />
        <StatTile
          label="Kritik seviyede"
          value={String(critical.length)}
          detail={critical.length > 0 ? "Sipariş verilmeli" : "Tüm ürünler yeterli"}
        />
        <StatTile
          label="Stok değeri"
          value={formatMoney(stockValue, currency)}
          detail="Alış fiyatı üzerinden"
        />
      </section>

      {critical.length > 0 && (
        <div
          role="alert"
          className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100"
        >
          <p className="font-semibold">⚠ Kritik stok uyarısı</p>
          <ul className="mt-1 list-inside list-disc">
            {critical.map((p) => (
              <li key={p.id}>
                {p.name}: {quantityFormat.format(p.quantity)} {p.unit} kaldı (kritik seviye{" "}
                {quantityFormat.format(p.critical_level)})
              </li>
            ))}
          </ul>
        </div>
      )}

      {isAdmin && (
        <section className="mt-8">
          <h2 className="text-lg font-medium">Yeni ürün</h2>
          <div className="mt-3 rounded-xl border border-dashed border-zinc-300 p-4 dark:border-zinc-700">
            <ProductForm salonId={salonId} />
          </div>
        </section>
      )}

      <section className="mt-10">
        <h2 className="text-lg font-medium">
          Ürünler <span className="font-normal text-zinc-500">({products.length})</span>
        </h2>
        {products.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">Henüz ürün eklenmemiş.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {products.map((product) => {
              const low = product.is_active && product.quantity <= product.critical_level;
              return (
                <details
                  key={product.id}
                  className="rounded-xl border border-zinc-200 dark:border-zinc-800"
                >
                  <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
                    <span className="font-medium">{product.name}</span>
                    {product.category && (
                      <span className="text-sm text-zinc-500">{product.category}</span>
                    )}
                    {!product.is_active && <span className="text-sm text-zinc-500">(pasif)</span>}
                    <span className="ml-auto flex items-center gap-3 text-sm">
                      {low && (
                        <span className="rounded-full border border-amber-500 px-2 py-0.5 text-xs font-medium">
                          ⚠ Kritik
                        </span>
                      )}
                      <span className="font-semibold tabular-nums">
                        {quantityFormat.format(product.quantity)} {product.unit}
                      </span>
                    </span>
                  </summary>
                  <div className="space-y-6 border-t border-zinc-200 p-4 dark:border-zinc-800">
                    <div>
                      <h3 className="mb-2 text-sm font-semibold">Stok hareketi</h3>
                      <StockMoveForm salonId={salonId} product={product} />
                    </div>
                    {isAdmin && (
                      <div>
                        <h3 className="mb-2 text-sm font-semibold">Ürün bilgileri</h3>
                        <ProductForm salonId={salonId} product={product} />
                      </div>
                    )}
                  </div>
                </details>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
