"use client";

import { callAction } from "@/lib/action";
import { STORED_CACHE_CONTROL } from "@/lib/images/stored";
import { changeTaskAction } from "./actions";
import type { TaskChangeDraft } from "./schemas";

/**
 * O lado da tela das mudanças da ficha (2026-09-22): mandar uma mudança e subir um arquivo para o balde da
 * tarefa. A tela mostra a mudança na hora e isto grava por trás; quem chama só olha o resultado para avisar
 * quando não deu.
 */

type Change = Exclude<TaskChangeDraft, { op: "upload" }>;

/**
 * As tarefas que acabaram de nascer na tela e ainda estão sendo gravadas. A ficha abre antes de o banco
 * responder, e qualquer gravação dela espera a criação terminar, senão ela tentaria mudar uma linha que ainda
 * não existe.
 */
const creating = new Map<string, Promise<unknown>>();

export function trackCreation(taskId: string, pending: Promise<unknown>) {
  creating.set(taskId, pending);
  void pending.finally(() => creating.delete(taskId));
}

export const creationOf = (taskId: string) => creating.get(taskId) ?? Promise.resolve();

export async function changeTask(taskId: string, change: Change) {
  await creationOf(taskId);
  return callAction(changeTaskAction({ taskId, change }));
}

/** O navegador pede o endereço assinado e manda o arquivo direto ao Storage, sem passar pela action. */
export async function uploadTaskFile(taskId: string, blob: Blob, name: string): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  await creationOf(taskId);
  const prepared = await callAction(changeTaskAction({ taskId, change: { op: "upload", name, contentType: blob.type } }));
  if (!prepared.ok) return prepared;
  const { path, token } = prepared.data;
  if (!path || !token) return { ok: false, error: "Não foi possível preparar o envio do arquivo." };

  const { createClient } = await import("@/lib/supabase/client");
  const { error } = await createClient()
    .storage.from("task-files")
    .uploadToSignedUrl(path, token, blob, { contentType: blob.type || "application/octet-stream", cacheControl: STORED_CACHE_CONTROL });

  return error ? { ok: false, error: "Não foi possível enviar o arquivo. Tente de novo em instantes." } : { ok: true, path };
}
