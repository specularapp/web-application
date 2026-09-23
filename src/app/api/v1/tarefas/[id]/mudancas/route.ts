/**
 * O que muda dentro da ficha, para o aplicativo: comentário com áudio e arquivos, subtarefas, envolvidos,
 * vínculos, anexos e o envio de arquivo. Mesma regra da web, pelo mesmo `service.ts`.
 */
import { taskChangeSchema } from "@/features/tasks/schemas";
import { applyTaskChange } from "@/features/tasks/service";
import { authorizeDomain, fromMutation, fromResult, readPayload } from "@/lib/api/domain";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeDomain(request, "task-change");
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const body = await readPayload(request, taskChangeSchema);
  if ("response" in body) return body.response;

  const { supabase, organizationId, userId } = auth.session;
  const result = await applyTaskChange(supabase, organizationId, userId, id, body.data);
  return body.data.op === "upload" ? fromResult(result) : fromMutation(result, organizationId, ["tasks"]);
}
