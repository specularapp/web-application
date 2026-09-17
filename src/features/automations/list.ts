import { z } from "zod";
import { nodeCatalog } from "./catalog";
import { defaultQuery, statusFilterValues, type AutomationsListPage, type AutomationsQuery } from "./list-options";
import type { Automation, AutomationStatus } from "./summary";

/**
 * A regra da listagem de automações: ler o que a URL pede, filtrar e ordenar. Roda no servidor, porque
 * parâmetro de URL é entrada de usuário e a lista virá do banco. Recebe as automações de fora e não sabe de
 * onde vêm.
 */

const querySchema = z.object({
  search: z.string().trim().max(80).catch(""),
  status: z.enum(statusFilterValues).catch(defaultQuery.status),
});

export function parseAutomationsQuery(params: Record<string, string | undefined>): AutomationsQuery {
  return querySchema.parse({ search: params.busca, status: params.situacao });
}

const statusOrder: Record<AutomationStatus, number> = { active: 0, paused: 1, draft: 2 };

/* Sem acento e sem caixa, para a busca achar "cobranca" em "Cobrança". */
const plain = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("pt-BR");

/* A busca olha o nome, a descrição e o nome dos passos, sem acento e sem caixa: "email atraso" acha a
   cobrança em atraso pelo passo de e-mail. */
function matches(automation: Automation, needle: string) {
  const haystack = plain([automation.name, automation.description, ...automation.nodes.map((entry) => nodeCatalog[entry.kind].label)].join(" "));
  return needle.split(/\s+/).every((part) => !part || haystack.includes(part));
}

export function listAutomations(items: Automation[], query: AutomationsQuery): AutomationsListPage {
  const counts: Record<AutomationStatus, number> = { active: 0, paused: 0, draft: 0 };
  items.forEach((automation) => {
    counts[automation.status] += 1;
  });

  const needle = plain(query.search).trim();
  const filtered = items
    .filter((automation) => query.status === "todas" || automation.status === query.status)
    .filter((automation) => !needle || matches(automation, needle))
    .sort((a, b) => statusOrder[a.status] - statusOrder[b.status] || b.updatedAt.localeCompare(a.updatedAt));

  const installed = [...new Set(items.map((automation) => automation.templateId).filter((id): id is string => Boolean(id)))];
  return { items: filtered, total: filtered.length, counts, installed };
}
