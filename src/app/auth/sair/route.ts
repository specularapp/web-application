import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Página é Server Component e não consegue apagar cookie: quando o JWT ainda parece válido
// para o proxy mas a sessão morreu no servidor, sem este handler os dois se empurram em loop.
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut().catch(() => undefined);

  const response = NextResponse.redirect(new URL("/login?erro=sessao", request.nextUrl.origin));

  // Se o signOut falhou na rede, o cookie continuaria de pé e o proxy devolveria a pessoa
  // para o /mfa, que é justamente o loop que esta rota existe para quebrar.
  for (const cookie of request.cookies.getAll()) {
    if (cookie.name.startsWith("sb-")) response.cookies.delete(cookie.name);
  }

  return response;
}
