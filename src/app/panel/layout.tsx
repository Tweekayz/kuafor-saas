import type { Metadata } from "next";
import { Suspense } from "react";

import { getPanelContext } from "@/lib/panel/queries";

import { Sidebar, SidebarSkeleton } from "./_components/sidebar";

export const metadata: Metadata = {
  robots: { index: false },
};

export default function PanelLayout({ children }: LayoutProps<"/panel">) {
  return (
    <div className="flex flex-1 flex-col lg:flex-row">
      <Suspense fallback={<SidebarSkeleton />}>
        <SidebarLoader />
      </Suspense>
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-8 lg:py-8">
        <div className="mx-auto w-full max-w-6xl">{children}</div>
      </main>
    </div>
  );
}

// Menü role göre değişir; oturum okuması Suspense içinde kalır ki sayfa
// iskeleti beklemeden çizilsin. Yetki kontrolünü her sayfa ayrıca yapar.
async function SidebarLoader() {
  const context = await getPanelContext();
  return <Sidebar memberships={context?.memberships ?? []} />;
}
