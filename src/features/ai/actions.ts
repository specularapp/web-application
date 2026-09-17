"use server";

import { getOrganizationContext } from "@/features/organizations/context";
import { hasAi } from "@/lib/env";
import { checkRateLimit } from "@/lib/security/rate-limit";
import type { AiScopeId } from "./scope";
import { askAiSchema, conversationIdSchema, renameConversationSchema } from "./schemas";
import { ask, deleteConversation, listConversations, renameConversation } from "./service";
import type { AiConversation, AiReply } from "./conversation";
import type { AiUsage } from "./summary";

export type AskAiResult = { ok: true; conversationId: string; reply: AiReply; usage: AiUsage } | { ok: false; error: string };
export type AiResult = { ok: true } | { ok: false; error: string };

const OFFLINE = "O assistente ainda não está configurado nesta instalação.";

/**
 * Uma pergunta ao assistente. O teto de requisições é o da IA, e não o das ações comuns, porque cada
 * pergunta sai para fora e custa: vinte por minuto por pessoa é o que a regra de segurança já fixa.
 */
export async function askAiAction(input: unknown): Promise<AskAiResult> {
  if (!hasAi()) return { ok: false, error: OFFLINE };

  const context = await getOrganizationContext();
  if (!context) return { ok: false, error: "Escolha ou crie um time antes de continuar." };

  const { allowed } = await checkRateLimit("ai", `ask:${context.user.id}`, crypto.randomUUID());
  if (!allowed) return { ok: false, error: "Muitas perguntas em pouco tempo. Aguarde um instante." };

  const parsed = askAiSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Confira a pergunta." };

  /* O zod já fechou as fontes na lista do catálogo; o tipo largo é do `z.enum` montado em tempo de execução. */
  return ask(context.supabase, context.organizationId, context.user.id, { ...parsed.data, scope: parsed.data.scope as AiScopeId[] });
}

export async function deleteConversationAction(input: unknown): Promise<AiResult> {
  const context = await getOrganizationContext();
  if (!context) return { ok: false, error: "Sessão expirada." };

  const parsed = conversationIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Conversa inválida." };

  const removed = await deleteConversation(context.supabase, context.user.id, parsed.data);
  return removed.ok ? { ok: true } : { ok: false, error: removed.error };
}

export async function renameConversationAction(input: unknown): Promise<AiResult> {
  const context = await getOrganizationContext();
  if (!context) return { ok: false, error: "Sessão expirada." };

  const parsed = renameConversationSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Nome inválido." };

  const renamed = await renameConversation(context.supabase, context.user.id, parsed.data.id, parsed.data.title);
  return renamed.ok ? { ok: true } : { ok: false, error: renamed.error };
}

/**
 * As conversas guardadas, buscadas quando a coluna do assistente abre pela primeira vez. Não vêm com a
 * concha de propósito: são conteúdo longo, a coluna começa fechada, e carregá-las em toda navegação era
 * pagar a conversa inteira para desenhar um menu.
 */
export async function loadConversationsAction(): Promise<AiConversation[]> {
  const context = await getOrganizationContext();
  if (!context) return [];

  return listConversations(context.supabase, context.user.id);
}
