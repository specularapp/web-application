import { cookieString } from "@/lib/cookies";
import type { CrmStage } from "./stages";

/**
 * O que a pessoa decidiu sobre cada etapa do funil: recolhida ou aberta. Vive em cookie, como o jeito de ver
 * das outras listas, porque é preferência de interface e Web Storage é proibido, e assim o servidor já manda
 * o quadro do jeito que ela deixou, sem piscar do outro antes.
 *
 * Guarda **só o que foi decidido no clique**, e não o estado das etapas, pelo mesmo motivo do quadro de
 * tarefas: o padrão é "etapa sem oportunidade nasce fechada", e uma lista de recolhidas não saberia dizer se
 * uma coluna fechada foi escolha da pessoa ou consequência de estar vazia.
 *
 * Cookie próprio, e não o das tarefas: são dois quadros com etapas diferentes, e um cookie só faria a escolha
 * de um mexer no outro.
 */

export const CRM_STAGES_COOKIE = "sp-funil-etapas";

/** O que foi decidido em cada etapa: `true` recolhida, `false` aberta, ausente é o padrão da etapa. */
export type CrmStageOverrides = Partial<Record<CrmStage, boolean>>;

/** Grava como `etapa:1` para recolhida e `etapa:0` para aberta, separadas por vírgula. */
export function saveCrmStageOverrides(overrides: CrmStageOverrides) {
  const value = Object.entries(overrides)
    .map(([stage, collapsed]) => `${stage}:${collapsed ? 1 : 0}`)
    .join(",");
  document.cookie = cookieString(CRM_STAGES_COOKIE, value);
}
