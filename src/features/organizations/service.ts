import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, TablesUpdate } from "@/types/database";
import {
  LOGO_BUCKET,
  slugFromName,
  type CreateInviteInput,
  type ImageKind,
  type InvitableRole,
  type LogoContentType,
  type MemberRole,
  type OrganizationIndustry,
  type SaveTeamInput,
} from "./schemas";
import { sendInviteEmail } from "./emails";

export type TeamClient = SupabaseClient<Database>;

export type ServiceResult<T> = { ok: true; data: T } | { ok: false; error: string };

export type Team = {
  id: string;
  name: string;
  slug: string;
  industry: OrganizationIndustry | null;
  website: string | null;
  logoUrl: string | null;
  bannerUrl: string | null;
  completed: boolean;
};

export type TeamMember = {
  userId: string;
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
  role: MemberRole;
};

export type TeamInvite = {
  id: string;
  name: string | null;
  email: string;
  role: MemberRole;
};

export type TeamState = {
  team: Team | null;
  members: TeamMember[];
  invites: TeamInvite[];
  viewer: TeamMember;
};

const logoExtensions: Record<LogoContentType, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

const teamColumns = "id, name, slug, industry, website, logo_url, banner_url, onboarding_completed_at";

const SLUG_TAKEN = "Já existe um time com esse endereço. Mude o nome do time.";
const SAVE_FAILED = "Não foi possível salvar os dados do time. Tente de novo em instantes.";

type TeamRow = {
  id: string;
  name: string;
  slug: string;
  industry: OrganizationIndustry | null;
  website: string | null;
  logo_url: string | null;
  banner_url: string | null;
  onboarding_completed_at: string | null;
};

function toTeam(row: TeamRow): Team {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    industry: row.industry,
    website: row.website,
    logoUrl: row.logo_url,
    bannerUrl: row.banner_url,
    completed: Boolean(row.onboarding_completed_at),
  };
}

// A mensagem do Postgres já chega pronta e em português das funções do banco; só o erro de
// unicidade precisa de tradução, porque ali o texto do driver é o nome do índice.
function messageOf(error: { code?: string; message: string }, fallback: string) {
  if (error.code === "23505") return SLUG_TAKEN;
  return error.message || fallback;
}

async function organizationOf(client: TeamClient, userId: string, current: string | null) {
  if (current) return current;

  const { data: membership } = await client
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", userId)
    .order("created_at")
    .limit(1)
    .maybeSingle();

  return membership?.organization_id ?? null;
}

export async function getTeamState(client: TeamClient, userId: string): Promise<TeamState> {
  const { data: profile } = await client
    .from("profiles")
    .select("full_name, email, avatar_url, current_organization_id")
    .eq("id", userId)
    .maybeSingle();

  const viewer: TeamMember = {
    userId,
    name: profile?.full_name ?? null,
    email: profile?.email ?? null,
    avatarUrl: profile?.avatar_url ?? null,
    role: "owner",
  };

  const organizationId = await organizationOf(client, userId, profile?.current_organization_id ?? null);
  if (!organizationId) return { team: null, members: [], invites: [], viewer };

  const { data: row } = await client.from("organizations").select(teamColumns).eq("id", organizationId).maybeSingle();
  if (!row) return { team: null, members: [], invites: [], viewer };

  const [{ data: members }, { data: invites }] = await Promise.all([
    client.rpc("team_members", { p_organization_id: organizationId }),
    client
      .from("organization_invites")
      .select("id, name, email, role")
      .eq("organization_id", organizationId)
      .is("accepted_at", null)
      .order("created_at"),
  ]);

  const people = (members ?? []).map((member) => ({
    userId: member.user_id,
    name: member.name,
    email: member.email,
    avatarUrl: member.avatar_url,
    role: member.role,
  }));

  return {
    team: toTeam(row),
    members: people,
    invites: (invites ?? []).map((invite) => ({
      id: invite.id,
      name: invite.name,
      email: invite.email,
      role: invite.role,
    })),
    viewer: people.find((person) => person.userId === userId) ?? viewer,
  };
}

