"use server";

import { headers } from "next/headers";
import { unstable_rethrow } from "next/navigation";
import { UNEXPECTED, firstIssue, guardedAction, revalidateDomain } from "@/features/organizations/context";
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
  return guardedAction<QuoteSaveResult>(
    "quote-save",
    async ({ supabase, organizationId, user }) => {
      const parsed = quoteFormSchema.safeParse(input);
      if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) };

      const saved = await saveQuote(supabase, organizationId, user.id, parsed.data);
      if (!saved.ok) return { ok: false, error: saved.error, field: saved.error.includes("cliente") ? "clientId" : undefined };

      await revalidateDomain(organizationId, [cacheTags.quotes], ["/orcamentos"]);
      return { ok: true, id: saved.data.id, status: saved.data.status };
    },
    (error) => ({ ok: false, error }),
  );
}

export async function deleteQuotesAction(input: unknown): Promise<QuoteDeleteResult> {
  return guardedAction<QuoteDeleteResult>(
    "quote-delete",
    async ({ supabase, organizationId }) => {
      const parsed = quoteIdsSchema.safeParse(input);
      if (!parsed.success) return { ok: false, error: "Escolha ao menos um orçamento." };

      const removed = await deleteQuotes(supabase, organizationId, parsed.data);
      if (!removed.ok) return { ok: false, error: removed.error };

      await revalidateDomain(organizationId, [cacheTags.quotes], ["/orcamentos"]);
      return { ok: true, deleted: removed.data.deleted };
    },
    (error) => ({ ok: false, error }),
  );
}

/** Gera um link novo e derruba o anterior, para quando o endereço vazou ou foi para a pessoa errada. */
export async function rotateQuoteTokenAction(input: unknown): Promise<QuoteTokenResult> {
  return guardedAction<QuoteTokenResult>(
    "quote-token",
    async ({ supabase, organizationId }) => {
      const parsed = quoteIdSchema.safeParse(input);
      if (!parsed.success) return { ok: false, error: "Orçamento inválido." };

      const rotated = await rotateQuoteToken(supabase, organizationId, parsed.data);
      if (!rotated.ok) return { ok: false, error: rotated.error };

      await revalidateDomain(organizationId, [cacheTags.quotes], ["/orcamentos"]);
      return { ok: true, token: rotated.data.token };
    },
    (error) => ({ ok: false, error }),
  );
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

  /* O mesmo contorno do `guardedAction`, à mão, porque aqui não há sessão nem time para guardar: quem
     responde é o cliente, e uma exceção solta nesta ponta vira "não foi possível falar com o servidor" numa
     tela onde ninguém pode tentar de novo por outro caminho. */
  try {
    const responded = await respondToQuote(createAdminClient(), parsed.data.token, parsed.data.decision === "approve");
    if (!responded.ok) return { ok: false, error: responded.error };

    await revalidateDomain(responded.data.organizationId, [cacheTags.quotes], ["/orcamentos"]);
    return { ok: true, status: responded.data.status };
  } catch (error) {
    unstable_rethrow(error);
    console.error("ação quote-respond falhou:", error);
    return { ok: false, error: error instanceof Error && error.message ? error.message : UNEXPECTED };
  }
}

/**
 * Marca a situação à mão, pelo leque: enviado para quem mandou por fora, aprovado para quem fechou no
 * telefone. O documento continua o mesmo; o que muda é o que a casa sabe sobre ele.
 */
export async function markQuoteStatusAction(input: unknown): Promise<QuoteStatusResult> {
  return guardedAction<QuoteStatusResult>(
    "quote-status",
    async ({ supabase, organizationId }) => {
      const parsed = quoteStatusSchema.safeParse(input);
      if (!parsed.success) return { ok: false, error: "Situação inválida." };

      const marked = await markQuoteStatus(supabase, organizationId, parsed.data.id, parsed.data.status);
      if (!marked.ok) return { ok: false, error: marked.error };

      await revalidateDomain(organizationId, [cacheTags.quotes], ["/orcamentos"]);
      return { ok: true };
    },
    (error) => ({ ok: false, error }),
  );
}

/** Uma cópia em rascunho, com número e link novos. Devolve o id, para o editor abrir nela. */
export async function duplicateQuoteAction(input: unknown): Promise<QuoteSaveResult> {
  return guardedAction<QuoteSaveResult>(
    "quote-duplicate",
    async ({ supabase, organizationId }) => {
      const parsed = quoteIdSchema.safeParse(input);
      if (!parsed.success) return { ok: false, error: "Escolha um orçamento." };

      const copy = await duplicateQuote(supabase, organizationId, parsed.data);
      if (!copy.ok) return { ok: false, error: copy.error };

      await revalidateDomain(organizationId, [cacheTags.quotes], ["/orcamentos"]);
      return { ok: true, id: copy.data.id, status: "draft" };
    },
    (error) => ({ ok: false, error }),
  );
}
