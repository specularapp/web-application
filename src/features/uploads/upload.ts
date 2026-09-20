"use client";

import { createUploadAction, attachUploadAction, clearUploadAction } from "./actions";
import { contentTypesOf, uploadMaxBytes, uploadTargets, type UploadTarget } from "./schemas";
import type { ServiceResult } from "./service";
import { callAction } from "@/lib/action";
import { imageForUpload, SOURCE_MAX_BYTES, type ImagePreset } from "@/lib/images/compress";
import { STORED_CACHE_CONTROL } from "@/lib/images/stored";

/**
 * A subida de uma imagem, do lado de quem escolheu o arquivo: o navegador reduz e converte para WebP, o
 * servidor assina o endereço, o navegador manda o arquivo direto para o Storage e o servidor grava o
 * endereço na linha.
 *
 * O cliente do Supabase entra por importação dinâmica, e não no topo do arquivo: este módulo é puxado pelos
 * formulários de cliente, item e projeto, todos alcançáveis do painel, e a biblioteca inteira viajaria em
 * toda carga para o caso de alguém escolher uma imagem. Aqui ela só chega quando há arquivo subindo, e a
 * função já era `async`, então nada mais muda. É a mesma lição da logo do time.
 */

/* Em que caixa a imagem de cada alvo precisa caber, pelo maior lugar em que ela aparece na tela. */
const presets: Record<UploadTarget, ImagePreset> = {
  "client-avatar": "avatar",
  "client-logo": "logo",
  "catalog-image": "photo",
  "project-cover": "cover",
  "project-logo": "logo",
  "charge-image": "photo",
};

export async function uploadImage(target: UploadTarget, recordId: string, file: File): Promise<ServiceResult<string>> {
  if (file.size > SOURCE_MAX_BYTES) {
    return { ok: false, error: `A imagem passa de ${Math.round(SOURCE_MAX_BYTES / (1024 * 1024))} MB.` };
  }

  /* Reduzida e em WebP antes de qualquer viagem: é o único ponto do caminho em que o byte economizado
     nunca chega a sair do aparelho. O teto do balde é conferido depois, no que vai de verdade. */
  const ready = await imageForUpload(file, presets[target]);

  const contentType = contentTypesOf(target).safeParse(ready.type);
  if (!contentType.success) return { ok: false, error: "Envie a imagem em PNG, JPG ou WEBP." };

  if (ready.size > uploadMaxBytes[target]) {
    return { ok: false, error: `A imagem passa de ${Math.round(uploadMaxBytes[target] / (1024 * 1024))} MB.` };
  }

  const prepared = await callAction(createUploadAction({ target, recordId, contentType: contentType.data }));
  if (!prepared.ok) return prepared;

  const { createClient } = await import("@/lib/supabase/client");
  const supabase = createClient();
  const { error } = await supabase.storage
    .from(uploadTargets[target].bucket)
    .uploadToSignedUrl(prepared.data.path, prepared.data.token, ready, { contentType: contentType.data, cacheControl: STORED_CACHE_CONTROL });

  if (error) return { ok: false, error: "Não foi possível enviar a imagem. Tente de novo em instantes." };

  return attachUploadAction({ target, recordId, path: prepared.data.path });
}

/** Tirar a imagem do registro e apagar o arquivo. */
export async function removeImage(target: UploadTarget, recordId: string): Promise<ServiceResult<undefined>> {
  return clearUploadAction({ target, recordId });
}
