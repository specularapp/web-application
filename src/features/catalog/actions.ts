"use server";

import { catalogFormSchema } from "./schemas";

const INVALID = "Confira os dados informados.";

export type CatalogSaveResult = { ok: true; id: string } | { ok: false; error: string; field?: string };

/**
 * Salva a ficha de produto ou serviço, criando ou editando: é o mesmo formulário e a mesma regra. A entrada
 * é validada aqui com zod mesmo já validada na tela, porque é assim que toda entrada de usuário chega ao
 * servidor. O campo com problema volta pelo caminho dele ("duration.max", "stock.quantity"), para o
 * formulário acender o campo certo.
 *
 * O matiz da arte não vem do formulário (2026-09-09, a pedido): item sem foto ganha a cor derivada do nome
 * por `catalogHueFor`, como o avatar de quem não tem retrato. Na criação ele nasce daí; na edição, o que o
 * item já tem fica, para a arte de um item conhecido não trocar de cor quando renomeiam.
 *
 * Hoje só valida e devolve: **o domínio não existe no banco**. Quando a tabela nascer, a gravação vai para
 * `service.ts`, com a RLS valendo, exposta por esta action e por um Route Handler em `api/v1`, no contrato
 * que a base de clientes também segue, e é lá que o matiz derivado entra na linha nova.
 */
export async function saveCatalogItemAction(input: unknown): Promise<CatalogSaveResult> {
  const parsed = catalogFormSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue?.path.join(".");
    return { ok: false, error: issue?.message ?? INVALID, field: field || undefined };
  }

  return { ok: true, id: parsed.data.id ?? `novo-${Date.now().toString(36)}` };
}
