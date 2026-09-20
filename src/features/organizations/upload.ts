"use client";

import { attachImageAction, createImageUploadAction } from "./actions";
import { LOGO_BUCKET, LOGO_MAX_BYTES, logoContentTypeSchema, type ImageKind } from "./schemas";
import type { ServiceResult } from "./service";
import { callAction } from "@/lib/action";
import { imageForUpload, SOURCE_MAX_BYTES } from "@/lib/images/compress";
import { STORED_CACHE_CONTROL } from "@/lib/images/stored";

// O arquivo é reduzido e convertido para WebP no navegador e sobe direto para o Storage com URL assinada
// pelo servidor: passar a imagem por dentro da Server Action esbarraria no limite de corpo da requisição e
// ainda ocuparia o processo.
//
// O cliente do Supabase entra por importação dinâmica, e não no topo do arquivo (varredura de peso de
// 2026-09-08): este módulo é puxado pela gaveta de criar equipe e pela configuração inicial, as duas
// alcançáveis do painel, então a biblioteca inteira, 138 KB comprimidos, viajava em toda carga do painel
// para o caso de alguém escolher uma imagem. Aqui dentro ela só chega quando há arquivo de verdade
// subindo, e a função já era `async`, então nada mais muda.
export async function uploadTeamImage(
  organizationId: string,
  file: File,
  kind: ImageKind,
): Promise<ServiceResult<string>> {
  if (file.size > SOURCE_MAX_BYTES) {
    return { ok: false, error: `A imagem passa de ${Math.round(SOURCE_MAX_BYTES / (1024 * 1024))} MB` };
  }

  /* A logo cabe num quadrado de 512 e o banner numa faixa larga: cada um na caixa do lugar em que aparece. */
  const ready = await imageForUpload(file, kind === "banner" ? "banner" : "logo");

  const contentType = logoContentTypeSchema.safeParse(ready.type);
  if (!contentType.success) return { ok: false, error: "Envie a imagem em PNG, JPG ou WEBP" };

  if (ready.size > LOGO_MAX_BYTES) return { ok: false, error: "A imagem passa de 2 MB" };

  const prepared = await callAction(createImageUploadAction({ organizationId, contentType: contentType.data, kind }));
  if (!prepared.ok) return prepared;

  const { createClient } = await import("@/lib/supabase/client");
  const supabase = createClient();
  const { error } = await supabase.storage
    .from(LOGO_BUCKET)
    .uploadToSignedUrl(prepared.data.path, prepared.data.token, ready, { contentType: contentType.data, cacheControl: STORED_CACHE_CONTROL });

  if (error) return { ok: false, error: "Não foi possível enviar a imagem. Tente de novo em instantes." };

  return attachImageAction({ organizationId, path: prepared.data.path, kind });
}
