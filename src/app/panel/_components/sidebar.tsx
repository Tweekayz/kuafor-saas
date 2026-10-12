"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import { ThemeToggle } from "@/components/theme";
import { signOut } from "@/lib/auth/actions";
import type { PanelMembership } from "@/lib/panel/types";

type NavItem = {
  href: string;
  label: string;
  icon: string;
  /** Yalnızca sahip ve yönetici görür. */
  adminOnly: boolean;
  /** Seçili gün (?gun=) bu sayfaya taşınır. */
  keepsDay?: boolean;
};

const NAV: NavItem[] = [
  {
    href: "/panel",
    label: "Genel Bakış",
    icon: "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z",
    adminOnly: false,
    keepsDay: true,
  },
  {
    href: "/panel/finans",
    label: "Ciro & Prim Raporları",
    icon: "M3 3v18h18M7 15l4-4 3 3 5-6",
    adminOnly: true,
    keepsDay: true,
  },
  {
    href: "/panel/hizmetler",
    label: "Hizmet Yönetimi",
    icon: "M6 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm0 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM20 4 8.1 15.9M14.5 14.5 20 20M8.1 8.1 12 12",
    adminOnly: true,
  },
  {
    href: "/panel/personel",
    label: "Personel & Mesai",
    icon: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm13 10v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8",
    adminOnly: true,
  },
  {
    href: "/panel/ayarlar",
    label: "Salon Ayarları",
    icon: "M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6",
    adminOnly: true,
  },
];

export function Sidebar({ memberships }: { memberships: PanelMembership[] }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const membership =
    memberships.find((m) => m.salon_slug === searchParams.get("salon")) ?? memberships[0];
  const isAdmin = membership?.role === "owner" || membership?.role === "manager";
  const day = searchParams.get("gun");

  // Salonu olmayan kullanıcı yalnızca salon oluşturma adımını görür.
  const items = NAV.filter((item) =>
    membership ? !item.adminOnly || isAdmin : item.href === "/panel/ayarlar",
  );

  function hrefFor(item: NavItem, slug: string | undefined = membership?.salon_slug) {
    const params = new URLSearchParams();
    if (slug && memberships.length > 1) params.set("salon", slug);
    if (item.keepsDay && day) params.set("gun", day);
    const query = params.toString();
    return query ? `${item.href}?${query}` : item.href;
  }

  const current = NAV.find((item) => item.href === pathname) ?? NAV[0];

  return (
    <aside className="flex shrink-0 flex-col border-b border-zinc-200 bg-zinc-50 lg:sticky lg:top-0 lg:h-screen lg:w-64 lg:border-r lg:border-b-0 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center justify-between gap-3 px-4 pt-4 lg:block lg:px-5 lg:pt-6">
        <div className="min-w-0">
          <p className="text-xs font-medium text-zinc-500">Salon paneli</p>
          <p className="truncate font-semibold tracking-tight">
            {membership?.salon_name ?? "Yeni salon"}
          </p>
        </div>
        <form action={signOut} className="lg:hidden">
          <button type="submit" className="text-sm text-zinc-600 underline-offset-4 hover:underline dark:text-zinc-400">
            Çıkış yap
          </button>
        </form>
      </div>

      {memberships.length > 1 && (
        <nav aria-label="Salon" className="flex gap-1 overflow-x-auto px-3 pt-3 lg:flex-wrap lg:px-4">
          {memberships.map((m) => (
            <Link
              key={m.salon_id}
              href={hrefFor(current, m.salon_slug)}
              aria-current={m.salon_id === membership?.salon_id ? "true" : undefined}
              className="shrink-0 rounded-full border border-zinc-300 px-3 py-1 text-xs font-medium hover:bg-zinc-200 aria-[current]:border-zinc-900 aria-[current]:bg-zinc-900 aria-[current]:text-white dark:border-zinc-700 dark:hover:bg-zinc-800 dark:aria-[current]:border-zinc-100 dark:aria-[current]:bg-zinc-100 dark:aria-[current]:text-zinc-900"
            >
              {m.salon_name}
            </Link>
          ))}
        </nav>
      )}

      <nav
        aria-label="Panel"
        className="flex gap-1 overflow-x-auto px-3 py-3 lg:mt-4 lg:flex-1 lg:flex-col lg:overflow-visible lg:px-4"
      >
        {items.map((item) => (
          <Link
            key={item.href}
            href={hrefFor(item)}
            aria-current={pathname === item.href ? "page" : undefined}
            className="flex shrink-0 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-200/70 hover:text-zinc-900 aria-[current]:bg-zinc-900 aria-[current]:text-white dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 dark:aria-[current]:bg-zinc-100 dark:aria-[current]:text-zinc-900"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="size-[18px] shrink-0"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d={item.icon} />
            </svg>
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="hidden space-y-3 border-t border-zinc-200 px-5 py-4 text-sm lg:block dark:border-zinc-800">
        {membership && (
          <Link
            href={`/randevu/${membership.salon_slug}`}
            target="_blank"
            className="block text-zinc-600 underline-offset-4 hover:underline dark:text-zinc-400"
          >
            Randevu sayfasını aç ↗
          </Link>
        )}
        <div className="flex items-center justify-between">
          <form action={signOut}>
            <button type="submit" className="text-zinc-600 underline-offset-4 hover:underline dark:text-zinc-400">
              Çıkış yap
            </button>
          </form>
          <ThemeToggle />
        </div>
      </div>
    </aside>
  );
}

/** Oturum okunurken gösterilen boş çerçeve (aynı ölçüler, içerik yok). */
export function SidebarSkeleton() {
  return (
    <aside
      aria-hidden="true"
      className="h-28 shrink-0 border-b border-zinc-200 bg-zinc-50 lg:sticky lg:top-0 lg:h-screen lg:w-64 lg:border-r lg:border-b-0 dark:border-zinc-800 dark:bg-zinc-950"
    />
  );
}
