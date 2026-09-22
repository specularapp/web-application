"use client";

import { attachAvatarAction, clearUserImageAction, createAvatarUploadAction } from "./actions";
import { avatarContentTypeSchema, type UserImageKind } from "./schemas";
import { callAction } from "@/lib/action";
import { imageForUpload, SOURCE_MAX_BYTES, type ImagePreset } from "@/lib/images/compress";
import { STORED_CACHE_CONTROL } from "@/lib/images/stored";

const AVATAR_BUCKET = "user-avatars";
const MAX_BYTES = 2 * 1024 * 1024;

/* O rosto cabe num quadrado de 512; a capa é a faixa larga do topo, na mesma caixa do banner do time. */
const presets: Record<UserImageKind, ImagePreset> = { avatar: "avatar", cover: "banner" };
const labels: Record<UserImageKind, string> = { avatar: "foto", cover: "capa" };

export type UploadResult = { ok: true; url: string } | { ok: false; error: string };

/**
 * A foto e a capa de quem entra são reduzidas e convertidas para WebP no navegador e sobem direto para o
 * Storage com o endereço assinado pelo servidor, na mesma receita da logo da equipe: o cliente do Supabase
 * só chega quando há arquivo subindo.
 */
export async function uploadAvatar(file: File, kind: UserImageKind = "avatar"): Promise<UploadResult> {
  const label = labels[kind];
  if (file.size > SOURCE_MAX_BYTES) {
    return { ok: false, error: `A ${label} passa de ${Math.round(SOURCE_MAX_BYTES / (1024 * 1024))} MB. Escolha uma menor.` };
  }

  const ready = await imageForUpload(file, presets[kind]);

  const contentType = avatarContentTypeSchema.safeParse(ready.type);
  if (!contentType.success) return { ok: false, error: `Envie a ${label} em PNG, JPG ou WEBP.` };
  if (ready.size > MAX_BYTES) return { ok: false, error: `A ${label} passa de 2 MB. Escolha uma menor.` };

  const prepared = await callAction(createAvatarUploadAction({ contentType: contentType.data, kind }));
  if (!prepared.ok) return prepared;

  const { createClient } = await import("@/lib/supabase/client");
  const supabase = createClient();
  const { error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .uploadToSignedUrl(prepared.path, prepared.token, ready, { contentType: contentType.data, cacheControl: STORED_CACHE_CONTROL });

  if (error) return { ok: false, error: `Não foi possível enviar a ${label}. Tente de novo em instantes.` };

  return callAction(attachAvatarAction({ path: prepared.path, kind }));
}

/** Tirar a foto ou a capa: limpa o perfil e apaga o arquivo. */
export async function removeUserImage(kind: UserImageKind): Promise<{ ok: true } | { ok: false; error: string }> {
  return callAction(clearUserImageAction({ kind }));
}
