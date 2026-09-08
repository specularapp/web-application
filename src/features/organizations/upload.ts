"use client";

import { attachImageAction, createImageUploadAction } from "./actions";
import { LOGO_BUCKET, logoContentTypeSchema, type ImageKind } from "./schemas";
import type { ServiceResult } from "./service";

// O arquivo sobe direto para o Storage com URL assinada pelo servidor: passar a imagem por dentro
// da Server Action esbarraria no limite de corpo da requisição e ainda ocuparia o processo.
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
  const contentType = logoContentTypeSchema.safeParse(file.type);
  if (!contentType.success) return { ok: false, error: "Envie a imagem em PNG, JPG ou WEBP" };

  const prepared = await createImageUploadAction({ organizationId, contentType: contentType.data, kind });
  if (!prepared.ok) return prepared;

  const { createClient } = await import("@/lib/supabase/client");
  const supabase = createClient();
  const { error } = await supabase.storage
    .from(LOGO_BUCKET)
    .uploadToSignedUrl(prepared.data.path, prepared.data.token, file, { contentType: contentType.data });

  if (error) return { ok: false, error: "Não foi possível enviar a imagem. Tente de novo em instantes." };

  return attachImageAction({ organizationId, path: prepared.data.path, kind });
}
