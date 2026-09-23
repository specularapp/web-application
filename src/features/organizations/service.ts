import "server-only";
import { dbMessage } from "@/lib/db/message";
import type { SupabaseClient } from "@supabase/supabase-js";
import { grantingStatuses, type BillingPlan } from "@/features/billing/schemas";
import type { Database, TablesUpdate } from "@/types/database";
import type { TeamMember as SummaryMember, TeamMemberProject, TeamSummary } from "./summary";
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
  email: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
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

/** Time como ele aparece na troca: só o que a linha da lista desenha, mais o plano em vigor. */
export type TeamOption = {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  plan: BillingPlan;
};

/** Quem está numa equipe e quem foi convidado, com o papel de quem pede. */
export type TeamPeople = { members: TeamMember[]; invites: TeamInvite[]; viewer: TeamMember };

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

const teamColumns = "id, name, slug, industry, website, email, phone, city, state, logo_url, banner_url, onboarding_completed_at";

const SLUG_TAKEN = "Já existe um time com esse endereço. Mude o nome do time.";
const SAVE_FAILED = "Não foi possível salvar os dados do time. Tente de novo em instantes.";

type TeamRow = {
  id: string;
  name: string;
  slug: string;
  industry: OrganizationIndustry | null;
  website: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
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
    email: row.email,
    phone: row.phone,
    city: row.city,
    state: row.state,
    logoUrl: row.logo_url,
    bannerUrl: row.banner_url,
    completed: Boolean(row.onboarding_completed_at),
  };
}

/* O texto das funções do banco chega pronto e em português, e é o `dbMessage` que o deixa passar;
   a unicidade é traduzida aqui porque neste domínio ela significa endereço de equipe repetido. */
function messageOf(error: { code?: string; message: string }, fallback: string) {
  if (error.code === "23505") return SLUG_TAKEN;
  return dbMessage(error, fallback);
}

/**
 * Uma escrita de uma linha só, conferida pelo retorno (2026-09-22, na varredura). Escrita que não casa
 * nenhuma linha não é erro no Supabase: `update` e `delete` voltam sem `error` e com dado nulo, e é assim
 * que a RLS recusa (a policy de update de membro é só de dono) e é assim que responde a linha que outra
 * pessoa já removeu. Olhando só o `error`, as quatro escritas de equipe devolviam sucesso, a tela mostrava
 * aviso verde e o banco continuava igual. O `updateTeam` aqui embaixo já trata `!error && !data` assim.
 */
function confirmWrite(
  result: { data: unknown; error: { code?: string; message: string } | null },
  failed: string,
  missing: string,
): ServiceResult<undefined> {
  if (result.error) return { ok: false, error: messageOf(result.error, failed) };
  if (!result.data) return { ok: false, error: missing };
  return { ok: true, data: undefined };
}

export async function organizationOf(client: TeamClient, userId: string, current: string | null) {
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
    /* Com equipe em mãos e sem a própria linha entre os membros, o papel de reserva é o mais restrito
       (2026-09-22, na varredura): é o caso de quem criou a equipe e foi removida dela, que a policy de
       select de `organizations` ainda deixa ler. Com `owner` ali, a página acendia o formulário de
       convidar de uma equipe que recusa toda escrita. O `owner` de reserva continua valendo para quem
       ainda não tem equipe nenhuma, que é quem a configuração inicial espera. */
    viewer: people.find((person) => person.userId === userId) ?? { ...viewer, role: "member" },
  };
}

/**
 * As pessoas de uma equipe qualquer de que quem pede participa, para a gaveta de editar equipe mostrar quem
 * está dentro e convidar mais gente (2026-09-21, a pedido). O `getTeamState` acima serve a equipe em uso, que
 * é o caso da página de configurações; aqui a equipe vem por id, porque o seletor edita qualquer uma da lista.
 *
 * Quem pode ler é a RLS: um id de equipe de fora devolve nada, e sem o próprio nome na lista de membros a
 * resposta é a mesma de equipe inexistente, para o id não servir de sonda.
 */
export async function getTeamPeople(
  client: TeamClient,
  organizationId: string,
  userId: string,
): Promise<ServiceResult<TeamPeople>> {
  const [{ data: members }, { data: invites }] = await Promise.all([
    client.rpc("team_members", { p_organization_id: organizationId }),
    client
      .from("organization_invites")
      .select("id, name, email, role")
      .eq("organization_id", organizationId)
      .is("accepted_at", null)
      .order("created_at"),
  ]);

  const people: TeamMember[] = (members ?? []).map((member) => ({
    userId: member.user_id,
    name: member.name,
    email: member.email,
    avatarUrl: member.avatar_url,
    role: member.role,
  }));

  const viewer = people.find((person) => person.userId === userId);
  if (!viewer) return { ok: false, error: "Equipe não encontrada." };

  return {
    ok: true,
    data: {
      members: people,
      invites: (invites ?? []).map((invite) => ({
        id: invite.id,
        name: invite.name,
        email: invite.email,
        role: invite.role,
      })),
      viewer,
    },
  };
}

