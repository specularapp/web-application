/**
 * As tarefas para o aplicativo. Mesma regra da web, pelo mesmo `service.ts`: aqui só muda a casca, que
 * autentica por Bearer em vez de sessão em cookie. A RLS continua decidindo o acesso, porque o cliente
 * carrega o JWT de quem pediu.
 */
import { parseTasksQuery } from "@/features/tasks/list";
import { taskFormSchema } from "@/features/tasks/schemas";
import { listTasks, saveTask } from "@/features/tasks/service";
import { authorizeDomain, fromMutation, readPayload } from "@/lib/api/domain";

export async function GET(request: Request) {
  const auth = await authorizeDomain(request, "tasks-read");
  if ("response" in auth) return auth.response;

  const params = new URL(request.url).searchParams;
  const tasks = await listTasks(auth.session.supabase, auth.session.organizationId, parseTasksQuery(Object.fromEntries(params)));
  return Response.json({ tasks });
}

export async function POST(request: Request) {
  const auth = await authorizeDomain(request, "tasks-write");
  if ("response" in auth) return auth.response;

  const body = await readPayload(request, taskFormSchema);
  if ("response" in body) return body.response;

  return fromMutation(await saveTask(auth.session.supabase, auth.session.organizationId, body.data), auth.session.organizationId, ["tasks"]);
}
