"use server";

import { refresh, updateTag } from "next/cache";

import { dbFailure, fail, text, type FormState } from "@/lib/panel/guard";
import { isUuid } from "@/lib/panel/validation";
import { createAdminClient } from "@/lib/supabase/admin";
import { addProjectDomain, removeProjectDomain } from "@/lib/vercel";

import { getSupervisor } from "./auth";
import type { AdminClient } from "./queries";
import type { PlanKey } from "./types";

// Süper yönetici işlemleri. Service role ile çalıştıkları için RLS koruması
// yoktur: her işlem önce oturumdaki kullanıcının süper yönetici olduğunu
// doğrular. Server Action'lar doğrudan POST ile de çağrılabildiğinden bu
// kontrol sayfadaki kontrolün yerine geçmez, ona ek olarak zorunludur.

const PLANS: readonly PlanKey[] = ["starter", "professional", "premium"];
const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UNIQUE_VIOLATION = "23505";

async function authorize(): Promise<{ admin: AdminClient; error?: undefined } | { error: FormState }> {
  const supervisor = await getSupervisor();
  if (!supervisor) return { error: fail("Bu işlem için yetkiniz yok") };
  const admin = createAdminClient();
  if (!admin) return { error: fail("SUPABASE_SERVICE_ROLE_KEY tanımlı değil") };
  return { admin };
}

function done(message: string, slug?: string): FormState {
  // Salonun vitrin önbelleği (randevu sayfası) da tazelenir.
  if (slug) updateTag(`salon:${slug}`);
  refresh();
  return { ok: true, message };
}

function slugify(value: string): string {
  const turkish: Record<string, string> = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u" };
  return value
    .toLocaleLowerCase("tr")
    .replace(/[çğıöşü]/g, (char) => turkish[char])
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ---------------------------------------------------------------------------
// Salon ve kullanıcı yönetimi
// ---------------------------------------------------------------------------

/**
 * Yeni salon ve sahibinin hesabını oluşturur. E-posta zaten kayıtlıysa mevcut
 * hesap salonun sahibi yapılır (şifresi değiştirilmez).
 */
export async function createSalonWithOwner(_prev: FormState, formData: FormData): Promise<FormState> {
  const auth = await authorize();
  if (auth.error !== undefined) return auth.error;
  const { admin } = auth;

  const name = text(formData, "name");
  if (name.length < 2 || name.length > 100) return fail("Salon adı 2-100 karakter olmalıdır");
  const slug = slugify(text(formData, "slug") || name);
  if (slug.length < 3 || slug.length > 60 || !SLUG_RE.test(slug)) {
    return fail("Adres takısı en az 3 karakter olmalı; harf, rakam ve tire içerebilir");
  }
  const email = text(formData, "email").toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 254) return fail("Geçerli bir e-posta yazın");
  const plan = text(formData, "plan") as PlanKey;
  if (!PLANS.includes(plan)) return fail("Geçersiz paket");
  const password = String(formData.get("password") ?? "");

  // Mevcut hesap var mı?
  const existing = await admin.from("users").select("id").eq("email", email).maybeSingle();
  if (existing.error) return dbFailure("createSalonWithOwner", existing.error);

  let ownerId = existing.data?.id as string | undefined;
  let createdUser = false;
  if (!ownerId) {
    if (password.length < 8 || password.length > 72) {
      return fail("Yeni hesap için şifre 8-72 karakter olmalıdır");
    }
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: text(formData, "owner_name").slice(0, 100) },
    });
    if (created.error || !created.data.user) {
      console.error("createSalonWithOwner: createUser failed", created.error);
      return fail(`Hesap oluşturulamadı: ${created.error?.message ?? "bilinmeyen hata"}`);
    }
    ownerId = created.data.user.id;
    createdUser = true;
  }

  const { error } = await admin.from("salons").insert({
    owner_id: ownerId,
    name,
    slug,
    plan,
    phone: text(formData, "phone").slice(0, 30) || null,
    city: text(formData, "city").slice(0, 60) || null,
  });
  if (error) {
    // Salon oluşmadıysa az önce açılan hesabı geride bırakma.
    if (createdUser) await admin.auth.admin.deleteUser(ownerId);
    if (error.code === UNIQUE_VIOLATION) return fail("Bu adres takısı kullanılıyor");
    return dbFailure("createSalonWithOwner", error);
  }

  return done(
    createdUser
      ? `Salon ve ${email} hesabı oluşturuldu`
      : `Salon oluşturuldu; mevcut ${email} hesabı sahip yapıldı`,
  );
}

/** Salonun temel bilgilerini, paketini ve aktif/dondurulmuş durumunu günceller. */
export async function updateSalonAsSupervisor(_prev: FormState, formData: FormData): Promise<FormState> {
  const auth = await authorize();
  if (auth.error !== undefined) return auth.error;
  const salonId = text(formData, "salon_id");
  if (!isUuid(salonId)) return fail("Geçersiz salon");

  const name = text(formData, "name");
  if (name.length < 2 || name.length > 100) return fail("Salon adı 2-100 karakter olmalıdır");
  const plan = text(formData, "plan") as PlanKey;
  if (!PLANS.includes(plan)) return fail("Geçersiz paket");

  const { data, error } = await auth.admin
    .from("salons")
    .update({
      name,
      plan,
      is_active: formData.get("is_active") === "on",
      phone: text(formData, "phone").slice(0, 30) || null,
      city: text(formData, "city").slice(0, 60) || null,
    })
    .eq("id", salonId)
    .select("slug")
    .maybeSingle();
  if (error) return dbFailure("updateSalonAsSupervisor", error);
  if (!data) return fail("Salon bulunamadı");
  return done("Kaydedildi", data.slug);
}

