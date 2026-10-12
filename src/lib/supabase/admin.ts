import "server-only";

import { createClient } from "@supabase/supabase-js";

// Service role istemcisi: RLS'i atlar. Yalnızca girdisi sunucuda doğrulanmış,
// dar kapsamlı işlemlerde (misafir rezervasyonu) kullanılır; istemciye asla
// aktarılmaz. Anahtar tanımlı değilse null döner.
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;

  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
