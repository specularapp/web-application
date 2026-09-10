"use server";

import { previewQuotes } from "./list-preview";
import { quoteFormSchema, quoteResponseSchema } from "./schemas";
import type { QuoteStatus } from "./summary";

const INVALID = "Confira os dados informados.";

export type QuoteSaveResult = { ok: true; id: string; status: QuoteStatus } | { ok: false; error: string; field?: string };
export type QuoteResponseResult = { ok: true; status: QuoteStatus } | { ok: false; error: string };

/**
 * Salva o orçamento, criando ou editando: é o mesmo formulário e a mesma regra. A entrada é validada aqui
 * com zod mesmo já validada na tela, porque é assim que toda entrada de usuário chega ao servidor. O campo
 * com problema volta pelo caminho dele ("lines.2.unitPrice", "discount.value"), para o editor acender o
 * campo certo. Salvar como enviado marca a data de envio e o token público nasce aqui, nunca na tela.
 *
 * Hoje só valida e devolve: **o domínio não existe no banco**. Quando a tabela nascer, a gravação vai para
 * `service.ts`, com a RLS valendo, exposta por esta action e por um Route Handler em `api/v1`, no contrato
 * que a base de clientes segue.
 */
export async function saveQuoteAction(input: unknown): Promise<QuoteSaveResult> {
  const parsed = quoteFormSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue?.path.join(".");
    return { ok: false, error: issue?.message ?? INVALID, field: field || undefined };
  }

  return { ok: true, id: parsed.data.id ?? `novo-${Date.now().toString(36)}`, status: parsed.data.intent === "send" ? "sent" : "draft" };
}

/**
 * A resposta do cliente pelo link público: aprovar ou recusar. O token é a única credencial, então ele é
 * validado no formato e procurado na base; nada aqui recebe id interno. Quando a tabela nascer, a mudança
 * de situação e a data da resposta gravam por `service.ts`, e o time é avisado.
 */
export async function respondToQuoteAction(input: unknown): Promise<QuoteResponseResult> {
  const parsed = quoteResponseSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: INVALID };

  const quote = previewQuotes.find((entry) => entry.shareToken === parsed.data.token);
  if (!quote) return { ok: false, error: "Este orçamento não está mais disponível." };
  if (quote.status === "approved" || quote.status === "declined") return { ok: false, error: "Este orçamento já foi respondido." };
  if (quote.status === "expired") return { ok: false, error: "Este orçamento venceu. Peça uma nova versão à equipe." };

  return { ok: true, status: parsed.data.decision === "approve" ? "approved" : "declined" };
}
