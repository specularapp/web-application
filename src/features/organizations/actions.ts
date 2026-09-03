"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { requireUser } from "@/features/auth/session";
import { siteConfig } from "@/lib/metadata";
import { checkRateLimit, clientIp } from "@/lib/security/rate-limit";
import { createClient } from "@/lib/supabase/server";
import {
  createInviteSchema,
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
  cancelInvite,
  changeInviteRole,
  changeMemberRole,
  completeOnboarding,
  createImageUpload,
  getTeamState,
  inviteMember,
  removeMember,
  saveTeam,
  switchTeam,
  type ServiceResult,
  type Team,
  type TeamInvite,
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

export async function saveTeamAction(input: unknown): Promise<ServiceResult<Team>> {
  const user = await requireUser(DASHBOARD_PATH);
  if (!(await withinActionLimit("team", user.id))) return { ok: false, error: TOO_MANY };

  const parsed = saveTeamSchema.safeParse(input);
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    if (field === "website") return { ok: false, error: "Confira o endereço do site, algo como specular.com.br" };
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
  return switchTeam(supabase, parsed.data.organizationId);
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

  const supabase = await createClient();
  const state = await getTeamState(supabase, user.id);
  if (!state.team || state.team.id !== parsed.data.organizationId) {
    return { ok: false, error: "Time não encontrado." };
  }

  return inviteMember(supabase, parsed.data, {
    origin: siteConfig.url,
    teamName: state.team.name,
    inviterName: user.fullName,
  });
}

export async function changeMemberRoleAction(input: unknown): Promise<ServiceResult<undefined>> {
  const user = await requireUser(DASHBOARD_PATH);
  if (!(await withinActionLimit("role", user.id))) return { ok: false, error: TOO_MANY };

  const parsed = memberRoleChangeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: INVALID };

  const supabase = await createClient();
  return changeMemberRole(supabase, parsed.data);
}

export async function removeMemberAction(input: unknown): Promise<ServiceResult<undefined>> {
  const user = await requireUser(DASHBOARD_PATH);
  if (!(await withinActionLimit("remove", user.id))) return { ok: false, error: TOO_MANY };

  const parsed = memberRemovalSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: INVALID };

  const supabase = await createClient();
  return removeMember(supabase, parsed.data);
}

export async function changeInviteRoleAction(input: unknown): Promise<ServiceResult<undefined>> {
  const user = await requireUser(DASHBOARD_PATH);
  if (!(await withinActionLimit("invite-role", user.id))) return { ok: false, error: TOO_MANY };

  const parsed = inviteRoleChangeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: INVALID };

  const supabase = await createClient();
  return changeInviteRole(supabase, parsed.data);
}

export async function cancelInviteAction(input: unknown): Promise<ServiceResult<undefined>> {
  const user = await requireUser(DASHBOARD_PATH);
  if (!(await withinActionLimit("invite-cancel", user.id))) return { ok: false, error: TOO_MANY };

  const parsed = inviteRemovalSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: INVALID };

  const supabase = await createClient();
  return cancelInvite(supabase, parsed.data);
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