/**
 * A equipe da organização como os seletores dos outros domínios a listam: quem responde por um projeto,
 * quem cuida de uma tarefa, quem fica com uma oportunidade. Uma função só, porque três leituras diferentes
 * da mesma lista sairiam de sincronia no primeiro papel novo.
 */
export async function listTeamMembers(client: TeamClient, organizationId: string): Promise<TeamMember[]> {
  const { data } = await client.rpc("team_members", { p_organization_id: organizationId });

  return (data ?? []).map((member) => ({
    userId: member.user_id,
    name: member.name,
    email: member.email,
    avatarUrl: member.avatar_url,
    role: member.role,
  }));
}

/** Quem emite documento pela equipe: o cabeçalho do orçamento, do contrato e do link de cobrança. */
export async function getIssuer(client: TeamClient, organizationId: string) {
  const { data } = await client
    .from("organizations")
    .select("name, logo_url, website, email, phone, city, state")
    .eq("id", organizationId)
    .maybeSingle();

  return {
    name: data?.name ?? "Equipe",
    logoUrl: data?.logo_url ?? null,
    website: data?.website ?? undefined,
    email: data?.email ?? undefined,
    phone: data?.phone ?? undefined,
    city: data?.city ?? undefined,
    state: data?.state ?? undefined,
  };
}

// A leitura entra pela associação, e não por `organizations`: a policy de select de lá também deixa
// passar o time que a pessoa criou, então quem saiu do time continuaria vendo o time na troca e
// escolheria um destino que `set_current_org` recusa.
/** Uma equipe de que a pessoa participa, pelo id: é o que a gaveta de editar lê para abrir preenchida. */
export async function getTeam(client: TeamClient, organizationId: string): Promise<Team | null> {
  const { data } = await client.from("organizations").select(teamColumns).eq("id", organizationId).maybeSingle();
  return data ? toTeam(data) : null;
}

export async function listTeams(client: TeamClient, userId: string): Promise<TeamOption[]> {
  const { data: memberships } = await client
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", userId);

  const ids = (memberships ?? []).map((row) => row.organization_id);
  if (ids.length === 0) return [];

  const [{ data: rows }, { data: subscriptions }] = await Promise.all([
    /* Arquivada some da lista: é o que arquivar quer dizer. Ela continua no banco e volta ao desarquivar. */
    client.from("organizations").select("id, name, slug, logo_url").in("id", ids).is("archived_at", null).order("name"),
    client.from("organization_subscriptions").select("organization_id, plan, status").in("organization_id", ids),
  ]);

  const contracted = new Map<string, BillingPlan>();
  for (const row of subscriptions ?? []) {
    if (grantingStatuses.includes(row.status)) contracted.set(row.organization_id, row.plan);
  }

  return (rows ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    logoUrl: row.logo_url,
    plan: contracted.get(row.id) ?? "free",
  }));
}

// Quem decide se a troca vale é o banco: `set_current_org` recusa organização de que a pessoa não
// participa, então a mesma porta serve à web e ao aplicativo sem repetir a checagem aqui.
export async function switchTeam(client: TeamClient, organizationId: string): Promise<ServiceResult<undefined>> {
  const { error } = await client.rpc("set_current_org", { p_organization_id: organizationId });
  if (error) return { ok: false, error: messageOf(error, "Não foi possível trocar de time.") };
  return { ok: true, data: undefined };
}

/**
 * Arquivar uma equipe, que é o lugar do excluir (2026-09-16, a pedido): ela sai da lista de quem participa e
 * ninguém entra nela, mas nada é apagado, e desarquivar traz tudo de volta. Quem decide se pode é o banco,
 * na função `set_organization_archived`, que exige ser dono: a policy de update da tabela abre para owner e
 * admin, o que vale para trocar o nome, mas tirar a equipe do ar é decisão de quem responde por ela.
 *
 * Quem estava dentro dela sai junto, pela mesma função: o perfil solta a equipe em vigor, e é a aplicação
 * que escolhe a próxima.
 */
export async function setTeamArchived(
  client: TeamClient,
  input: { organizationId: string; archived: boolean },
): Promise<ServiceResult<undefined>> {
  const { error } = await client.rpc("set_organization_archived", {
    p_organization_id: input.organizationId,
    p_archived: input.archived,
  });

  if (error) {
    return { ok: false, error: messageOf(error, input.archived ? "Não foi possível arquivar a equipe." : "Não foi possível reabrir a equipe.") };
  }
  return { ok: true, data: undefined };
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

type TeamValues = {
  name: string;
  industry: OrganizationIndustry;
  website: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
};

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
  const values = {
    name: input.name,
    industry: input.industry,
    website: input.website,
    email: input.email,
    phone: input.phone,
    city: input.city,
    state: input.state,
  };
  const slugs = slugAttempts(input.name);

  return input.organizationId
    ? updateTeam(client, input.organizationId, values, slugs)
    : createTeam(client, values, slugs);
}