/**
 * Salonu ve tüm verisini kalıcı olarak siler; bağlı alan adını barındırma
 * tarafından kaldırır. İstenirse (ve başka salonu yoksa) sahibin hesabı da silinir.
 * Yanlışlıkla silmeye karşı adres takısının yazılması gerekir.
 */
export async function deleteSalonAsSupervisor(
  salonId: string,
  confirmSlug: string,
  deleteOwner: boolean,
): Promise<FormState> {
  const auth = await authorize();
  if (auth.error !== undefined) return auth.error;
  const { admin } = auth;
  if (!isUuid(salonId)) return fail("Geçersiz salon");

  const salon = await admin
    .from("salons")
    .select("id, slug, owner_id, custom_domain")
    .eq("id", salonId)
    .maybeSingle();
  if (salon.error) return dbFailure("deleteSalon", salon.error);
  if (!salon.data) return fail("Salon bulunamadı");
  if (confirmSlug !== salon.data.slug) return fail("Adres takısı eşleşmedi; salon silinmedi");

  // Bağımlılık sırası: "restrict" yabancı anahtarlar yüzünden önce alt kayıtlar.
  for (const table of ["payments", "appointments", "customers"] as const) {
    const { error } = await admin.from(table).delete().eq("salon_id", salonId);
    if (error) return dbFailure(`deleteSalon(${table})`, error);
  }
  const removed = await admin.from("salons").delete().eq("id", salonId);
  if (removed.error) return dbFailure("deleteSalon", removed.error);

  const notes: string[] = [];
  if (salon.data.custom_domain) {
    const domain = await removeProjectDomain(salon.data.custom_domain);
    if (!domain.ok) notes.push(`alan adı barındırmadan kaldırılamadı (${domain.message})`);
  }

  if (deleteOwner) {
    const ownerId = salon.data.owner_id as string;
    const others = await admin
      .from("salons")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", ownerId);
    if ((others.count ?? 0) > 0) {
      notes.push("sahibin başka salonu olduğu için hesabı silinmedi");
    } else {
      const deleted = await admin.auth.admin.deleteUser(ownerId);
      if (deleted.error) notes.push(`sahibin hesabı silinemedi (${deleted.error.message})`);
    }
  }

  return done(
    notes.length > 0 ? `Salon silindi; ancak ${notes.join(", ")}` : "Salon silindi",
    salon.data.slug,
  );
}

// ---------------------------------------------------------------------------
// Domain talepleri
// ---------------------------------------------------------------------------

/**
 * Talebi onaylar: alan adını barındırma projesine ekler, başarılıysa durumu
 * 'active' yapar. Barındırma tarafı başarısız olursa durum değişmez.
 */
export async function approveDomain(salonId: string): Promise<FormState> {
  const auth = await authorize();
  if (auth.error !== undefined) return auth.error;
  if (!isUuid(salonId)) return fail("Geçersiz salon");

  const salon = await auth.admin
    .from("salons")
    .select("slug, custom_domain")
    .eq("id", salonId)
    .maybeSingle();
  if (salon.error) return dbFailure("approveDomain", salon.error);
  const domain = salon.data?.custom_domain as string | null | undefined;
  if (!salon.data || !domain) return fail("Bu salonun alan adı talebi yok");

  const added = await addProjectDomain(domain);
  if (!added.ok) return fail(`Barındırmaya eklenemedi: ${added.message}`);

  // Salon sahibi bu arada alan adını değiştirdiyse eski talebi onaylama.
  const updated = await auth.admin
    .from("salons")
    .update({ custom_domain_status: "active" })
    .eq("id", salonId)
    .eq("custom_domain", domain)
    .select("id")
    .maybeSingle();
  if (updated.error) return dbFailure("approveDomain", updated.error);
  if (!updated.data) return fail("Alan adı bu sırada değişti; talebi yeniden inceleyin");

  return done(`${domain} onaylandı ve yayına alındı.${added.note ? ` ${added.note}` : ""}`);
}

/** Talebi reddeder ya da aktif alan adını kaldırır (barındırmadan da siler). */
export async function rejectDomain(salonId: string): Promise<FormState> {
  const auth = await authorize();
  if (auth.error !== undefined) return auth.error;
  if (!isUuid(salonId)) return fail("Geçersiz salon");

  const salon = await auth.admin
    .from("salons")
    .select("custom_domain, custom_domain_status")
    .eq("id", salonId)
    .maybeSingle();
  if (salon.error) return dbFailure("rejectDomain", salon.error);
  const domain = salon.data?.custom_domain as string | null | undefined;
  if (!salon.data || !domain) return fail("Bu salonun alan adı talebi yok");

  let note = "";
  if (salon.data.custom_domain_status === "active") {
    const removed = await removeProjectDomain(domain);
    if (!removed.ok) note = ` Barındırmadan kaldırılamadı: ${removed.message}`;
  }

  const { error } = await auth.admin
    .from("salons")
    .update({ custom_domain_status: "rejected" })
    .eq("id", salonId);
  if (error) return dbFailure("rejectDomain", error);
  return done(`${domain} reddedildi.${note}`);
}
