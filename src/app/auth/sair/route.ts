import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Página é Server Component e não consegue apagar cookie: quando o JWT ainda parece válido
// para o proxy mas a sessão morreu no servidor, sem este handler os dois se empurram em loop.
// O "Sair da conta" do menu é um Link, e o Link busca o destino antes do clique: sem recusar a busca
// antecipada, abrir o menu já derrubava a sessão. `local` encerra só este navegador, não os outros aparelhos.
export async function GET(request: NextRequest) {
  if (request.headers.has("next-router-prefetch") || request.headers.get("sec-purpose")?.includes("prefetch")) {
    return new NextResponse(null, { status: 204 });
  }

  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);

  const response = NextResponse.redirect(new URL("/login?erro=sessao", request.nextUrl.origin));

  // Se o signOut falhou na rede, o cookie continuaria de pé e o proxy devolveria a pessoa
  // para o /mfa, que é justamente o loop que esta rota existe para quebrar.
  for (const cookie of request.cookies.getAll()) {
    if (cookie.name.startsWith("sb-")) response.cookies.delete(cookie.name);
  }

  return response;
}
