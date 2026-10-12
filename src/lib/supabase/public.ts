import "server-only";

import { createClient } from "@supabase/supabase-js";

// Oturumsuz (anon) istemci: çerez okumaz, bu yüzden "use cache" içindeki
// vitrin sorgularında kullanılabilir. Yalnızca anon'a açık tabloları görür.
export function createPublicClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
