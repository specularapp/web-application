import { siteConfig } from "@/lib/metadata";
import {
  createInviteSchema,
  inviteRemovalSchema,
  inviteRoleChangeSchema,
  memberRemovalSchema,
  memberRoleChangeSchema,
  organizationIdSchema,
} from "@/features/organizations/schemas";
import {
  cancelInvite,
  changeInviteRole,
  changeMemberRole,
  getTeam,
  getTeamPeople,
  inviteMember,
  removeMember,
} from "@/features/organizations/service";
import { authorizeRequest, invalidPayload, readJson } from "@/lib/api/v1";

/** Quem está na equipe e quem foi convidado. O id vem na busca, porque o aplicativo lista as equipes da pessoa. */
export async function GET(request: Request) {
  const auth = await authorizeRequest(request, "members-read");
  if ("response" in auth) return auth.response;

  const organizationId = new URL(request.url).searchParams.get("equipe") ?? "";
  const parsed = organizationIdSchema.safeParse({ organizationId });
  if (!parsed.success) return invalidPayload();

  const result = await getTeamPeople(auth.session.supabase, parsed.data.organizationId, auth.session.userId);
  if (!result.ok) return Response.json({ error: result.error }, { status: 404 });

  return Response.json(result.data);
}

export async function POST(request: Request) {
  const auth = await authorizeRequest(request, "invite");
  if ("response" in auth) return auth.response;

  const parsed = createInviteSchema.safeParse(await readJson(request));
  if (!parsed.success) return invalidPayload();

  /* A equipe vem por id, e quem pode convidar é o banco: a leitura serve para o nome do time no e-mail, e a
     RLS devolve nada para quem não participa. */
  const team = await getTeam(auth.session.supabase, parsed.data.organizationId);
  if (!team) return Response.json({ error: "Time não encontrado" }, { status: 404 });

  const people = await getTeamPeople(auth.session.supabase, parsed.data.organizationId, auth.session.userId);

  const result = await inviteMember(auth.session.supabase, parsed.data, {
    origin: siteConfig.url,
    teamName: team.name,
    inviterName: people.ok ? people.data.viewer.name : null,
  });

  if (!result.ok) return Response.json({ error: result.error }, { status: 400 });
  return Response.json(result.data);
}

export async function PATCH(request: Request) {
  const auth = await authorizeRequest(request, "role");
  if ("response" in auth) return auth.response;

  const payload = await readJson(request);
  const member = memberRoleChangeSchema.safeParse(payload);
  const invite = inviteRoleChangeSchema.safeParse(payload);

  const result = member.success
    ? await changeMemberRole(auth.session.supabase, member.data)
    : invite.success
      ? await changeInviteRole(auth.session.supabase, invite.data)
      : null;

  if (!result) return invalidPayload();
  if (!result.ok) return Response.json({ error: result.error }, { status: 400 });

  return new Response(null, { status: 204 });
}

export async function DELETE(request: Request) {
  const auth = await authorizeRequest(request, "member-remove");
  if ("response" in auth) return auth.response;

  const payload = await readJson(request);
  const member = memberRemovalSchema.safeParse(payload);
  if (member.success) {
    const result = await removeMember(auth.session.supabase, member.data);
    if (!result.ok) return Response.json({ error: result.error }, { status: 400 });
    return new Response(null, { status: 204 });
  }

  const invite = inviteRemovalSchema.safeParse(payload);
  if (!invite.success) return invalidPayload();

  const result = await cancelInvite(auth.session.supabase, invite.data);
  if (!result.ok) return Response.json({ error: result.error }, { status: 400 });

  return new Response(null, { status: 204 });
}
