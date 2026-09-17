import "server-only";
import { requireOrganization } from "@/features/organizations/context";
import { getTask, getTasksSummary } from "./service";
import type { Task, TasksSummary } from "./summary";

/**
 * A ficha de uma tarefa e o bloco do painel. Separados de `queries.ts` porque lá mora o que o quadro
 * inteiro precisa, com a árvore e o índice da casa junto, e aqui só a tarefa.
 */
export async function getTaskById(id: string, next = "/tarefas"): Promise<Task | null> {
  const { supabase, organizationId } = await requireOrganization(next);
  return getTask(supabase, organizationId, id);
}

export async function getTasksBlock(next = "/dashboard"): Promise<TasksSummary> {
  const { supabase, organizationId } = await requireOrganization(next);
  return getTasksSummary(supabase, organizationId);
}
