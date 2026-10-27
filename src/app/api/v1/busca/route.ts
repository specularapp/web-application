/**
 * A busca da casa para o aplicativo: `?busca=` procura nos registros da equipe em vigor, pelo mesmo
 * `service.ts` da paleta. A RLS decide o que volta, porque o cliente carrega o JWT de quem pediu.
 */
import { searchSchema } from "@/features/search/schemas";
import { searchEverything } from "@/features/search/service";
import { authorizeDomain } from "@/lib/api/domain";
import { invalidPayload } from "@/lib/api/v1";

export async function GET(request: Request) {
  const auth = await authorizeDomain(request, "search");
  if ("response" in auth) return auth.response;

  const parsed = searchSchema.safeParse({ term: new URL(request.url).searchParams.get("busca") ?? "" });
  if (!parsed.success) return invalidPayload();

  const groups = await searchEverything(auth.session.supabase, auth.session.organizationId, parsed.data.term);
  return Response.json({ groups });
}