// O endereço saiu do formulário e vem do nome, então colisão não é erro de quem preencheu:
// tenta sufixo antes de devolver mensagem. O aleatório fecha a corrida entre dois cadastros iguais.
const SLUG_ATTEMPTS = 5;

function slugAttempts(name: string) {
  const base = slugFromName(name);
  const variants = [base];
  for (let position = 2; position <= SLUG_ATTEMPTS; position += 1) variants.push(`${base}-${position}`);
  variants.push(`${base}-${Math.random().toString(36).slice(2, 6)}`);
  return variants;
}

type TeamValues = { name: string; industry: OrganizationIndustry; website: string | null };

async function updateTeam(client: TeamClient, id: string, values: TeamValues, slugs: string[]) {
  for (const slug of slugs) {
    const { data, error } = await client
      .from("organizations")
      .update({ ...values, slug })
      .eq("id", id)
      .select(teamColumns)
      .maybeSingle();

    if (!error && data) return { ok: true, data: toTeam(data) } as const;
    if (error && error.code !== "23505") return { ok: false, error: messageOf(error, SAVE_FAILED) } as const;
    if (!error && !data) return { ok: false, error: SAVE_FAILED } as const;
  }

  return { ok: false, error: SLUG_TAKEN } as const;
}

// O id sai daqui e a leitura é separada de propósito: o RETURNING de um insert passa pela policy de
// select, e a associação que torna a linha visível só nasce no trigger AFTER INSERT, que roda depois.
async function createTeam(client: TeamClient, values: TeamValues, slugs: string[]) {
  const id = crypto.randomUUID();

  for (const slug of slugs) {
    const { error } = await client.from("organizations").insert({ id, ...values, slug });
    if (error) {
      if (error.code !== "23505") return { ok: false, error: messageOf(error, SAVE_FAILED) } as const;
      continue;
    }

    const { data } = await client.from("organizations").select(teamColumns).eq("id", id).maybeSingle();
    return data ? ({ ok: true, data: toTeam(data) } as const) : ({ ok: false, error: SAVE_FAILED } as const);
  }

  return { ok: false, error: SLUG_TAKEN } as const;
}

export async function saveTeam(client: TeamClient, input: SaveTeamInput): Promise<ServiceResult<Team>> {
  const values = { name: input.name, industry: input.industry, website: input.website };
  const slugs = slugAttempts(input.name);

  return input.organizationId
    ? updateTeam(client, input.organizationId, values, slugs)
    : createTeam(client, values, slugs);
}

export async function inviteMember(
  client: TeamClient,
  input: CreateInviteInput,
  context: { origin: string; teamName: string; inviterName: string | null },
): Promise<ServiceResult<TeamInvite>> {
  const { data: token, error } = await client.rpc("create_invite", {
    p_organization_id: input.organizationId,
    p_email: input.email,
    p_name: input.name,
    p_role: input.role,
  });

  if (error) return { ok: false, error: messageOf(error, "Não foi possível enviar o convite.") };

  const { data: invite } = await client
    .from("organization_invites")
    .select("id, name, email, role")
    .eq("organization_id", input.organizationId)
    .eq("email", input.email)
    .is("accepted_at", null)
    .maybeSingle();

  await sendInviteEmail({
    to: input.email,
    name: input.name,
    teamName: context.teamName,
    inviterName: context.inviterName,
    url: `${context.origin}/convite/${token}`,
  });

  return {
    ok: true,
    data: invite ?? { id: crypto.randomUUID(), name: input.name, email: input.email, role: input.role },
  };
}

export async function changeMemberRole(
  client: TeamClient,
  input: { organizationId: string; userId: string; role: MemberRole },
): Promise<ServiceResult<undefined>> {
  const { error } = await client
    .from("organization_members")
    .update({ role: input.role })
    .eq("organization_id", input.organizationId)
    .eq("user_id", input.userId);

  if (error) return { ok: false, error: messageOf(error, "Não foi possível trocar o papel dessa pessoa.") };
  return { ok: true, data: undefined };
}

