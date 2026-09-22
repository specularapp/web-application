/**
 * Os projetos para o aplicativo. Mesma regra da web, pelo mesmo `service.ts`: aqui só muda a casca, que
 * autentica por Bearer em vez de sessão em cookie. A RLS continua decidindo o acesso, porque o cliente
 * carrega o JWT de quem pediu.
 */
import { parseProjectsQuery } from "@/features/projects/list";
import { projectFormSchema } from "@/features/projects/schemas";
import { listProjects, saveProject } from "@/features/projects/service";
import { authorizeDomain, fromMutation, readPayload } from "@/lib/api/domain";

export async function GET(request: Request) {
  const auth = await authorizeDomain(request, "projects-read");
  if ("response" in auth) return auth.response;

  const params = new URL(request.url).searchParams;
  const page = await listProjects(auth.session.supabase, auth.session.organizationId, parseProjectsQuery(Object.fromEntries(params)));
  return Response.json(page);
}

export async function POST(request: Request) {
  const auth = await authorizeDomain(request, "projects-write");
  if ("response" in auth) return auth.response;

  const body = await readPayload(request, projectFormSchema);
  if ("response" in body) return body.response;

  return fromMutation(await saveProject(auth.session.supabase, auth.session.organizationId, body.data), auth.session.organizationId, ["projects"]);
}
