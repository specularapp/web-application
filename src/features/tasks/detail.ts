import "server-only";
import { getOrganizationContext, requireOrganization } from "@/features/organizations/context";
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

/* Como os demais blocos do painel: sem time o painel ainda abre, com a configuração inicial por cima. */
export async function getTasksBlock(): Promise<TasksSummary> {
  const context = await getOrganizationContext();
  if (!context) return { tasks: [] };
  return getTasksSummary(context.supabase, context.organizationId);
}