export async function removeMember(
  client: TeamClient,
  input: { organizationId: string; userId: string },
): Promise<ServiceResult<undefined>> {
  const { error } = await client
    .from("organization_members")
    .delete()
    .eq("organization_id", input.organizationId)
    .eq("user_id", input.userId);

  if (error) return { ok: false, error: messageOf(error, "Não foi possível remover essa pessoa.") };
  return { ok: true, data: undefined };
}

export async function changeInviteRole(
  client: TeamClient,
  input: { organizationId: string; inviteId: string; role: InvitableRole },
): Promise<ServiceResult<undefined>> {
  const { error } = await client
    .from("organization_invites")
    .update({ role: input.role })
    .eq("organization_id", input.organizationId)
    .eq("id", input.inviteId)
    .is("accepted_at", null);

  if (error) return { ok: false, error: messageOf(error, "Não foi possível trocar o papel do convite.") };
  return { ok: true, data: undefined };
}

export async function cancelInvite(
  client: TeamClient,
  input: { organizationId: string; inviteId: string },
): Promise<ServiceResult<undefined>> {
  const { error } = await client
    .from("organization_invites")
    .delete()
    .eq("organization_id", input.organizationId)
    .eq("id", input.inviteId);

  if (error) return { ok: false, error: messageOf(error, "Não foi possível cancelar o convite.") };
  return { ok: true, data: undefined };
}

export async function createImageUpload(
  client: TeamClient,
  input: { organizationId: string; contentType: LogoContentType; kind: ImageKind },
): Promise<ServiceResult<{ path: string; token: string }>> {
  const path = `${input.organizationId}/${input.kind}-${crypto.randomUUID()}.${logoExtensions[input.contentType]}`;
  const { data, error } = await client.storage.from(LOGO_BUCKET).createSignedUploadUrl(path);

  if (error || !data) return { ok: false, error: "Não foi possível preparar o envio da imagem." };
  return { ok: true, data: { path: data.path, token: data.token } };
}

export async function attachImage(
  client: TeamClient,
  input: { organizationId: string; path: string; kind: ImageKind },
): Promise<ServiceResult<string>> {
  if (!input.path.startsWith(`${input.organizationId}/`)) {
    return { ok: false, error: "Arquivo fora da pasta do time." };
  }

  const { data: current } = await client
    .from("organizations")
    .select("logo_url, banner_url")
    .eq("id", input.organizationId)
    .maybeSingle();

  const {
    data: { publicUrl },
  } = client.storage.from(LOGO_BUCKET).getPublicUrl(input.path);

  const values: TablesUpdate<"organizations"> =
    input.kind === "logo" ? { logo_url: publicUrl } : { banner_url: publicUrl };

  const { error } = await client.from("organizations").update(values).eq("id", input.organizationId);

  if (error) return { ok: false, error: "Não foi possível salvar a imagem." };

  const previous = storagePathOf(input.kind === "logo" ? current?.logo_url : current?.banner_url);
  if (previous && previous !== input.path) {
    await client.storage.from(LOGO_BUCKET).remove([previous]);
  }

  return { ok: true, data: publicUrl };
}

export async function acceptInvite(client: TeamClient, token: string): Promise<ServiceResult<string>> {
  const { data, error } = await client.rpc("accept_invite", { p_token: token });
  if (error) return { ok: false, error: messageOf(error, "Convite inválido ou expirado.") };
  return { ok: true, data };
}

export async function completeOnboarding(
  client: TeamClient,
  organizationId: string,
): Promise<ServiceResult<undefined>> {
  const { error } = await client.rpc("complete_onboarding", { p_organization_id: organizationId });
  if (error) return { ok: false, error: messageOf(error, "Não foi possível concluir a configuração.") };
  return { ok: true, data: undefined };
}

function storagePathOf(publicUrl: string | null | undefined) {
  if (!publicUrl) return null;
  const marker = `/${LOGO_BUCKET}/`;
  const index = publicUrl.indexOf(marker);
  return index === -1 ? null : publicUrl.slice(index + marker.length);
}
