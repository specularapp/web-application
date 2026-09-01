import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { safePath } from "@/lib/security/safe-path";
import { sessionCookieOptions } from "@/lib/supabase/cookies";
import type { Database } from "@/types/database";

const VERIFIER_SUFFIX = "-code-verifier";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safePath(searchParams.get("next"));

  const providerError = searchParams.get("error_description") ?? searchParams.get("error");
  if (providerError) {
    console.error("callback do provedor com erro:", providerError);
    return NextResponse.redirect(`${origin}/login?erro=provedor`);
  }

  if (!code) return NextResponse.redirect(`${origin}/login?erro=callback`);

  // O cliente escreve direto nesta resposta. Usar o `cookies()` do next/headers aqui é
  // silencioso demais: se a escrita falhar, a sessão some e o login social volta ao começo.
  const response = NextResponse.redirect(`${origin}${next}`);
  const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY } = env.supabase();

  const supabase = createServerClient<Database>(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookieOptions: sessionCookieOptions,
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (!error) return response;

  // Sem o verificador do PKCE o código é inútil: o navegador voltou sem o cookie que a tela
  // de login gravou, então o motivo é outro e a mensagem genérica esconderia isso.
  const temVerificador = request.cookies.getAll().some((cookie) => cookie.name.endsWith(VERIFIER_SUFFIX));
  console.error(
    "exchangeCodeForSession falhou:",
    error.code ?? error.message,
    error.status ?? "",
    temVerificador ? "com verificador" : "SEM verificador",
  );

  return NextResponse.redirect(`${origin}/login?erro=${temVerificador ? "troca" : "verificador"}`);
}
