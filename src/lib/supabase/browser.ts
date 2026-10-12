import { createBrowserClient } from "@supabase/ssr";

// Tarayıcı istemcisi (anon anahtar + varsa oturum çerezi). Yalnızca anon'a
// açık, salt okunur çağrılar için: örn. get_available_slots.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
