/**
 * Uma tarefa: ler, mover de coluna e apagar para o aplicativo. Mesma regra da web, pelo mesmo `service.ts`: aqui só muda a casca, que
 * autentica por Bearer em vez de sessão em cookie. A RLS continua decidindo o acesso, porque o cliente
 * carrega o JWT de quem pediu.
 */
import { taskMoveSchema } from "@/features/tasks/schemas";
import { deleteTask, getTask, moveTask } from "@/features/tasks/service";
import { authorizeDomain, fromResult, readPayload } from "@/lib/api/domain";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeDomain(request, "task-read");
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const task = await getTask(auth.session.supabase, auth.session.organizationId, id);
  if (!task) return Response.json({ error: "Tarefa não encontrada" }, { status: 404 });

  return Response.json(task);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeDomain(request, "task-move");
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const body = await readPayload(request, taskMoveSchema);
  if ("response" in body) return body.response;
  if (body.data.id !== id) return Response.json({ error: "Tarefa divergente" }, { status: 400 });

  return fromResult(await moveTask(auth.session.supabase, auth.session.organizationId, id, body.data.stage, body.data.position));
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeDomain(request, "task-delete");
  if ("response" in auth) return auth.response;

  const { id } = await params;
  return fromResult(await deleteTask(auth.session.supabase, auth.session.organizationId, id));
}
