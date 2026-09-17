/**
 * A subida de imagem para o aplicativo. Mesma regra da web, pelo mesmo `service.ts`: aqui só muda a casca,
 * que autentica por Bearer em vez de sessão em cookie. A RLS continua decidindo o acesso, porque o cliente
 * carrega o JWT de quem pediu.
 *
 * O arquivo não passa por aqui, como não passa pela Server Action: o `POST` devolve o endereço assinado, o
 * aplicativo manda os bytes direto para o Storage e o `PATCH` grava o endereço na linha. O `DELETE` tira a
 * imagem do registro e apaga o arquivo.
 */
import { attachUploadSchema, clearUploadSchema, contentTypesOf, createUploadSchema } from "@/features/uploads/schemas";
import { attachImage, clearImage, createImageUpload } from "@/features/uploads/service";
import { authorizeDomain, fromResult, readPayload } from "@/lib/api/domain";

export async function POST(request: Request) {
  const auth = await authorizeDomain(request, "image-upload");
  if ("response" in auth) return auth.response;

  const body = await readPayload(request, createUploadSchema);
  if ("response" in body) return body.response;

  if (!contentTypesOf(body.data.target).safeParse(body.data.contentType).success) {
    return Response.json({ error: "Envie a imagem em PNG, JPG ou WEBP" }, { status: 400 });
  }

  return fromResult(await createImageUpload(auth.session.supabase, { ...body.data, organizationId: auth.session.organizationId }));
}

export async function PATCH(request: Request) {
  const auth = await authorizeDomain(request, "image-attach");
  if ("response" in auth) return auth.response;

  const body = await readPayload(request, attachUploadSchema);
  if ("response" in body) return body.response;

  return fromResult(await attachImage(auth.session.supabase, { ...body.data, organizationId: auth.session.organizationId }));
}

export async function DELETE(request: Request) {
  const auth = await authorizeDomain(request, "image-clear");
  if ("response" in auth) return auth.response;

  const body = await readPayload(request, clearUploadSchema);
  if ("response" in body) return body.response;

  return fromResult(await clearImage(auth.session.supabase, { ...body.data, organizationId: auth.session.organizationId }));
}
