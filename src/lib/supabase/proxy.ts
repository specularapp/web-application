import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import type { Database } from "@/types/database";
import { REMEMBER_COOKIE, isPersistent, scopeToSession } from "./cookies";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY } = env.supabase();
  const persistent = isPersistent(request.cookies.get(REMEMBER_COOKIE)?.value);

  const supabase = createServerClient<Database>(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, scopeToSession(options, persistent));
        }
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims ?? null;

  let mfaPending = false;
  if (claims) {
    const { data: level } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    mfaPending = level?.currentLevel === "aal1" && level.nextLevel === "aal2";
  }

  return { response, claims, mfaPending };
}
