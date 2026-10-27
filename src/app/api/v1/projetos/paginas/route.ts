/**
 * As páginas avulsas de Tarefas para o aplicativo, pelo mesmo `service.ts` da web: a casca autentica por Bearer
 * e a RLS continua decidindo o acesso.
 *
 * `GET` lista os projetos que podem receber uma página; `POST` cria ou renomeia a página; `PATCH` atrela a
 * página a um projeto, que recebe as tarefas dela.
 */
import { attachBoardSchema, saveBoardSchema } from "@/features/projects/schemas";
import { attachTaskBoard, listBoardTargets, saveTaskBoard } from "@/features/projects/service";
import { authorizeDomain, fromMutation, readPayload } from "@/lib/api/domain";

export async function GET(request: Request) {
  const auth = await authorizeDomain(request, "projects-read");
  if ("response" in auth) return auth.response;

  return Response.json(await listBoardTargets(auth.session.supabase, auth.session.organizationId));
}

export async function POST(request: Request) {
  const auth = await authorizeDomain(request, "projects-write");
  if ("response" in auth) return auth.response;

  const body = await readPayload(request, saveBoardSchema);
  if ("response" in body) return body.response;

  return fromMutation(await saveTaskBoard(auth.session.supabase, auth.session.organizationId, body.data), auth.session.organizationId, ["projects"]);
}

export async function PATCH(request: Request) {
  const auth = await authorizeDomain(request, "projects-write");
  if ("response" in auth) return auth.response;

  const body = await readPayload(request, attachBoardSchema);
  if ("response" in body) return body.response;

  return fromMutation(await attachTaskBoard(auth.session.supabase, body.data), auth.session.organizationId, ["projects"]);
}
