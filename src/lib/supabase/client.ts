import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";
import { env } from "@/lib/env";

export function createClient() {
  const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY } = env.supabase();
  // O navegador só sobe arquivo por endereço assinado. Quem renova a sessão é o proxy: renovar daqui também
  // gastaria o mesmo refresh token duas vezes, e a rotação do Supabase derruba a sessão inteira quando isso acontece.
  return createBrowserClient<Database>(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false },
  });
}
