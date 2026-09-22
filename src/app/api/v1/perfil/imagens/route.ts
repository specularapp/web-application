/**
 * A foto e a capa de quem entra, para o aplicativo. O arquivo não passa por aqui, como não passa pela
 * Server Action: o `POST` devolve o endereço assinado no balde `user-avatars`, o aplicativo manda os bytes
 * direto para o Storage e o `PATCH` grava o endereço no perfil. O `DELETE` tira a imagem e apaga o arquivo.
 */
import { avatarAttachSchema, avatarUploadSchema, userImageClearSchema } from "@/features/settings/schemas";
import { attachAvatar, clearUserImage, createAvatarUpload } from "@/features/settings/service";
import { fromResult, readPayload } from "@/lib/api/domain";
import { authorizeRequest } from "@/lib/api/v1";

export async function POST(request: Request) {
  const auth = await authorizeRequest(request, "profile-image-upload");
  if ("response" in auth) return auth.response;

  const body = await readPayload(request, avatarUploadSchema);
  if ("response" in body) return body.response;

  return fromResult(await createAvatarUpload(auth.session.supabase, auth.session.userId, body.data.contentType, body.data.kind));
}

export async function PATCH(request: Request) {
  const auth = await authorizeRequest(request, "profile-image-attach");
  if ("response" in auth) return auth.response;

  const body = await readPayload(request, avatarAttachSchema);
  if ("response" in body) return body.response;

  return fromResult(await attachAvatar(auth.session.supabase, auth.session.userId, body.data.path, body.data.kind));
}

export async function DELETE(request: Request) {
  const auth = await authorizeRequest(request, "profile-image-clear");
  if ("response" in auth) return auth.response;

  const body = await readPayload(request, userImageClearSchema);
  if ("response" in body) return body.response;

  return fromResult(await clearUserImage(auth.session.supabase, auth.session.userId, body.data.kind));
}
