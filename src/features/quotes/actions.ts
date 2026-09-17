"use server";

import { headers } from "next/headers";
import { firstIssue, guardAction, revalidateDomain } from "@/features/organizations/context";
import { cacheTags } from "@/lib/cache/tags";
import { checkRateLimit, clientIp } from "@/lib/security/rate-limit";
import { createAdminClient } from "@/lib/supabase/server";
import { quoteFormSchema, quoteIdsSchema, quoteResponseSchema, quoteIdSchema, quoteStatusSchema } from "./schemas";
import { deleteQuotes, duplicateQuote, markQuoteStatus, respondToQuote, rotateQuoteToken, saveQuote } from "./service";
import type { QuoteStatus } from "./summary";

export type QuoteSaveResult = { ok: true; id: string; status: QuoteStatus } | { ok: false; error: string; field?: string };
export type QuoteResponseResult = { ok: true; status: QuoteStatus } | { ok: false; error: string };
export type QuoteDeleteResult = { ok: true; deleted: number } | { ok: false; error: string };
export type QuoteTokenResult = { ok: true; token: string } | { ok: false; error: string };
export type QuoteStatusResult = { ok: true } | { ok: false; error: string };

/**
 * Salva o orçamento, criando ou editando: é o mesmo formulário e a mesma regra. O campo com problema volta
 * pelo caminho dele ("lines.2.unitPrice", "discount.value"), para o editor acender o campo certo. Salvar
 * como enviado marca a data de envio; o token do link público nunca vem da tela, é derivado no servidor.
 */
export async function saveQuoteAction(input: unknown): Promise<QuoteSaveResult> {
  const guard = await guardAction("quote-save");
  if (!guard.ok) return { ok: false, error: guard.error };

  const parsed = quoteFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) };

  const { supabase, organizationId, user } = guard.context;
  const saved = await saveQuote(supabase, organizationId, user.id, parsed.data);
  if (!saved.ok) return { ok: false, error: saved.error, field: saved.error.includes("cliente") ? "clientId" : undefined };

  await revalidateDomain(guard.context.organizationId, [cacheTags.quotes], ["/orcamentos"]);
  return { ok: true, id: saved.data.id, status: saved.data.status };
}

export async function deleteQuotesAction(input: unknown): Promise<QuoteDeleteResult> {
  const guard = await guardAction("quote-delete");
  if (!guard.ok) return { ok: false, error: guard.error };

  const parsed = quoteIdsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Escolha ao menos um orçamento." };

  const removed = await deleteQuotes(guard.context.supabase, guard.context.organizationId, parsed.data);
  if (!removed.ok) return { ok: false, error: removed.error };

  await revalidateDomain(guard.context.organizationId, [cacheTags.quotes], ["/orcamentos"]);
  return { ok: true, deleted: removed.data.deleted };
}

/** Gera um link novo e derruba o anterior, para quando o endereço vazou ou foi para a pessoa errada. */
export async function rotateQuoteTokenAction(input: unknown): Promise<QuoteTokenResult> {
  const guard = await guardAction("quote-token");
  if (!guard.ok) return { ok: false, error: guard.error };

  const parsed = quoteIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Orçamento inválido." };

  const rotated = await rotateQuoteToken(guard.context.supabase, guard.context.organizationId, parsed.data);
  if (!rotated.ok) return { ok: false, error: rotated.error };

  await revalidateDomain(guard.context.organizationId, [cacheTags.quotes], ["/orcamentos"]);
  return { ok: true, token: rotated.data.token };
}

/**
 * A resposta do cliente pelo link público: aprovar ou recusar. O token é a única credencial, e nada aqui
 * recebe id interno. Quem responde não tem sessão, então o teto de requisições é por endereço de origem, e
 * a escrita passa pela função do banco, que confere o resumo do token e a validade do documento.
 */
export async function respondToQuoteAction(input: unknown): Promise<QuoteResponseResult> {
  const parsed = quoteResponseSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Não foi possível registrar a resposta." };

  const ip = clientIp(await headers());
  const { allowed } = await checkRateLimit("publicLink", `quote-response:${ip}`, crypto.randomUUID());
  if (!allowed) return { ok: false, error: "Muitas tentativas. Aguarde um instante." };

  const responded = await respondToQuote(createAdminClient(), parsed.data.token, parsed.data.decision === "approve");
  if (!responded.ok) return { ok: false, error: responded.error };

  await revalidateDomain(responded.data.organizationId, [cacheTags.quotes], ["/orcamentos"]);
  return { ok: true, status: responded.data.status };
}

/**
 * Marca a situação à mão, pelo leque: enviado para quem mandou por fora, aprovado para quem fechou no
 * telefone. O documento continua o mesmo; o que muda é o que a casa sabe sobre ele.
 */
export async function markQuoteStatusAction(input: unknown): Promise<QuoteStatusResult> {
  const guard = await guardAction("quote-status");
  if (!guard.ok) return { ok: false, error: guard.error };

  const parsed = quoteStatusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Situação inválida." };

  const marked = await markQuoteStatus(guard.context.supabase, guard.context.organizationId, parsed.data.id, parsed.data.status);
  if (!marked.ok) return { ok: false, error: marked.error };

  await revalidateDomain(guard.context.organizationId, [cacheTags.quotes], ["/orcamentos"]);
  return { ok: true };
}

/** Uma cópia em rascunho, com número e link novos. Devolve o id, para o editor abrir nela. */
export async function duplicateQuoteAction(input: unknown): Promise<QuoteSaveResult> {
  const guard = await guardAction("quote-duplicate");
  if (!guard.ok) return { ok: false, error: guard.error };

  const parsed = quoteIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Escolha um orçamento." };

  const copy = await duplicateQuote(guard.context.supabase, guard.context.organizationId, parsed.data);
  if (!copy.ok) return { ok: false, error: copy.error };

  await revalidateDomain(guard.context.organizationId, [cacheTags.quotes], ["/orcamentos"]);
  return { ok: true, id: copy.data.id, status: "draft" };
}
