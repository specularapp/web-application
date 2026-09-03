import { listTeams } from "@/features/organizations/service";
import { authorizeRequest } from "@/lib/api/v1";

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, "team-read");
  if ("response" in auth) return auth.response;

  const teams = await listTeams(auth.session.supabase, auth.session.userId);
  return Response.json(teams);
}
