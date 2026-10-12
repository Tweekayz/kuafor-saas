import "server-only";

import { redirect } from "next/navigation";

import { getPanelContext } from "./queries";
import type { PanelContext, PanelMembership } from "./types";

export type PanelQuery = Record<string, string | string[] | undefined>;

export function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function isAdminRole(membership: PanelMembership): boolean {
  return membership.role === "owner" || membership.role === "manager";
}

/**
 * Panel sayfalarının ortak girişi: oturum yoksa girişe, salonu olmayan
 * kullanıcıyı salon oluşturma adımına yönlendirir; aksi halde ?salon= ile
 * seçilen (yoksa ilk) üyeliği döner. Rol kontrolü sayfaya aittir.
 */
export async function requireMembership(
  query: PanelQuery,
  path: string,
): Promise<{ context: PanelContext; membership: PanelMembership; isAdmin: boolean }> {
  const context = await getPanelContext();
  if (!context) redirect(`/giris?next=${encodeURIComponent(path)}`);
  if (context.memberships.length === 0) redirect("/panel/ayarlar");

  const slug = firstParam(query.salon);
  const membership =
    context.memberships.find((m) => m.salon_slug === slug) ?? context.memberships[0];

  return { context, membership, isAdmin: isAdminRole(membership) };
}
