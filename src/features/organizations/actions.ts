"use server";

import { refresh, revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { requireUser } from "@/features/auth/session";
import { cacheTags } from "@/lib/cache/tags";
import { siteConfig } from "@/lib/metadata";
import { checkRateLimit, clientIp } from "@/lib/security/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { revalidateDomain } from "./context";
import { markNotificationsRead } from "./notifications";
import {
  archiveTeamSchema,
  createInviteSchema,
  notificationIdsSchema,
  imageAttachSchema,
  imageUploadSchema,
  inviteRemovalSchema,
  inviteRoleChangeSchema,
  inviteTokenSchema,
  memberRemovalSchema,
  memberRoleChangeSchema,
  organizationIdSchema,
  saveTeamSchema,
} from "./schemas";
import {
  acceptInvite,
  attachImage,
  getTeam,
  setTeamArchived,
  cancelInvite,
  changeInviteRole,
  changeMemberRole,
  completeOnboarding,
  createImageUpload,
  getTeamPeople,
  inviteMember,
  removeMember,
  saveTeam,
  switchTeam,
  type ServiceResult,
  type Team,
  type TeamInvite,
  type TeamPeople,
} from "./service";

const DASHBOARD_PATH = "/dashboard";
const TOO_MANY = "Muitas ações em pouco tempo. Aguarde um instante e tente de novo.";
const INVALID = "Confira os dados informados.";

// `revalidatePath` só onde a tela depende do servidor para mudar: aceitar convite e concluir a
// configuração. Nas outras, ele custava o preço de re-renderizar o painel dentro da própria resposta da
// action, e o painel refaz a leitura inteira do time e da cobrança, mais de dez idas ao banco. O fluxo de
// primeiros passos já tem o dado em mãos: a action devolve o time salvo e a lista de membros é estado
// local. Era isso que fazia cada etapa levar segundos para virar.

async function withinActionLimit(operation: string, userId: string) {
  const { allowed } = await checkRateLimit("action", `${operation}:${userId}`, crypto.randomUUID());
  return allowed;
}

/**
 * O que toda escrita de pessoa ou de convite faz depois de gravar (2026-09-22, na varredura): derruba a tag
 * `organization` no Redis. A lista de membros alimenta o seletor de responsável do projeto e a lista de
 * pessoas do CRM, guardadas por um minuto; sem isto, quem acabou de ser removido continuava sendo oferecido
 * e o projeto saía com responsável que não é mais da equipe.
 *
 * Sem `refresh` aqui, pelo mesmo motivo do bloco acima: a tela de equipe já atualiza a própria lista com o
 * que a ação devolveu, e re-renderizar o painel dentro desta resposta era o que fazia cada clique demorar.
 */
async function dropTeamCache(organizationId: string) {
  await revalidateDomain(organizationId, [cacheTags.organization], [], false);
}

export async function saveTeamAction(input: unknown): Promise<ServiceResult<Team>> {
  const user = await requireUser(DASHBOARD_PATH);
  if (!(await withinActionLimit("team", user.id))) return { ok: false, error: TOO_MANY };

  const parsed = saveTeamSchema.safeParse(input);
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    if (field === "website") return { ok: false, error: "Confira o endereço do site, algo como specular.com.br" };
    if (field === "email") return { ok: false, error: "Confira o e-mail comercial da equipe." };
    if (field === "phone") return { ok: false, error: "Informe um telefone com DDD." };
    if (field === "city") return { ok: false, error: "A cidade precisa ter no máximo 80 caracteres." };
    if (field === "state") return { ok: false, error: "Informe a UF com duas letras, como SP." };
    if (field === "name") return { ok: false, error: "O nome do time precisa ter entre 2 e 80 caracteres." };
    if (field === "industry") return { ok: false, error: "Escolha a área de atuação do time." };
    return { ok: false, error: INVALID };
  }

  const supabase = await createClient();
  return saveTeam(supabase, parsed.data);
}

