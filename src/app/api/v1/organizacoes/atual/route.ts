import { organizationIdSchema } from "@/features/organizations/schemas";
import { switchTeam } from "@/features/organizations/service";
import { authorizeRequest, invalidPayload, readJson } from "@/lib/api/v1";

export async function PUT(request: Request) {
  const auth = await authorizeRequest(request, "team-switch");
  if ("response" in auth) return auth.response;

  const parsed = organizationIdSchema.safeParse(await readJson(request));
  if (!parsed.success) return invalidPayload();

  const result = await switchTeam(auth.session.supabase, parsed.data.organizationId);
  if (!result.ok) return Response.json({ error: result.error }, { status: 400 });

  return new Response(null, { status: 204 });
}
