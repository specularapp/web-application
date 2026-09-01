import { saveTeamSchema } from "@/features/organizations/schemas";
import { getTeamState, saveTeam } from "@/features/organizations/service";
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
