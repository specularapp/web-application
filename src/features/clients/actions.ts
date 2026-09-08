"use server";

import { previewClients } from "./list-preview";
import { clientFormSchema, clientIdsSchema } from "./schemas";
import type { Client } from "./summary";

const INVALID = "Confira os dados informados.";

export type ClientSaveResult = { ok: true; id: string } | { ok: false; error: string; field?: string };
export type ClientDeleteResult = { ok: true; deleted: number } | { ok: false; error: string };

/**
 * A ficha completa de um cliente, buscada quando a gaveta lateral abre.
 *
 * É buscada, e não mandada junto da listagem, de propósito: a ficha tem anotações, etiquetas,
 * orçamentos e projetos, e vinte e quatro delas por página encheriam a carga com o que a grade nem
 * desenha. O cartão carrega só o que mostra, e o resto chega quando alguém pede.
 *
 * Hoje lê da prévia porque **o domínio não existe no banco**. Quando a tabela nascer, o corpo vira uma
 * consulta com a RLS valendo e a assinatura continua a mesma; a mesma leitura ganha um `service.ts` e um
 * Route Handler em `api/v1` para o aplicativo, no contrato que `organizations` já segue.
 */
export async function loadClientAction(id: string): Promise<Client | null> {
  return previewClients.find((client) => client.id === id) ?? null;
}

/**
 * Salva a ficha, criando ou editando: é o mesmo formulário e a mesma regra. A entrada é validada aqui
 * com zod mesmo já validada na tela, porque é assim que toda entrada de usuário chega ao servidor.
 *
 * Hoje só valida e devolve: **o domínio não existe no banco**. Quando a tabela nascer, a gravação vai
 * para `service.ts`, com a RLS valendo, exposta por esta action e por um Route Handler em `api/v1`.
 */
export async function saveClientAction(input: unknown): Promise<ClientSaveResult> {
  const parsed = clientFormSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue?.path[0];
    return { ok: false, error: issue?.message ?? INVALID, field: typeof field === "string" ? field : undefined };
  }

  return { ok: true, id: parsed.data.id ?? `novo-${Date.now().toString(36)}` };
}

/**
 * Exclui os clientes marcados, de uma vez. Mesma história: valida e devolve a contagem, e a gravação
 * entra com a tabela.
 */
export async function deleteClientsAction(input: unknown): Promise<ClientDeleteResult> {
  const parsed = clientIdsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: INVALID };

  return { ok: true, deleted: parsed.data.length };
}
