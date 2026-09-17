"use server";

import { firstIssue, guardAction, revalidateDomain } from "@/features/organizations/context";
import { cacheTags } from "@/lib/cache/tags";
import { clientFormSchema, clientIdsSchema } from "./schemas";
import { deleteClients, getClient, saveClient } from "./service";
import type { Client } from "./summary";

export type ClientSaveResult = { ok: true; id: string } | { ok: false; error: string; field?: string };
export type ClientDeleteResult = { ok: true; deleted: number } | { ok: false; error: string };

/**
 * A ficha completa de um cliente, buscada quando a gaveta lateral abre. É buscada, e não mandada junto da
 * listagem, porque a ficha tem anotações, etiquetas, orçamentos e projetos, e vinte e quatro delas por
 * página encheriam a carga com o que a grade nem desenha.
 */
export async function loadClientAction(id: string): Promise<Client | null> {
  const guard = await guardAction("client-load");
  if (!guard.ok) return null;

  return getClient(guard.context.supabase, guard.context.organizationId, id);
}

/**
 * Salva a ficha, criando ou editando: é o mesmo formulário e a mesma regra. A entrada é validada aqui com
 * zod mesmo já validada na tela, porque é assim que toda entrada de usuário chega ao servidor; a RLS e os
 * `check` da tabela são a terceira barreira, e a única que vale também para o aplicativo.
 */
export async function saveClientAction(input: unknown): Promise<ClientSaveResult> {
  const guard = await guardAction("client-save");
  if (!guard.ok) return { ok: false, error: guard.error };

  const parsed = clientFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) };

  const { supabase, organizationId, user } = guard.context;
  const saved = await saveClient(supabase, organizationId, user.id, parsed.data);
  if (!saved.ok) return { ok: false, error: saved.error };

  await revalidateDomain(guard.context.organizationId, [cacheTags.clients], ["/clientes"]);
  return { ok: true, id: saved.data.id };
}

/** Exclui os clientes marcados, de uma vez. */
export async function deleteClientsAction(input: unknown): Promise<ClientDeleteResult> {
  const guard = await guardAction("client-delete");
  if (!guard.ok) return { ok: false, error: guard.error };

  const parsed = clientIdsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Escolha ao menos um cliente." };

  const removed = await deleteClients(guard.context.supabase, guard.context.organizationId, parsed.data);
  if (!removed.ok) return { ok: false, error: removed.error };

  await revalidateDomain(guard.context.organizationId, [cacheTags.clients], ["/clientes"]);
  return { ok: true, deleted: removed.data.deleted };
}
