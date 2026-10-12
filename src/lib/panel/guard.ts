import "server-only";

import { getPanelContext } from "./queries";
import type { PanelMembership } from "./types";
import { isUuid } from "./validation";

// Panel Server Action'larının ortak yardımcıları: yetki kontrolü, form okuma
// ve hata eşleme. Asıl yetkiyi ayrıca veritabanı (RLS) uygular.

export type FormState = { ok: boolean; message: string } | null;

export type AccessLevel = "admin" | "frontdesk" | "member";

const ROLES: Record<AccessLevel, readonly string[]> = {
  admin: ["owner", "manager"],
  frontdesk: ["owner", "manager", "receptionist"],
  member: ["owner", "manager", "receptionist", "barber"],
};

export function fail(message: string): FormState {
  return { ok: false, message };
}

export async function authorizeSalon(
  salonId: unknown,
  level: AccessLevel,
): Promise<{ membership: PanelMembership; error?: undefined } | { error: FormState }> {
  if (!isUuid(salonId)) return { error: fail("Geçersiz salon") };
  const context = await getPanelContext();
  if (!context) return { error: fail("Oturum açmanız gerekiyor") };
  const membership = context.memberships.find(
    (m) => m.salon_id === salonId && ROLES[level].includes(m.role),
  );
  if (!membership) return { error: fail("Bu işlem için yetkiniz yok") };
  return { membership };
}

export function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

/** Boş -> null, geçersiz -> NaN. Ondalık ayırıcı olarak virgül de kabul edilir. */
export function optionalNumber(formData: FormData, name: string): number | null {
  const value = text(formData, name);
  return value === "" ? null : Number(value.replace(",", "."));
}

type DbError = { code?: string; message?: string; details?: string | null };

/**
 * Tablo, sütun ya da fonksiyon veritabanında yok mu? İşletme modülleri
 * (supabase/migrations/*_business_modules.sql) henüz uygulanmadıysa true.
 */
export function isMissingSchema(error: DbError | null | undefined): boolean {
  if (!error) return false;
  return ["42P01", "42703", "42883", "PGRST200", "PGRST202", "PGRST204", "PGRST205"].includes(
    error.code ?? "",
  );
}

export const MIGRATION_HINT =
  "Bu özellik için veritabanı güncellemesi gerekiyor (supabase/migrations/20261013000000_business_modules.sql).";

/** Veritabanı hatasını kullanıcıya gösterilecek sonuca çevirir. */
export function dbFailure(scope: string, error: DbError): FormState {
  if (isMissingSchema(error)) return fail(MIGRATION_HINT);
  // Fonksiyonların bilinçli fırlattığı hatalar kullanıcıya gösterilebilir.
  if (error.code === "P0001" && error.details) return fail(error.message ?? "İşlem yapılamadı");
  console.error(`${scope} failed`, error);
  return fail("Kaydedilemedi, lütfen tekrar deneyin");
}
