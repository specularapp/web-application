import { NextResponse, type NextRequest } from "next/server";
import { safePath } from "@/lib/security/safe-path";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safePath(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
    console.error("exchangeCodeForSession falhou:", error.code ?? error.message, error.status ?? "");
  }

  const providerError = searchParams.get("error_description") ?? searchParams.get("error");
  if (providerError) console.error("callback do provedor com erro:", providerError);

  return NextResponse.redirect(`${origin}/login?erro=callback`);
}
