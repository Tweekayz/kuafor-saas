import Link from "next/link";

import { addDays, formatDay } from "@/lib/format";
import type { PanelMembership } from "@/lib/panel/types";

export function PageHeader({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-zinc-500">{description}</p>}
      </div>
      {children}
    </header>
  );
}

const navButton =
  "rounded-lg border border-zinc-300 px-3 py-1.5 font-medium hover:bg-zinc-100 aria-[current]:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800 dark:aria-[current]:bg-zinc-800";

/** Gün seçici: önceki / bugün / sonraki ve tarih alanı. Seçim ?gun= ile taşınır. */
export function DateNav({
  basePath,
  membership,
  day,
  today,
  step = 1,
  params = {},
}: {
  basePath: string;
  membership: PanelMembership;
  day: string;
  today: string;
  /** Ok düğmelerinin atladığı gün sayısı (hafta görünümünde 7). */
  step?: number;
  /** Korunacak ek sorgu parametreleri (ör. görünüm). */
  params?: Record<string, string>;
}) {
  const href = (target: string) =>
    `${basePath}?${new URLSearchParams({ salon: membership.salon_slug, ...params, gun: target })}`;

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <Link className={navButton} href={href(addDays(day, -step))} aria-label="Önceki">
        ←
      </Link>
      <Link
        className={navButton}
        href={href(today)}
        aria-current={day === today ? "date" : undefined}
      >
        Bugün
      </Link>
      <Link className={navButton} href={href(addDays(day, step))} aria-label="Sonraki">
        →
      </Link>
      <form action={basePath} className="flex items-center gap-2">
        <input type="hidden" name="salon" value={membership.salon_slug} />
        {Object.entries(params).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
        <input
          type="date"
          name="gun"
          defaultValue={day}
          key={day}
          aria-label="Tarih seç"
          className="rounded-lg border border-zinc-300 bg-transparent px-2 py-1.5 dark:border-zinc-700"
        />
        <button type="submit" className={navButton}>
          Git
        </button>
      </form>
    </div>
  );
}

export function dayTitle(day: string): string {
  return formatDay(day, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

export function StatTile({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <p className="text-sm text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
      {detail && <p className="mt-1 text-xs text-zinc-500">{detail}</p>}
    </div>
  );
}

/** Modülün veritabanı tabloları henüz oluşturulmamışsa gösterilir. */
export function MigrationNotice({ feature }: { feature: string }) {
  return (
    <div className="mt-6 rounded-xl bg-amber-50 p-5 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">
      <p className="font-semibold">{feature} için veritabanı güncellemesi gerekiyor</p>
      <p className="mt-1">
        Supabase → SQL Editor&apos;de{" "}
        <code className="font-mono">supabase/migrations/20261013000000_business_modules.sql</code>{" "}
        dosyasının içeriğini çalıştırın. Güncelleme yapılana kadar bu bölüm kullanılamaz;
        sitenin geri kalanı etkilenmez.
      </p>
    </div>
  );
}

export function NoAccess() {
  return (
    <div className="mx-auto max-w-md py-24 text-center">
      <h1 className="text-xl font-semibold">Bu sayfa için yetkiniz yok</h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        Bu bölümü yalnızca salon sahibi ve yöneticiler görebilir.
      </p>
      <Link href="/panel" className="mt-6 inline-block font-medium underline">
        Takvime dön
      </Link>
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="animate-pulse" aria-busy="true" aria-label="Yükleniyor">
      <div className="h-8 w-56 rounded bg-zinc-200 dark:bg-zinc-800" />
      <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-xl bg-zinc-100 dark:bg-zinc-900" />
        ))}
      </div>
      <div className="mt-6 h-96 rounded-xl bg-zinc-100 dark:bg-zinc-900" />
    </div>
  );
}