export async function switchTeamAction(input: unknown): Promise<ServiceResult<undefined>> {
  const user = await requireUser(DASHBOARD_PATH);
  if (!(await withinActionLimit("team-switch", user.id))) return { ok: false, error: TOO_MANY };

  const parsed = organizationIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: INVALID };

  const supabase = await createClient();
  const result = await switchTeam(supabase, parsed.data.organizationId);
  if (result.ok) refresh();
  return result;
}

export async function inviteMemberAction(input: unknown): Promise<ServiceResult<TeamInvite>> {
  const user = await requireUser(DASHBOARD_PATH);
  if (!(await withinActionLimit("invite", user.id))) return { ok: false, error: TOO_MANY };

  const parsed = createInviteSchema.safeParse(input);
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    if (field === "name") return { ok: false, error: "Diga o nome de quem você está convidando." };
    return { ok: false, error: "Confira o e-mail informado." };
  }

  // Teto por destinatário: sem ele o formulário de convite vira disparador de e-mail para terceiros.
  const perTarget = await checkRateLimit("authEmail", `invite:${parsed.data.email}`, crypto.randomUUID());
  if (!perTarget.allowed) return { ok: false, error: TOO_MANY };

  /* A equipe vem por id, e não da em uso: a gaveta do seletor convida por qualquer equipe da lista. Quem
     pode convidar é o banco, no `create_invite`, que exige papel de proprietário ou administrador; aqui a
     leitura serve só para o nome do time no e-mail, e a RLS já devolve nada para quem não participa. */
  const supabase = await createClient();
  const team = await getTeam(supabase, parsed.data.organizationId);
  if (!team) return { ok: false, error: "Time não encontrado." };

  const result = await inviteMember(supabase, parsed.data, {
    origin: siteConfig.url,
    teamName: team.name,
    inviterName: user.fullName,
  });

  if (result.ok) await dropTeamCache(parsed.data.organizationId);
  return result;
}

export async function changeMemberRoleAction(input: unknown): Promise<ServiceResult<undefined>> {
  const user = await requireUser(DASHBOARD_PATH);
  if (!(await withinActionLimit("role", user.id))) return { ok: false, error: TOO_MANY };

  const parsed = memberRoleChangeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: INVALID };

  const supabase = await createClient();
  const result = await changeMemberRole(supabase, parsed.data);
  if (result.ok) await dropTeamCache(parsed.data.organizationId);
  return result;
}

export async function removeMemberAction(input: unknown): Promise<ServiceResult<undefined>> {
  const user = await requireUser(DASHBOARD_PATH);
  if (!(await withinActionLimit("remove", user.id))) return { ok: false, error: TOO_MANY };

  const parsed = memberRemovalSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: INVALID };

  const supabase = await createClient();
  const result = await removeMember(supabase, parsed.data);
  if (result.ok) await dropTeamCache(parsed.data.organizationId);
  return result;
}

export async function changeInviteRoleAction(input: unknown): Promise<ServiceResult<undefined>> {
  const user = await requireUser(DASHBOARD_PATH);
  if (!(await withinActionLimit("invite-role", user.id))) return { ok: false, error: TOO_MANY };

  const parsed = inviteRoleChangeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: INVALID };

  const supabase = await createClient();
  const result = await changeInviteRole(supabase, parsed.data);
  if (result.ok) await dropTeamCache(parsed.data.organizationId);
  return result;
}

export async function cancelInviteAction(input: unknown): Promise<ServiceResult<undefined>> {
  const user = await requireUser(DASHBOARD_PATH);
  if (!(await withinActionLimit("invite-cancel", user.id))) return { ok: false, error: TOO_MANY };

  const parsed = inviteRemovalSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: INVALID };

  const supabase = await createClient();
  const result = await cancelInvite(supabase, parsed.data);
  if (result.ok) await dropTeamCache(parsed.data.organizationId);
  return result;
}

export async function createImageUploadAction(input: unknown): Promise<ServiceResult<{ path: string; token: string }>> {
  const user = await requireUser(DASHBOARD_PATH);
  if (!(await withinActionLimit("image", user.id))) return { ok: false, error: TOO_MANY };

  const parsed = imageUploadSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Envie uma imagem PNG, JPG ou WEBP." };

  const supabase = await createClient();
  return createImageUpload(supabase, parsed.data);
}

