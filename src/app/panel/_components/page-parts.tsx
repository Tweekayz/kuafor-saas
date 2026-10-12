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
}: {
  basePath: string;
  membership: PanelMembership;
  day: string;
  today: string;
}) {
  const href = (target: string) => `${basePath}?salon=${membership.salon_slug}&gun=${target}`;

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <Link className={navButton} href={href(addDays(day, -1))} aria-label="Önceki gün">
        ←
      </Link>
      <Link
        className={navButton}
        href={href(today)}
        aria-current={day === today ? "date" : undefined}
      >
        Bugün
      </Link>
      <Link className={navButton} href={href(addDays(day, 1))} aria-label="Sonraki gün">
        →
      </Link>
      <form action={basePath} className="flex items-center gap-2">
        <input type="hidden" name="salon" value={membership.salon_slug} />
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
