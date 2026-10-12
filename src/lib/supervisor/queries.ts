import "server-only";

import { isMissingSchema } from "@/lib/panel/guard";
import { createAdminClient } from "@/lib/supabase/admin";

import type { PlatformStats, SupervisorSalon } from "./types";

// Süper yönetici panelinin okuma katmanı. Service role ile çalışır (RLS yok);
// bu yüzden her çağıran önce requireSupervisor / getSupervisor ile yetkiyi
// doğrulamalıdır. Veritabanı güncellemesi eksikse null döner.

export type AdminClient = NonNullable<ReturnType<typeof createAdminClient>>;

/** Service role istemcisi; anahtar tanımlı değilse açıklayıcı hata fırlatır. */
export function requireAdminClient(): AdminClient {
  const admin = createAdminClient();
  if (!admin) throw new Error("SUPABASE_SERVICE_ROLE_KEY tanımlı değil");
  return admin;
}

export async function getPlatformStats(from: string, to: string): Promise<PlatformStats | null> {
  const { data, error } = await requireAdminClient().rpc("get_platform_stats", {
    p_from: from,
    p_to: to,
  });
  if (isMissingSchema(error)) return null;
  if (error) throw new Error(`get_platform_stats: ${error.message}`, { cause: error });
  const stats = data as PlatformStats;
  return { ...stats, revenue: Number(stats.revenue) };
}

/** Tüm salonlar, sahiplerinin iletişim bilgisi ve son giriş tarihiyle. */
export async function listSalons(): Promise<SupervisorSalon[] | null> {
  const admin = requireAdminClient();

  const salons = await admin
    .from("salons")
    .select(
      "id, name, slug, phone, city, is_active, plan, custom_domain, custom_domain_status, created_at, owner_id",
    )
    .order("created_at", { ascending: false });
  if (isMissingSchema(salons.error)) return null;
  if (salons.error) throw new Error(`salons: ${salons.error.message}`, { cause: salons.error });

  const ownerIds = [...new Set(salons.data.map((s) => s.owner_id as string))];
  const [profiles, authUsers] = await Promise.all([
    ownerIds.length > 0
      ? admin.from("users").select("id, email, full_name, phone").in("id", ownerIds)
      : Promise.resolve({ data: [], error: null }),
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ]);
  if (profiles.error) throw new Error(`users: ${profiles.error.message}`, { cause: profiles.error });
  if (authUsers.error) {
    throw new Error(`auth users: ${authUsers.error.message}`, { cause: authUsers.error });
  }

  type Profile = { id: string; email: string | null; full_name: string; phone: string | null };
  const profileById = new Map((profiles.data as Profile[]).map((p) => [p.id, p]));
  const lastSignIn = new Map(
    authUsers.data.users.map((user) => [user.id, user.last_sign_in_at ?? null]),
  );

  return salons.data.map((salon) => {
    const ownerId = salon.owner_id as string;
    const profile = profileById.get(ownerId);
    return {
      id: salon.id,
      name: salon.name,
      slug: salon.slug,
      phone: salon.phone,
      city: salon.city,
      is_active: salon.is_active,
      plan: salon.plan,
      custom_domain: salon.custom_domain,
      custom_domain_status: salon.custom_domain_status,
      created_at: salon.created_at,
      owner: {
        id: ownerId,
        email: profile?.email ?? null,
        full_name: profile?.full_name ?? "",
        phone: profile?.phone ?? null,
        last_sign_in_at: lastSignIn.get(ownerId) ?? null,
      },
    } as SupervisorSalon;
  });
}
