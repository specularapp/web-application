"use client";

import { attachAvatarAction, createAvatarUploadAction } from "./actions";
import { avatarContentTypeSchema } from "./schemas";

const AVATAR_BUCKET = "user-avatars";
const MAX_BYTES = 2 * 1024 * 1024;

/**
 * A foto de quem entra sobe direto para o Storage com o endereço assinado pelo servidor, na mesma receita da
 * logo da equipe: três passos, uma chamada, e o cliente do Supabase só chega quando há arquivo subindo.
 */
export async function uploadAvatar(file: File): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const contentType = avatarContentTypeSchema.safeParse(file.type);
  if (!contentType.success) return { ok: false, error: "Envie a foto em PNG, JPG ou WEBP." };
  if (file.size > MAX_BYTES) return { ok: false, error: "A foto passa de 2 MB. Escolha uma menor." };

  const prepared = await createAvatarUploadAction({ contentType: contentType.data });
  if (!prepared.ok) return prepared;

  const { createClient } = await import("@/lib/supabase/client");
  const supabase = createClient();
  const { error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .uploadToSignedUrl(prepared.path, prepared.token, file, { contentType: contentType.data });

  if (error) return { ok: false, error: "Não foi possível enviar a foto. Tente de novo em instantes." };

  return attachAvatarAction({ path: prepared.path });
}
