"use client";

import { createClient } from "@/lib/supabase/client";
import { callAction } from "@/lib/action";
import { attachApprovalAssetAction, prepareApprovalAssetAction, publishApprovalVersionAction } from "./actions";

const allowed = ["image/png", "image/jpeg", "image/webp", "image/avif"] as const;
const MAX_BYTES = 10 * 1024 * 1024;

export async function uploadApprovalImages(versionId: string, files: File[]) {
  if (files.length === 0) return { ok: false as const, error: "Escolha ao menos uma imagem." };
  if (files.length > 12) return { ok: false as const, error: "Envie até 12 imagens por versão." };
  const supabase = createClient();
  for (const [position, file] of files.entries()) {
    if (!allowed.includes(file.type as (typeof allowed)[number])) return { ok: false as const, error: `${file.name} não é uma imagem aceita.` };
    if (file.size > MAX_BYTES) return { ok: false as const, error: `${file.name} passa de 10 MB.` };
    const prepared = await callAction(prepareApprovalAssetAction({ versionId, contentType: file.type, name: file.name }));
    if (!prepared.ok) return prepared;
    const { error } = await supabase.storage.from("approval-files").uploadToSignedUrl(prepared.data.path, prepared.data.token, file, { contentType: file.type, cacheControl: "31536000" });
    if (error) return { ok: false as const, error: `Não foi possível enviar ${file.name}.` };
    const attached = await callAction(attachApprovalAssetAction({ versionId, path: prepared.data.path, name: file.name, position }));
    if (!attached.ok) return attached;
  }
  return callAction(publishApprovalVersionAction({ versionId }));
}
