/**
 * As pastas de projeto para o aplicativo. Mesma regra da web, pelo mesmo `service.ts`: aqui só muda a casca,
 * que autentica por Bearer em vez de sessão em cookie. A RLS continua decidindo o acesso.
 *
 * `GET` lista as pastas em lista rasa, já com o caminho inteiro de cada uma; `POST` cria ou renomeia;
 * `PATCH` move um projeto para uma pasta; `DELETE` apaga a pasta, e os projetos dela voltam para a raiz.
 */
import { folderIdSchema, moveProjectSchema, saveFolderSchema } from "@/features/projects/schemas";
import { deleteProjectFolder, listProjectFolders, moveProject, saveProjectFolder } from "@/features/projects/service";
import { authorizeDomain, fromMutation, readPayload } from "@/lib/api/domain";

export async function GET(request: Request) {
  const auth = await authorizeDomain(request, "projects-read");
  if ("response" in auth) return auth.response;

  return Response.json(await listProjectFolders(auth.session.supabase, auth.session.organizationId));
}

export async function POST(request: Request) {
  const auth = await authorizeDomain(request, "projects-write");
  if ("response" in auth) return auth.response;

  const body = await readPayload(request, saveFolderSchema);
  if ("response" in body) return body.response;

  return fromMutation(await saveProjectFolder(auth.session.supabase, auth.session.organizationId, body.data), auth.session.organizationId, ["projects"]);
}

export async function PATCH(request: Request) {
  const auth = await authorizeDomain(request, "projects-write");
  if ("response" in auth) return auth.response;

  const body = await readPayload(request, moveProjectSchema);
  if ("response" in body) return body.response;

  return fromMutation(await moveProject(auth.session.supabase, auth.session.organizationId, body.data), auth.session.organizationId, ["projects"]);
}

export async function DELETE(request: Request) {
  const auth = await authorizeDomain(request, "projects-write");
  if ("response" in auth) return auth.response;

  const body = await readPayload(request, folderIdSchema);
  if ("response" in body) return body.response;

  return fromMutation(await deleteProjectFolder(auth.session.supabase, auth.session.organizationId, body.data), auth.session.organizationId, ["projects"]);
}
