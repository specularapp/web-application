import { siteConfig } from "@/lib/metadata";
import {
  createInviteSchema,
  inviteRemovalSchema,
  inviteRoleChangeSchema,
  memberRemovalSchema,
  memberRoleChangeSchema,
} from "@/features/organizations/schemas";
import {
  cancelInvite,
  changeInviteRole,
  changeMemberRole,
  getTeamState,
  inviteMember,
  removeMember,
} from "@/features/organizations/service";
import { authorizeRequest, invalidPayload, readJson } from "@/lib/api/v1";

export async function POST(request: Request) {
  const auth = await authorizeRequest(request, "invite");
  if ("response" in auth) return auth.response;

  const parsed = createInviteSchema.safeParse(await readJson(request));
  if (!parsed.success) return invalidPayload();

  const state = await getTeamState(auth.session.supabase, auth.session.userId);
  if (!state.team || state.team.id !== parsed.data.organizationId) {
    return Response.json({ error: "Time não encontrado" }, { status: 404 });
  }

  const result = await inviteMember(auth.session.supabase, parsed.data, {
    origin: siteConfig.url,
    teamName: state.team.name,
    inviterName: state.viewer.name,
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
