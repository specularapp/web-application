import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Página é Server Component e não consegue apagar cookie: quando o JWT ainda parece válido
// para o proxy mas a sessão morreu no servidor, sem este handler os dois se empurram em loop.
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();

  return NextResponse.redirect(new URL("/login?erro=sessao", request.nextUrl.origin));
}
