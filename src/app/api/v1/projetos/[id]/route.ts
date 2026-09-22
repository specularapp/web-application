/**
 * A ficha de um projeto para o aplicativo. Mesma regra da web, pelo mesmo `service.ts`: aqui só muda a casca, que
 * autentica por Bearer em vez de sessão em cookie. A RLS continua decidindo o acesso, porque o cliente
 * carrega o JWT de quem pediu.
 */
import { deleteProject, getProjectDetails } from "@/features/projects/service";
import { authorizeDomain, fromMutation } from "@/lib/api/domain";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeDomain(request, "project-read");
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const project = await getProjectDetails(auth.session.supabase, auth.session.organizationId, id);
  if (!project) return Response.json({ error: "Projeto não encontrado" }, { status: 404 });

  return Response.json(project);
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeDomain(request, "project-delete");
  if ("response" in auth) return auth.response;

  const { id } = await params;
  return fromMutation(await deleteProject(auth.session.supabase, auth.session.organizationId, id), auth.session.organizationId, ["projects"]);
}
