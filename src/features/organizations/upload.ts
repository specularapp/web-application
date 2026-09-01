"use client";

import { createClient } from "@/lib/supabase/client";
import { attachLogoAction, createLogoUploadAction } from "./actions";
import { LOGO_BUCKET, logoContentTypeSchema } from "./schemas";
import type { ServiceResult } from "./service";

// O arquivo sobe direto para o Storage com URL assinada pelo servidor: passar a imagem por dentro
// da Server Action esbarraria no limite de corpo da requisição e ainda ocuparia o processo.
export async function uploadLogo(organizationId: string, file: File): Promise<ServiceResult<string>> {
  const contentType = logoContentTypeSchema.safeParse(file.type);
  if (!contentType.success) return { ok: false, error: "Envie a logo em PNG, JPG ou WEBP" };

  const prepared = await createLogoUploadAction({ organizationId, contentType: contentType.data });
  if (!prepared.ok) return prepared;

  const supabase = createClient();
  const { error } = await supabase.storage
    .from(LOGO_BUCKET)
    .uploadToSignedUrl(prepared.data.path, prepared.data.token, file, { contentType: contentType.data });

  if (error) return { ok: false, error: "Não foi possível enviar a logo. Tente de novo em instantes." };

  return attachLogoAction({ organizationId, path: prepared.data.path });
}
