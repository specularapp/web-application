import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import type { Database } from "@/types/database";
import { REMEMBER_COOKIE, isPersistent, scopeToSession, sessionCookieOptions } from "./cookies";

type ClientOptions = { remember?: boolean };

export async function createClient(options: ClientOptions = {}) {
  const cookieStore = await cookies();
  const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY } = env.supabase();
  const persistent = options.remember ?? isPersistent(cookieStore.get(REMEMBER_COOKIE)?.value);

  return createServerClient<Database>(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookieOptions: sessionCookieOptions,
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          for (const { name, value, options: cookieOptions } of cookiesToSet) {
            cookieStore.set(name, value, scopeToSession(cookieOptions, persistent));
          }
        } catch {
          return;
        }
      },
    },
  });
}

export function createAdminClient() {
  const { NEXT_PUBLIC_SUPABASE_URL } = env.supabase();
  const { SUPABASE_SECRET_KEY } = env.supabaseAdmin();

  return createSupabaseClient<Database>(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
