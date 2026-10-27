import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { approvalStatuses } from "@/features/approvals/labels";
import { listApprovals } from "@/features/approvals/service";
import { listAutomations as filterAutomations, parseAutomationsQuery } from "@/features/automations/list";
import { automationStatuses } from "@/features/automations/labels";
import { listAutomations } from "@/features/automations/service";
import { kindLabels, unitLabels } from "@/features/catalog/list-options";
import { parseCatalogQuery } from "@/features/catalog/list";
import { listCatalog } from "@/features/catalog/service";
import { parseClientsQuery } from "@/features/clients/list";
import { listClients } from "@/features/clients/service";
import { contractStatuses } from "@/features/contracts/labels";
import { parseContractsQuery } from "@/features/contracts/list";
import { listContracts } from "@/features/contracts/service";
import { opportunityMatches, parseCrmQuery } from "@/features/crm/list";
import { listOpportunities } from "@/features/crm/service";
import { chargeStatuses } from "@/features/finance/labels";
import { listCharges as filterCharges, parseChargesQuery } from "@/features/finance/list";
import { listCharges } from "@/features/finance/service";
import { chargeStatusOf, type ChargeDirection } from "@/features/finance/summary";
import { formStatusLabels } from "@/features/forms/labels";
import { listIntakeForms } from "@/features/forms/service";
import { listTeamMembers } from "@/features/organizations/service";
import { projectStatuses } from "@/features/projects/labels";
import { parseProjectsQuery } from "@/features/projects/list";
import { listProjects } from "@/features/projects/service";
import { quoteStatuses } from "@/features/quotes/labels";
import { parseQuotesQuery } from "@/features/quotes/list";
import { listQuotes } from "@/features/quotes/service";
import { quoteTotals } from "@/features/quotes/totals";
import { statusLabels, statusOf } from "@/features/tasks/labels";
import { parseTasksQuery } from "@/features/tasks/list";
import { searchTerms, taskMatches } from "@/features/tasks/search";
import { listTasks } from "@/features/tasks/service";
import { cacheKey, cacheTtl, cached } from "@/lib/cache";
import { cacheTags, type DomainTag } from "@/lib/cache/tags";
import { formatMoney } from "@/lib/utils/format";
import { slugify } from "@/lib/utils/slug";
import type { Database } from "@/types/database";
import { searchGroupKeys, searchGroupLabels, type SearchGroup, type SearchGroupKey, type SearchHit } from "./summary";

/**
 * A busca da casa: o termo passa pela busca que cada quadro já faz, e não por uma consulta paralela, então o
 * que a paleta acha é o mesmo que o quadro mostra quando a pessoa clica em "Ver todos".
 *
 * Onde o quadro busca no banco (clientes, orçamentos, contratos, projetos e catálogo), a paleta pede a mesma
 * listagem com uma página curta, e o total é o do filtro. Onde o quadro filtra depois de ler a base (funil,
 * cobranças, tarefas, automações, formulários e aprovações), a leitura fica guardada por trinta segundos sob a
 * tag do domínio, porque a pessoa digita várias letras seguidas e cada uma refaria a base inteira.
 *
 * Recebe o cliente do Supabase de quem pediu: a RLS decide o que cada um vê.
 */
export type SearchClient = SupabaseClient<Database>;

/** Quantos de cada grupo voltam: o bastante para escolher sem rolar, e o resto fica no "Ver todos". */
const PER_GROUP = 5;

type Found = { total: number; hits: SearchHit[] };

const join = (...parts: (string | null | undefined)[]) => parts.filter((part) => part && part.trim()).join(", ");
const withSearch = (path: string, term: string, extra = "") => `${path}?${extra}busca=${encodeURIComponent(term)}`;
const cut = <T>(items: T[], map: (item: T) => SearchHit): Found => ({ total: items.length, hits: items.slice(0, PER_GROUP).map(map) });

/* Acento, caixa e pontuação fora dos dois lados, a mesma régua da busca do funil. */
const contains = (haystack: (string | null | undefined)[], term: string) => {
  const needle = slugify(term, 80);
  return haystack.some((entry) => Boolean(entry) && slugify(entry ?? "", 400).includes(needle));
};

