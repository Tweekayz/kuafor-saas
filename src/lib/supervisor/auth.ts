import "server-only";

import { notFound, redirect } from "next/navigation";
import { cache } from "react";

import { createClient } from "@/lib/supabase/server";

// Süper yönetici (platform sahibi) yetkisi. Kimlik, oturumdaki kullanıcının
// doğrulanmış e-postasının SUPERVISOR_EMAILS ortam değişkenindeki listede
// (virgülle ayrılmış) olmasıyla belirlenir. Değişken tanımlı değilse kimse
// süper yönetici değildir. Liste yalnızca sunucuda okunur.

function allowedEmails(): string[] {
  return (process.env.SUPERVISOR_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

/** Oturumdaki kullanıcı süper yöneticiyse e-postası, değilse null. */
export const getSupervisor = cache(async (): Promise<{ id: string; email: string } | null> => {
  const allowed = allowedEmails();
  if (allowed.length === 0) return null;

  const supabase = await createClient();
  // getUser oturumu kimlik sunucusunda doğrular; çerezdeki bilgiye güvenilmez.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email || !user.email_confirmed_at) return null;

  const email = user.email.toLowerCase();
  return allowed.includes(email) ? { id: user.id, email } : null;
});

/**
 * Süper yönetici sayfalarının girişi. Oturum yoksa girişe yönlendirir; oturum
 * var ama yetki yoksa sayfa "bulunamadı" olarak yanıtlanır (varlığı gizlenir).
 */
export async function requireSupervisor(path: string): Promise<{ id: string; email: string }> {
  const supervisor = await getSupervisor();
  if (supervisor) return supervisor;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/giris?next=${encodeURIComponent(path)}`);
  notFound();
}
