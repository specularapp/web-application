"use server";

import { z } from "zod";
import { planAllows } from "@/features/billing/service";
import { guardAction } from "@/features/organizations/context";
import { listHistory, type HistoryEntry } from "./history";
import { getClientRelations, type RelationMap } from "./relations";

/**
 * As duas leituras que qualquer ficha faz por cima do registro: o que mudou nele e o que se liga a ele.
 *
 * Ficam num domínio próprio, e não em cada um, porque a pergunta é a mesma no cliente, no item de catálogo,
 * no projeto e na automação, e a quinta cópia da mesma ação divergiria da primeira. Nenhuma delas escreve:
 * são as duas janelas do leque, buscadas quando a janela abre, e não junto da listagem.
 */
const historySchema = z.object({
  recordType: z.enum(["client", "catalog", "project", "task", "quote", "contract", "charge", "opportunity", "automation"]),
  recordId: z.uuid(),
});

const relationSchema = z.object({ clientId: z.uuid() });

/** O histórico de um registro, do mais novo para o mais velho. Nulo quando não há acesso. */
export async function loadHistoryAction(input: unknown): Promise<HistoryEntry[] | null> {
  const guard = await guardAction("record-history");
  if (!guard.ok) return null;

  const parsed = historySchema.safeParse(input);
  if (!parsed.success) return null;

  return listHistory(guard.context.supabase, guard.context.organizationId, parsed.data.recordType, parsed.data.recordId);
}

/**
 * O que a janela do mapa recebe. O plano aparece no resultado, e não como um mapa vazio, porque vazio e
 * bloqueado são coisas diferentes: dizer "nada ligado" a quem não pode ver seria mentira da tela.
 */
export type RelationLoad = { ok: true; map: RelationMap | null } | { ok: false; reason: "plan" | "denied" };

/**
 * O mapa de relação de um cliente: o que saiu dele e o que se pendura no que saiu.
 *
 * O plano é conferido **aqui**, e não só no leque: o leque é desenho, e desenho se contorna. Esta é a única
 * leitura da casa que cruza cinco domínios de uma vez, então é ela mesma que o plano libera.
 */
export async function loadClientRelationsAction(input: unknown): Promise<RelationLoad> {
  const guard = await guardAction("record-relations");
  if (!guard.ok) return { ok: false, reason: "denied" };

  const parsed = relationSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "denied" };

  const { supabase, organizationId } = guard.context;
  if (!(await planAllows(supabase, organizationId, "relation_map"))) return { ok: false, reason: "plan" };

  return { ok: true, map: await getClientRelations(supabase, organizationId, parsed.data.clientId) };
}