const LIMIT_UNKNOWN = "Não foi possível conferir o limite de pessoas do plano.";

/**
 * O teto de pessoas do plano (`team_members` em `plan_entitlements`: uma no gratuito, cinco no Pro), que
 * nenhum ponto do convite conferia (2026-09-22, na varredura). O que já ocupa lugar são os membros mais os
 * convites pendentes: sem somar o pendente, vinte convites saem de uma vez e o teto só seria furado na
 * aceitação, quando não há mais o que recusar. Quem compara é o banco, na mesma `plan_within_limit` que o
 * resto do mapa de recursos usa.
 *
 * O e-mail que está sendo convidado entra aqui porque o convite pendente dele não ocupa lugar novo: o
 * `create_invite` apaga o pendente daquele endereço antes de gravar o outro, então reenviar deixa o total de
 * gente igual. Contando o próprio pendente, uma equipe no teto recusava o reenvio de um convite que ela
 * mesma já tinha mandado. O endereço chega normalizado pelo esquema, do mesmo jeito que a coluna o guarda.
 *
 * Fica aqui, e não na action, para a rota de `api/v1` e o aplicativo herdarem a regra. Devolve a mensagem
 * do bloqueio, ou nulo quando ainda cabe gente.
 */
async function memberLimitBlock(client: TeamClient, organizationId: string, email: string): Promise<string | null> {
  const [members, invites] = await Promise.all([
    client
      .from("organization_members")
      .select("user_id", { count: "exact", head: true })
      .eq("organization_id", organizationId),
    client
      .from("organization_invites")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .is("accepted_at", null)
      .neq("email", email),
  ]);

  /* Sem conseguir conferir, o convite não sai: deixar passar por engano do banco é justamente como o teto
     deixou de existir. Contagem que falhou volta com `count` nulo e sem lançar, então ela precisa ser lida
     aqui: somada como zero, ela fazia o teto liberar tudo, o contrário do que esta função existe para fazer. */
  if (members.error) return messageOf(members.error, LIMIT_UNKNOWN);
  if (invites.error) return messageOf(invites.error, LIMIT_UNKNOWN);

  const { data: fits, error } = await client.rpc("plan_within_limit", {
    p_organization_id: organizationId,
    p_feature_key: "team_members",
    p_count: (members.count ?? 0) + (invites.count ?? 0),
  });

  if (error) return messageOf(error, LIMIT_UNKNOWN);
  if (fits) return null;

  const { data: limit } = await client.rpc("plan_limit", {
    p_organization_id: organizationId,
    p_feature_key: "team_members",
  });

  const room = limit === 1 ? "uma pessoa" : `${limit ?? 0} pessoas`;
  return `O plano em vigor é de ${room} na equipe, contando os convites pendentes. Mude de plano para convidar mais gente.`;
}

export async function inviteMember(
  client: TeamClient,
  input: CreateInviteInput,
  context: { origin: string; teamName: string; inviterName: string | null },
): Promise<ServiceResult<TeamInvite>> {
  const blocked = await memberLimitBlock(client, input.organizationId, input.email);
  if (blocked) return { ok: false, error: blocked };

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
  const result = await client
    .from("organization_members")
    .update({ role: input.role })
    .eq("organization_id", input.organizationId)
    .eq("user_id", input.userId)
    .select("user_id")
    .maybeSingle();

  return confirmWrite(
    result,
    "Não foi possível trocar o papel dessa pessoa.",
    "Só quem é dono da equipe troca papéis, e a pessoa precisa continuar nela.",
  );
}

export async function removeMember(
  client: TeamClient,
  input: { organizationId: string; userId: string },
): Promise<ServiceResult<undefined>> {
  const result = await client
    .from("organization_members")
    .delete()
    .eq("organization_id", input.organizationId)
    .eq("user_id", input.userId)
    .select("user_id")
    .maybeSingle();

  return confirmWrite(
    result,
    "Não foi possível remover essa pessoa.",
    "Essa pessoa já não está mais na equipe, ou você não pode removê-la.",
  );
}

export async function changeInviteRole(
  client: TeamClient,
  input: { organizationId: string; inviteId: string; role: InvitableRole },
): Promise<ServiceResult<undefined>> {
  const result = await client
    .from("organization_invites")
    .update({ role: input.role })
    .eq("organization_id", input.organizationId)
    .eq("id", input.inviteId)
    .is("accepted_at", null)
    .select("id")
    .maybeSingle();

  return confirmWrite(
    result,
    "Não foi possível trocar o papel do convite.",
    "Esse convite já não está mais pendente, ou você não pode mudá-lo.",
  );
}

