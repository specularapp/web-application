import { differenceInCalendarDays, parseISO } from "date-fns";
import { z } from "zod";
import { slugify } from "@/lib/utils/slug";
import { isStale } from "./labels";
import type { CrmStageOverrides } from "./board-cookie";
import { defaultCrmQuery, horizonValues, sortCrmColumn, temperatureFilterValues, type CrmBoardData, type CrmQuery } from "./list-options";
import { crmStageValues, type CrmStage } from "./stages";
import type { Opportunity } from "./summary";

/**
 * A regra da listagem do funil: ler o que a URL pede, filtrar e agrupar por etapa. Roda no servidor, porque
 * parâmetro de URL é entrada de usuário e a lista virá do banco. Recebe as oportunidades de fora e não sabe
 * de onde vêm, então trocar a prévia pela consulta não mexe em nada daqui.
 */

/* O nome do cookie das etapas e a escrita dele moram em `board-cookie.ts`, que não carrega zod. */
export { CRM_STAGES_COOKIE, type CrmStageOverrides } from "./board-cookie";

/* Filtro de liga e desliga na URL: presente com "1" liga, qualquer outra coisa ou ausente desliga. */
const flag = z
  .string()
  .optional()
  .transform((value) => value === "1")
  .catch(false);

const querySchema = z.object({
  search: z.string().trim().max(80).catch(""),
  temperature: z.enum(temperatureFilterValues).catch(defaultCrmQuery.temperature),
  horizon: z.enum(horizonValues).catch(defaultCrmQuery.horizon),
  stale: flag,
});

export function parseCrmQuery(params: Record<string, string | undefined>): CrmQuery {
  return querySchema.parse({
    search: params.busca ?? "",
    temperature: params.temperatura,
    horizon: params.previsao,
    stale: params.paradas,
  });
}

/**
 * Lê o cookie do que a pessoa decidiu em cada etapa, porque cookie é entrada de usuário: entrada que não é
 * `etapa:0` ou `etapa:1` cai fora, e etapa repetida vale a última.
 */
export function parseCrmStageOverrides(raw: string | undefined): CrmStageOverrides {
  const listed = z
    .string()
    .transform((value) => value.split(","))
    .catch([] as string[])
    .parse(raw);

  const overrides: CrmStageOverrides = {};
  for (const entry of listed) {
    const [stage, on] = entry.split(":");
    if (!crmStageValues.includes(stage as CrmStage) || (on !== "0" && on !== "1")) continue;
    overrides[stage as CrmStage] = on === "1";
  }
  return overrides;
}

/* A busca compara pelo mesmo formato dos dois lados, então acento e maiúscula não atrapalham. Ela varre o
   que identifica uma venda: o nome dela, a descrição, o identificador, o cliente e a empresa dele, o funil,
   as etiquetas e quem está envolvido, porque procurar pelo nome do cliente é o jeito mais comum de achar. */
function matches(opportunity: Opportunity, search: string) {
  if (!search) return true;
  const needle = slugify(search, 80);
  const haystack = [
    opportunity.title,
    opportunity.description,
    opportunity.reference,
    opportunity.client.name,
    opportunity.client.company ?? "",
    opportunity.funnel?.name ?? "",
    ...opportunity.tags,
    opportunity.owner.name,
    ...opportunity.people.map((person) => person.name),
  ];
  return haystack.some((entry) => slugify(entry, 200).includes(needle));
}

function withinHorizon(opportunity: Opportunity, horizon: CrmQuery["horizon"]) {
  if (horizon === "sempre") return true;
  /* Passado conta como dentro da janela: a previsão vencida é a que mais pede decisão, e escondê-la num
     filtro de janela curta seria o contrário do que a pessoa pediu ao apertar a janela. */
  return differenceInCalendarDays(parseISO(opportunity.expectedAt), new Date()) <= Number(horizon);
}

/**
 * Filtra e distribui as oportunidades nas colunas que o quadro pediu, na ordem em que elas vêm. **As etapas
 * chegam de fora**: o quadro de um funil recebe as dele, e o de todas recebe as que estão em uso, porque
 * cruza funis com caminhos diferentes. Etapa sem oportunidade nenhuma continua no quadro: coluna é lugar, e
 * não conteúdo.
 */
export function buildCrmBoard(opportunities: Opportunity[], query: CrmQuery, stages: CrmStage[]): CrmBoardData {
  const filtered = opportunities.filter(
    (opportunity) =>
      matches(opportunity, query.search) &&
      withinHorizon(opportunity, query.horizon) &&
      (query.temperature === "todas" || opportunity.temperature === query.temperature) &&
      (!query.stale || isStale(opportunity)),
  );

  return {
    columns: stages.map((stage) => ({
      stage,
      opportunities: sortCrmColumn(filtered.filter((opportunity) => opportunity.stage === stage)),
    })),
    matched: filtered.length,
    total: opportunities.length,
  };
}
