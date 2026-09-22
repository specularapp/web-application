"use client";

import { callAction } from "@/lib/action";
import { imageForUpload, SOURCE_MAX_BYTES } from "@/lib/images/compress";
import { STORED_CACHE_CONTROL } from "@/lib/images/stored";
import { createTaskImageUploadAction } from "./actions";

const BUCKET = "task-images";
const MAX_BYTES = 5 * 1024 * 1024;

export type TaskImageResult = { ok: true; url: string } | { ok: false; error: string };

/**
 * A imagem que entra no meio da descrição de uma tarefa (2026-09-22). Mesma receita das outras subidas da
 * casa: o navegador reduz e converte para WebP, o servidor assina o endereço e o arquivo vai direto para o
 * Storage, sem passar pela Server Action.
 *
 * A diferença é o que acontece depois: aqui não há coluna para gravar o endereço, porque ele mora **dentro
 * do documento**, num nó de imagem. Por isso a ação já devolve o endereço público junto do endereço
 * assinado: ele é derivado do caminho, que é conhecido antes de o arquivo subir.
 */
export async function uploadTaskImage(taskId: string, file: File): Promise<TaskImageResult> {
  if (file.size > SOURCE_MAX_BYTES) {
    return { ok: false, error: `A imagem passa de ${Math.round(SOURCE_MAX_BYTES / (1024 * 1024))} MB.` };
  }

  const ready = await imageForUpload(file, "photo");
  if (ready.size > MAX_BYTES) return { ok: false, error: "A imagem passa de 5 MB. Escolha uma menor." };

  const prepared = await callAction(createTaskImageUploadAction({ taskId, contentType: ready.type }));
  if (!prepared.ok) return prepared;

  const { createClient } = await import("@/lib/supabase/client");
  const supabase = createClient();
  const { error } = await supabase.storage
    .from(BUCKET)
    .uploadToSignedUrl(prepared.path, prepared.token, ready, { contentType: ready.type, cacheControl: STORED_CACHE_CONTROL });

  if (error) return { ok: false, error: "Não foi possível enviar a imagem. Tente de novo em instantes." };

  return { ok: true, url: prepared.url };
}
