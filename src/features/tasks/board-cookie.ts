import { cookieString } from "@/lib/cookies";
import type { TaskStage } from "./stages";

/**
 * O que a pessoa decidiu sobre cada etapa do quadro: recolhida ou aberta. Vive em cookie, como o jeito de ver
 * das outras listas, porque é preferência de interface e Web Storage é proibido, e assim o servidor já manda
 * o quadro do jeito que ela deixou, sem piscar do outro antes.
 *
 * Guarda **só o que foi decidido no clique**, e não o estado das etapas (2026-09-10, a pedido): o padrão
 * passou a ser "etapa sem tarefa nasce fechada", então uma lista de recolhidas não sabia dizer se uma coluna
 * fechada foi escolha da pessoa ou consequência de estar vazia, e abrir uma vazia não sobrevivia à recarga.
 *
 * Separado da leitura no servidor pelo mesmo motivo de `view-cookie.ts` das outras telas: a prancha é
 * componente de cliente e só precisa gravar, e importar de onde mora o zod levaria o zod para o navegador.
 */

export const TASKS_STAGES_COOKIE = "sp-tarefas-etapas";

/** O que foi decidido em cada etapa: `true` recolhida, `false` aberta, ausente é o padrão da etapa. */
export type StageOverrides = Partial<Record<TaskStage, boolean>>;

/** Grava como `etapa:1` para recolhida e `etapa:0` para aberta, separadas por vírgula. */
export function saveStageOverrides(overrides: StageOverrides) {
  const value = Object.entries(overrides)
    .map(([stage, collapsed]) => `${stage}:${collapsed ? 1 : 0}`)
    .join(",");
  document.cookie = cookieString(TASKS_STAGES_COOKIE, value);
}
