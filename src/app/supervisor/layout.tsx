import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { signOut } from "@/lib/auth/actions";
import { getSupervisor } from "@/lib/supervisor/auth";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

const NAV = [
  ["/supervisor", "Genel Bakış"],
  ["/supervisor/salonlar", "Salonlar & Kullanıcılar"],
  ["/supervisor/domainler", "Domain Talepleri"],
] as const;

export default function SupervisorLayout({ children }: LayoutProps<"/supervisor">) {
  return (
    <div className="flex flex-1 flex-col">
      <Suspense fallback={null}>
        <Header />
      </Suspense>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}

// Yetkisiz ziyaretçiye menü de gösterilmez; sayfalar ayrıca requireSupervisor
// ile korunur ve "bulunamadı" yanıtı verir.
async function Header() {
  const supervisor = await getSupervisor();
  if (!supervisor) return null;

  return (
    <header className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
        <p className="font-semibold tracking-tight">Platform yönetimi</p>
        <nav aria-label="Platform yönetimi" className="flex gap-1 overflow-x-auto text-sm">
          {NAV.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              className="shrink-0 rounded-lg px-3 py-1.5 font-medium text-zinc-600 hover:bg-zinc-200/70 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            >
              {label}
            </Link>
          ))}
        </nav>
        <form action={signOut} className="flex items-center gap-3 text-sm text-zinc-500">
          <span className="hidden sm:inline">{supervisor.email}</span>
          <button type="submit" className="font-medium underline underline-offset-4">
            Çıkış yap
          </button>
        </form>
      </div>
    </header>
  );
}
