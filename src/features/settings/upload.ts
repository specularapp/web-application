"use client";

import { attachAvatarAction, createAvatarUploadAction } from "./actions";
import { avatarContentTypeSchema } from "./schemas";
import { imageForUpload, SOURCE_MAX_BYTES } from "@/lib/images/compress";
import { STORED_CACHE_CONTROL } from "@/lib/images/stored";

const AVATAR_BUCKET = "user-avatars";
const MAX_BYTES = 2 * 1024 * 1024;

/**
 * A foto de quem entra é reduzida e convertida para WebP no navegador e sobe direto para o Storage com o
 * endereço assinado pelo servidor, na mesma receita da logo da equipe: o cliente do Supabase só chega quando
 * há arquivo subindo.
 */
export async function uploadAvatar(file: File): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  if (file.size > SOURCE_MAX_BYTES) {
    return { ok: false, error: `A foto passa de ${Math.round(SOURCE_MAX_BYTES / (1024 * 1024))} MB. Escolha uma menor.` };
  }

  const ready = await imageForUpload(file, "avatar");

  const contentType = avatarContentTypeSchema.safeParse(ready.type);
  if (!contentType.success) return { ok: false, error: "Envie a foto em PNG, JPG ou WEBP." };
  if (ready.size > MAX_BYTES) return { ok: false, error: "A foto passa de 2 MB. Escolha uma menor." };

  const prepared = await createAvatarUploadAction({ contentType: contentType.data });
  if (!prepared.ok) return prepared;

  const { createClient } = await import("@/lib/supabase/client");
  const supabase = createClient();
  const { error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .uploadToSignedUrl(prepared.path, prepared.token, ready, { contentType: contentType.data, cacheControl: STORED_CACHE_CONTROL });

  if (error) return { ok: false, error: "Não foi possível enviar a foto. Tente de novo em instantes." };

  return attachAvatarAction({ path: prepared.path });
}