export async function cancelInvite(
  client: TeamClient,
  input: { organizationId: string; inviteId: string },
): Promise<ServiceResult<undefined>> {
  const result = await client
    .from("organization_invites")
    .delete()
    .eq("organization_id", input.organizationId)
    .eq("id", input.inviteId)
    .select("id")
    .maybeSingle();

  return confirmWrite(
    result,
    "Não foi possível cancelar o convite.",
    "Esse convite já saiu da lista de pendentes.",
  );
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

/**
 * O bloco de equipe do painel: quem está no time e quem foi convidado, com os números que cada pessoa
 * produziu no sistema. Os números saem de projetos, tarefas e cobranças em três consultas para o time
 * inteiro, e não uma por pessoa: com dez pessoas seriam trinta idas ao banco para desenhar um bloco.
 */
export async function getTeamSummary(client: TeamClient, organizationId: string): Promise<TeamSummary> {
  const [people, invites, projects, tasks, charges] = await Promise.all([
    listTeamMembers(client, organizationId),
    client.from("organization_invites").select("id, name, email, role, created_at").eq("organization_id", organizationId).is("accepted_at", null),
    client.from("projects").select("id, reference, name, status, progress, owner_id").eq("organization_id", organizationId),
    client.from("tasks").select("owner_id, task_stages!inner(kind)").eq("organization_id", organizationId).neq("task_stages.kind", "done"),
    client.from("charges").select("owner_id, charge_installments(amount, paid_at)").eq("organization_id", organizationId),
  ]);

  const { data: membership } = await client
    .from("organization_members")
    .select("user_id, created_at")
    .eq("organization_id", organizationId);

  const joined = new Map((membership ?? []).map((row) => [row.user_id, row.created_at.slice(0, 10)]));

  const emptyMetrics = () => ({ deliveredProjects: 0, revenue: 0, activeProjects: 0, openTasks: 0 });
  const metrics = new Map(people.map((member) => [member.userId, emptyMetrics()]));
  const owned = new Map<string, TeamMemberProject[]>(people.map((member) => [member.userId, []]));

  const projectStatus: Record<string, TeamMemberProject["status"]> = {
    active: "ongoing",
    done: "done",
    paused: "paused",
    cancelled: "paused",
  };

  for (const project of projects.data ?? []) {
    if (!project.owner_id) continue;
    const entry = metrics.get(project.owner_id);
    if (!entry) continue;
    if (project.status === "done") entry.deliveredProjects += 1;
    if (project.status === "active") entry.activeProjects += 1;
    owned.get(project.owner_id)?.push({
      id: project.id,
      reference: project.reference,
      name: project.name,
      status: projectStatus[project.status] ?? "ongoing",
      progress: project.progress,
    });
  }

  for (const task of tasks.data ?? []) {
    if (!task.owner_id) continue;
    const entry = metrics.get(task.owner_id);
    if (entry) entry.openTasks += 1;
  }

  for (const charge of charges.data ?? []) {
    if (!charge.owner_id) continue;
    const entry = metrics.get(charge.owner_id);
    if (!entry) continue;
    entry.revenue += (charge.charge_installments ?? []).reduce(
      (sum, installment) => sum + (installment.paid_at ? installment.amount : 0),
      0,
    );
  }

  const roleLabel: Record<MemberRole, string> = { owner: "Proprietário", admin: "Administrador", member: "Membro" };

  const members: SummaryMember[] = people.map((member) => ({
    id: member.userId,
    name: member.name || member.email || "Equipe",
    role: roleLabel[member.role],
    avatarUrl: member.avatarUrl,
    status: "active",
    access: member.role,
    email: member.email ?? "",
    phone: null,
    joinedAt: joined.get(member.userId) ?? new Date().toISOString().slice(0, 10),
    points: 0,
    skills: [],
    metrics: metrics.get(member.userId) ?? emptyMetrics(),
    projects: owned.get(member.userId) ?? [],
    activity: [],
  }));

  /* Quem foi convidado e ainda não entrou aparece no bloco com o ponto de pendente: é o que faz o convite
     esquecido ser visto em vez de ficar só na tela de configuração. */
  const pending: SummaryMember[] = (invites.data ?? []).map((invite) => ({
    id: invite.id,
    name: invite.name || invite.email,
    role: roleLabel[invite.role],
    avatarUrl: null,
    status: "pending",
    access: invite.role,
    email: invite.email,
    phone: null,
    joinedAt: invite.created_at.slice(0, 10),
    points: 0,
    skills: [],
    metrics: emptyMetrics(),
    projects: [],
    activity: [],
  }));

  return { members: [...members, ...pending] };
}
