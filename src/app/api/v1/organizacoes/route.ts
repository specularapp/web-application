import { archiveTeamSchema, saveTeamSchema } from "@/features/organizations/schemas";
import { getTeamState, saveTeam, setTeamArchived } from "@/features/organizations/service";
import { authorizeRequest, invalidPayload, readJson } from "@/lib/api/v1";

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, "team-read");
  if ("response" in auth) return auth.response;

  const state = await getTeamState(auth.session.supabase, auth.session.userId);
  return Response.json(state);
}

export async function POST(request: Request) {
  const auth = await authorizeRequest(request, "team");
  if ("response" in auth) return auth.response;

  const parsed = saveTeamSchema.safeParse(await readJson(request));
  if (!parsed.success) return invalidPayload();

  const result = await saveTeam(auth.session.supabase, parsed.data);
  if (!result.ok) return Response.json({ error: result.error }, { status: 400 });

  return Response.json(result.data);
}

/**
 * Arquivar ou reabrir uma equipe, para o aplicativo. Mesma regra da web, pelo mesmo `service.ts`: quem
 * decide se pode é o banco, que exige ser dono.
 */
export async function PATCH(request: Request) {
  const auth = await authorizeRequest(request, "team");
  if ("response" in auth) return auth.response;

  const parsed = archiveTeamSchema.safeParse(await readJson(request));
  if (!parsed.success) return invalidPayload();

  const result = await setTeamArchived(auth.session.supabase, parsed.data);
  if (!result.ok) return Response.json({ error: result.error }, { status: 400 });

  return Response.json({ ok: true });
}