export async function searchEverything(client: SearchClient, organizationId: string, term: string): Promise<SearchGroup[]> {
  const page = { busca: term, porPagina: String(PER_GROUP) };

  const remembered = <T>(name: string, tags: DomainTag[], load: () => Promise<T>) =>
    cached(cacheKey(organizationId, "search", name), { organizationId, tags, ttl: cacheTtl.list }, load);

  const charges = (direction: ChargeDirection) => async (): Promise<Found> => {
    const items = await remembered("charges", [cacheTags.finance], () => listCharges(client, organizationId));
    const found = filterCharges(items, parseChargesQuery({ ...page, lado: direction }));
    return {
      total: found.total,
      hits: found.items.map((charge) => ({
        id: charge.id,
        title: charge.title,
        detail: join(charge.reference, charge.client?.name, formatMoney(charge.amount)),
        href: `/${direction === "incoming" ? "cobrancas" : "despesas"}/${charge.id}`,
        status: chargeStatuses[chargeStatusOf(charge)],
      })),
    };
  };

  const clients = (group: "clientes" | "fornecedores") => async (): Promise<Found> => {
    const found = await listClients(client, organizationId, parseClientsQuery({ ...page, grupo: group }));
    return {
      total: found.total,
      hits: found.items.map((entry) => ({
        id: entry.id,
        title: entry.name,
        detail: join(entry.reference, entry.company, entry.email, entry.city),
        href: `/${group}/${entry.id}`,
        status: entry.active ? undefined : { label: "Inativo", tone: "neutral" },
      })),
    };
  };

  const specs: Record<SearchGroupKey, { run: () => Promise<Found>; all: string | null }> = {
    clients: { run: clients("clientes"), all: withSearch("/clientes", term) },
    suppliers: { run: clients("fornecedores"), all: withSearch("/fornecedores", term) },
    opportunities: {
      run: async () => {
        const items = await remembered("opportunities", [cacheTags.crm], () => listOpportunities(client, organizationId, parseCrmQuery({})));
        return cut(
          items.filter((opportunity) => opportunityMatches(opportunity, term)),
          (opportunity) => ({
            id: opportunity.id,
            title: opportunity.title,
            detail: join(opportunity.reference, opportunity.client.name, opportunity.funnel?.name, formatMoney(opportunity.value)),
            /* O funil não abre uma oportunidade pelo endereço: o identificador na busca deixa só ela no quadro. */
            href: withSearch("/crm", opportunity.reference),
            status: { label: opportunity.stageLabel ?? opportunity.stage, tone: "neutral" },
          }),
        );
      },
      all: withSearch("/crm", term),
    },
    quotes: {
      run: async () => {
        const found = await listQuotes(client, organizationId, parseQuotesQuery(page));
        return {
          total: found.total,
          hits: found.items.map((quote) => ({
            id: quote.id,
            title: quote.title,
            detail: join(quote.number, quote.client.name, formatMoney(quoteTotals(quote).total)),
            href: `/orcamentos/${quote.id}`,
            status: quoteStatuses[quote.status],
          })),
        };
      },
      all: withSearch("/orcamentos", term),
    },
    contracts: {
      run: async () => {
        const found = await listContracts(client, organizationId, parseContractsQuery(page));
        return {
          total: found.total,
          hits: found.items.map((contract) => ({
            id: contract.id,
            title: contract.title,
            detail: join(contract.reference, contract.client?.name, contract.amount === null ? null : formatMoney(contract.amount)),
            href: `/contratos/${contract.id}`,
            status: contractStatuses[contract.status],
          })),
        };
      },
      all: withSearch("/contratos", term),
    },
    charges: { run: charges("incoming"), all: withSearch("/cobrancas", term) },
    expenses: { run: charges("outgoing"), all: withSearch("/despesas", term) },
    projects: {
      run: async () => {
        const found = await listProjects(client, organizationId, parseProjectsQuery(page));
        return {
          total: found.total,
          hits: found.items.map((project) => ({
            id: project.id,
            title: project.name,
            detail: join(project.reference, project.client?.name, project.description),
            href: `/projetos/${project.id}`,
            status: projectStatuses[project.status],
          })),
        };
      },
      all: withSearch("/projetos", term),
    },
    tasks: {
      run: async () => {
        const items = await remembered("tasks", [cacheTags.tasks], () => listTasks(client, organizationId, parseTasksQuery({})));
        const terms = searchTerms(term);
        return cut(
          items.filter((task) => taskMatches(task, terms)),
          (task) => ({
            id: task.id,
            title: task.title,
            detail: join(task.reference, task.project?.name, task.owner.name),
            href: `/tarefas?tarefa=${encodeURIComponent(task.reference)}`,
            status: { label: statusLabels[statusOf(task)], tone: statusOf(task) === "done" ? "success" : statusOf(task) === "ongoing" ? "info" : "neutral" },
          }),
        );
      },
      all: withSearch("/tarefas", term),
    },
    catalog: {
      run: async () => {
        const found = await listCatalog(client, organizationId, parseCatalogQuery(page));
        return {
          total: found.total,
          hits: found.items.map((item) => ({
            id: item.id,
            title: item.name,
            detail: join(item.reference, item.category, `${formatMoney(item.price)} ${unitLabels[item.unit]}`),
            href: `/catalogo/${item.id}`,
            status: item.active ? { label: kindLabels[item.kind], tone: "neutral" } : { label: "Inativo", tone: "neutral" },
          })),
        };
      },
      all: withSearch("/catalogo", term),
    },
    forms: {
      run: async () => {
        const items = await remembered("forms", [cacheTags.forms], () => listIntakeForms(client, organizationId));
        return cut(
          items.filter((form) => contains([form.title, form.reference, form.project.name, form.client?.name], term)),
          (form) => ({
            id: form.id,
            title: form.title,
            detail: join(form.reference, form.project.name, `${form.responseCount} ${form.responseCount === 1 ? "resposta" : "respostas"}`),
            href: `/formularios/${form.id}`,
            status: { label: formStatusLabels[form.status], tone: form.status === "published" ? "success" : "neutral" },
          }),
        );
      },
      all: null,
    },
    approvals: {
      run: async () => {
        const items = await remembered("approvals", [cacheTags.approvals], () => listApprovals(client, organizationId));
        return cut(
          items.filter((approval) => contains([approval.title, approval.reference, approval.project.name, approval.task?.title], term)),
          (approval) => ({
            id: approval.id,
            title: approval.title,
            detail: join(approval.reference, approval.project.name),
            href: `/aprovacoes/${approval.id}`,
            status: approvalStatuses[approval.status],
          }),
        );
      },
      all: null,
    },
    automations: {
      run: async () => {
        const items = await remembered("automations", [cacheTags.automations], () => listAutomations(client, organizationId));
        const found = filterAutomations(items, parseAutomationsQuery({ busca: term }));
        return cut(found.items, (automation) => ({
          id: automation.id,
          title: automation.name,
          detail: automation.description,
          href: `/automacoes/${automation.id}`,
          status: automationStatuses[automation.status],
        }));
      },
      all: withSearch("/automacoes", term),
    },
    team: {
      run: async () => {
        const members = await remembered("team", [cacheTags.organization], () => listTeamMembers(client, organizationId));
        return cut(
          members.filter((member) => contains([member.name, member.email], term)),
          (member) => ({
            id: member.userId,
            title: member.name || member.email || "Equipe",
            detail: member.name ? (member.email ?? "") : "",
            href: "/configuracoes/equipe",
          }),
        );
      },
      all: null,
    },
  };

  /* Um grupo que falha fica de fora sem derrubar os outros: a busca não quebra por causa de um domínio. Só
     quando todos falham é que a falha sobe, porque aí o vazio mentiria que não existe nada. */
  const settled = await Promise.allSettled(searchGroupKeys.map((key) => specs[key].run()));
  settled.forEach((result, index) => {
    if (result.status === "rejected") console.error("busca: grupo falhou", searchGroupKeys[index], result.reason);
  });
  if (settled.every((result) => result.status === "rejected")) throw new Error("Não foi possível buscar agora. Tente de novo em instantes.");

  return searchGroupKeys.flatMap((key, index) => {
    const result = settled[index];
    if (result.status !== "fulfilled" || result.value.hits.length === 0) return [];
    const { total, hits } = result.value;
    return [{ key, label: searchGroupLabels[key], total, hits, all: total > hits.length ? specs[key].all : null }];
  });
}
