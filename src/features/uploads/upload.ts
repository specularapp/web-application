"use client";

import { createUploadAction, attachUploadAction, clearUploadAction } from "./actions";
import { contentTypesOf, uploadMaxBytes, uploadTargets, type UploadTarget } from "./schemas";
import type { ServiceResult } from "./service";

/**
 * A subida de uma imagem, do lado de quem escolheu o arquivo: o servidor assina o endereço, o navegador
 * manda o arquivo direto para o Storage e o servidor grava o endereço na linha. Três passos, uma chamada.
 *
 * O cliente do Supabase entra por importação dinâmica, e não no topo do arquivo: este módulo é puxado pelos
 * formulários de cliente, item e projeto, todos alcançáveis do painel, e a biblioteca inteira viajaria em
 * toda carga para o caso de alguém escolher uma imagem. Aqui ela só chega quando há arquivo subindo, e a
 * função já era `async`, então nada mais muda. É a mesma lição da logo do time.
 */
export async function uploadImage(target: UploadTarget, recordId: string, file: File): Promise<ServiceResult<string>> {
  const contentType = contentTypesOf(target).safeParse(file.type);
  if (!contentType.success) return { ok: false, error: "Envie a imagem em PNG, JPG ou WEBP." };

  /* O teto é conferido antes de subir: o balde recusa sozinho, mas só depois de o arquivo inteiro viajar. */
  if (file.size > uploadMaxBytes[target]) {
    return { ok: false, error: `A imagem passa de ${Math.round(uploadMaxBytes[target] / (1024 * 1024))} MB.` };
  }

  const prepared = await createUploadAction({ target, recordId, contentType: contentType.data });
  if (!prepared.ok) return prepared;

  const { createClient } = await import("@/lib/supabase/client");
  const supabase = createClient();
  const { error } = await supabase.storage
    .from(uploadTargets[target].bucket)
    .uploadToSignedUrl(prepared.data.path, prepared.data.token, file, { contentType: contentType.data });

  if (error) return { ok: false, error: "Não foi possível enviar a imagem. Tente de novo em instantes." };

  return attachUploadAction({ target, recordId, path: prepared.data.path });
}

/** Tirar a imagem do registro e apagar o arquivo. */
export async function removeImage(target: UploadTarget, recordId: string): Promise<ServiceResult<undefined>> {
  return clearUploadAction({ target, recordId });
}