export async function attachImageAction(input: unknown): Promise<ServiceResult<string>> {
  const user = await requireUser(DASHBOARD_PATH);
  if (!(await withinActionLimit("image-attach", user.id))) return { ok: false, error: TOO_MANY };

  const parsed = imageAttachSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: INVALID };

  const supabase = await createClient();
  return attachImage(supabase, parsed.data);
}

/**
 * Arquiva ou reabre uma equipe. Quem decide se pode é o banco, que exige ser dono; aqui só passa adiante.
 * Arquivando a de agora, o perfil solta a equipe em vigor, e o painel escolhe a próxima na entrada seguinte.
 */
export async function archiveTeamAction(input: unknown): Promise<ServiceResult<undefined>> {
  const user = await requireUser(DASHBOARD_PATH);
  if (!(await withinActionLimit("team-archive", user.id))) return { ok: false, error: TOO_MANY };

  const parsed = archiveTeamSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: INVALID };

  const supabase = await createClient();
  const result = await setTeamArchived(supabase, parsed.data);
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

/** Lê uma equipe para a gaveta de editar abrir preenchida. Quem pode ler é a RLS, que já limita a quem participa. */
export async function loadTeamAction(input: unknown): Promise<ServiceResult<Team>> {
  await requireUser(DASHBOARD_PATH);

  const parsed = organizationIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: INVALID };

  const supabase = await createClient();
  const team = await getTeam(supabase, parsed.data.organizationId);
  return team ? { ok: true, data: team } : { ok: false, error: "Equipe não encontrada." };
}

/** Quem está numa equipe e quem foi convidado, para a gaveta de editar equipe. A RLS limita a quem participa. */
export async function loadTeamPeopleAction(input: unknown): Promise<ServiceResult<TeamPeople>> {
  const user = await requireUser(DASHBOARD_PATH);

  const parsed = organizationIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: INVALID };

  const supabase = await createClient();
  return getTeamPeople(supabase, parsed.data.organizationId, user.id);
}

export async function acceptInviteAction(token: unknown): Promise<ServiceResult<string>> {
  const user = await requireUser("/dashboard");
  if (!(await withinActionLimit("accept", user.id))) return { ok: false, error: TOO_MANY };

  const parsed = inviteTokenSchema.safeParse(token);
  if (!parsed.success) return { ok: false, error: "Este convite não está completo. Abra o link do e-mail de novo." };

  const supabase = await createClient();
  const result = await acceptInvite(supabase, parsed.data);
  if (result.ok) {
    revalidatePath(DASHBOARD_PATH);
  }
  return result;
}

export async function finishOnboardingAction(input: unknown): Promise<ServiceResult<undefined>> {
  const user = await requireUser(DASHBOARD_PATH);
  const headerStore = await headers();
  if (!(await withinActionLimit("finish", `${user.id}:${clientIp(headerStore)}`))) {
    return { ok: false, error: TOO_MANY };
  }

  const parsed = organizationIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: INVALID };

  // Sem `revalidatePath` aqui: ele re-renderiza o painel dentro desta mesma resposta, e o painel deixa
  // de pedir configuração, o que desmontaria a camada na hora e comeria a despedida antes dela aparecer.
  // Quem recarrega a rota é a etapa de boas-vindas, quando os dois segundos dela acabam.
  const supabase = await createClient();
  const result = await completeOnboarding(supabase, parsed.data.organizationId);
  return result;
}

/**
 * Marcar notificações como lidas. É a única escrita da pessoa nessa tabela: quem as cria é o servidor, pela
 * função com a chave secreta, porque notificação criada pela sessão seria notificação que a tela inventa.
 */
export async function markNotificationsReadAction(input: unknown): Promise<ServiceResult<undefined>> {
  const user = await requireUser(DASHBOARD_PATH);
  if (!(await withinActionLimit("notifications", user.id))) return { ok: false, error: TOO_MANY };

  const parsed = notificationIdsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: INVALID };

  const supabase = await createClient();
  await markNotificationsRead(supabase, user.id, parsed.data);
  return { ok: true, data: undefined };
}
