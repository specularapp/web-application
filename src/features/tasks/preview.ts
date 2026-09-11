import { previewTasks } from "./list-preview";
import { statusOf } from "./labels";
import type { TasksSummary } from "./summary";

/**
 * Resumo de exemplo do bloco do painel enquanto o domínio não existe no banco. Quem montar a tabela troca só
 * a origem: o bloco recebe o resumo por prop e não sabe de onde ele vem.
 *
 * Sai da mesma base do quadro (`list-preview.ts`, 2026-09-10), e não de uma lista escrita à parte: as duas
 * telas falam das mesmas tarefas, e uma mudança na prévia aparece nas duas. O bloco se chama "Tarefas
 * pendentes", então o que já fechou não entra, e a ordem é a do vencimento, da mais urgente para a mais
 * distante, que é o que o bloco promete mostrar.
 */
export const previewTasksSummary: TasksSummary = {
  tasks: previewTasks
    .filter((task) => statusOf(task) !== "done")
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
};
