import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import { catalogArtworkUrl, catalogHueFor, kindLabels, unitLabels } from "@/features/catalog/list-options";
import { previewCatalog } from "@/features/catalog/list-preview";
import { previewClients } from "@/features/clients/list-preview";
import { previewTeamSummary } from "@/features/organizations/preview";
import type { TeamMemberAccess } from "@/features/organizations/summary";
import { quoteStatuses } from "@/features/quotes/labels";
import { previewQuotes } from "@/features/quotes/list-preview";
import type { QuoteLine } from "@/features/quotes/summary";
import { quoteTotals } from "@/features/quotes/totals";
import { previewTasks } from "@/features/tasks/list-preview";
import { estimateLabel, priorityLabels, priorityTones, statusLabels, statusOf } from "@/features/tasks/labels";
import { taskStageMeta } from "@/features/tasks/stages";
import { applyPattern } from "@/lib/masks";
import { formatMoney } from "@/lib/utils/format";
import type { AppRecord, RecordFact } from "./records";

/* A data escrita como a casa escreve data longa. */
const shortDate = (iso: string) => format(parseISO(iso), "d 'de' MMM. 'de' yyyy", { locale: ptBR });

/* Um fato só entra quando tem o que dizer: sem isto, o resumo enchia de linhas vazias. */
const facts = (...listed: (RecordFact | null | undefined | false)[]) => listed.filter(Boolean) as RecordFact[];

const accessLabels: Record<TeamMemberAccess, string> = { owner: "Proprietário", admin: "Administrador", member: "Membro" };

/**
 * O índice de exemplo do que existe na aplicação, montado a partir das prévias de cada domínio. Quem montar
 * as tabelas troca isto por uma consulta; o formato que sai daqui é o que a busca e o vincular consomem, e
 * nenhum dos dois sabe de onde ele veio.
 *
 * É construído **no servidor** e entregue por prop, e não importado pelo componente que busca: são vinte e
 * quatro tarefas, sessenta clientes, quarenta e dois orçamentos e trinta e seis itens de catálogo, e puxar
 * tudo isso de dentro de um componente de cliente levaria as quatro prévias inteiras para o navegador só
 * para mostrar uma lista de nome e identificador.
 *
 * Contrato não entra porque o domínio ainda não tem nem prévia; o tipo existe no índice esperando por ele.
 */

const tasks: AppRecord[] = previewTasks.map((task) => ({
  key: `task-${task.id}`,
  kind: "task",
  reference: task.reference,
  name: task.title,
  caption: task.project?.name,
  href: "/tarefas",
  tags: [
    { text: taskStageMeta[task.stage].label, tone: "neutral" as const },
    { text: priorityLabels[task.priority], tone: priorityTones[task.priority] },
    { text: statusLabels[statusOf(task)], tone: "info" as const },
  ],
  facts: facts(
    { glyph: "person", text: `Com ${task.owner.name}` },
    { glyph: "date", text: `Prazo em ${shortDate(task.dueDate)}` },
    task.estimate ? { glyph: "estimate", text: estimateLabel(task.estimate) } : null,
    task.project ? { glyph: "project", text: task.project.name } : null,
    task.subtasks.length > 0
      ? { glyph: "list", text: `${task.subtasks.filter((item) => item.done).length} de ${task.subtasks.length} subtarefas` }
      : null,
  ),
  note: task.description,
}));

const clients: AppRecord[] = previewClients.map((client) => ({
  key: `client-${client.id}`,
  kind: "client",
  reference: client.reference,
  name: client.name,
  caption: client.company,
  href: `/clientes/${client.id}` as AppRecord["href"],
  media: { kind: "face", name: client.name },
  tags: [
    { text: client.active ? "Ativo" : "Inativo", tone: client.active ? ("success" as const) : ("neutral" as const) },
    ...client.tags.slice(0, 2).map((tag) => ({ text: tag, tone: "neutral" as const })),
  ],
  facts: facts(
    client.role ? { glyph: "role", text: client.role } : null,
    client.company ? { glyph: "company", text: client.company } : null,
    client.email ? { glyph: "at", text: client.email } : null,
    client.phone ? { glyph: "phone", text: applyPattern("phone", client.phone) } : null,
    client.city ? { glyph: "city", text: client.city } : null,
    {
      glyph: "quote",
      text: `${client.stats.quotes} ${client.stats.quotes === 1 ? "orçamento" : "orçamentos"}, ${formatMoney(client.stats.billed)} faturado`,
    },
  ),
  note: client.about,
}));

/* A arte de um item e o matiz dele, na mesma receita da tabela de orçamentos. */
const lineArt = (line: QuoteLine) => {
  const hue = catalogHueFor(line.name);
  return { url: catalogArtworkUrl({ id: line.catalogItemId ?? line.id, hue }), hue: `var(--sys-${hue})` };
};

const quotes: AppRecord[] = previewQuotes.map((quote) => ({
  key: `quote-${quote.id}`,
  kind: "quote",
  reference: quote.number,
  name: quote.title,
  caption: `${quote.client.company ?? quote.client.name}, ${formatMoney(quoteTotals(quote).total)}`,
  href: `/orcamentos/${quote.id}` as AppRecord["href"],
  media: { kind: "art", items: quote.lines.slice(0, 3).map(lineArt), total: quote.lines.length },
  tags: [{ text: quoteStatuses[quote.status].label, tone: quoteStatuses[quote.status].tone }],
  facts: [
    { glyph: "money" as const, text: formatMoney(quoteTotals(quote).total) },
    { glyph: "person" as const, text: quote.client.company ?? quote.client.name },
    { glyph: "items" as const, text: `${quote.lines.length} ${quote.lines.length === 1 ? "item" : "itens"}` },
    { glyph: "date" as const, text: `De ${shortDate(quote.createdAt)}` },
  ],
}));

/* Os projetos saem dos que os clientes carregam na ficha, que é onde eles têm id e identificador de verdade:
   o domínio de projetos ainda não tem lista própria. Repetido entre dois clientes entra uma vez só. */
const projects: AppRecord[] = [...new Map(
  previewClients.flatMap((client) =>
    client.projects.map((project) => [
      project.reference,
      {
        key: `project-${project.id}`,
        kind: "project" as const,
        reference: project.reference,
        name: project.name,
        caption: client.company ?? client.name,
        href: `/projetos/${project.id}` as AppRecord["href"],
        tags: [{ text: `${project.progress}% pronto`, tone: project.progress === 100 ? ("success" as const) : ("accent" as const) }],
        facts: [
          { glyph: "person" as const, text: client.name },
          ...(client.company ? [{ glyph: "company" as const, text: client.company }] : []),
        ],
      },
    ]),
  ),
).values()];

const catalog: AppRecord[] = previewCatalog.map((item) => ({
  key: `catalog-${item.id}`,
  kind: "catalog",
  reference: item.reference,
  name: item.name,
  caption: item.category,
  href: `/catalogo/${item.id}` as AppRecord["href"],
  tags: [{ text: kindLabels[item.kind], tone: "neutral" as const }],
  facts: [
    { glyph: "money" as const, text: `${formatMoney(item.price)} ${unitLabels[item.unit]}` },
    { glyph: "tag" as const, text: item.category },
    {
      glyph: "quote" as const,
      text: `${item.stats.quotes} ${item.stats.quotes === 1 ? "orçamento" : "orçamentos"}, ${item.stats.approved} aprovados`,
    },
  ],
  note: item.description,
}));

/* Pessoa não tem identificador nem página própria: o destino é a tela da equipe. */
const people: AppRecord[] = previewTeamSummary.members.map((member) => ({
  key: `person-${member.id}`,
  kind: "person",
  name: member.name,
  caption: member.role,
  media: { kind: "face", name: member.name },
  href: "/configuracoes/equipe",
  tags: [
    {
      text: accessLabels[member.access],
      tone: member.access === "owner" ? ("yellow" as const) : member.access === "admin" ? ("info" as const) : ("neutral" as const),
    },
    ...(member.status === "pending" ? [{ text: "Convite em aberto", tone: "warning" as const }] : []),
  ],
  facts: facts(
    { glyph: "role", text: member.role },
    { glyph: "at", text: member.email },
    member.phone ? { glyph: "phone", text: applyPattern("phone", member.phone) } : null,
    member.city ? { glyph: "city", text: member.city } : null,
    {
      glyph: "list",
      text: `${member.metrics.openTasks} ${member.metrics.openTasks === 1 ? "tarefa aberta" : "tarefas abertas"}, ${member.metrics.activeProjects} em projeto`,
    },
    { glyph: "date", text: `Na equipe desde ${shortDate(member.joinedAt)}` },
  ),
  note: member.bio,
}));

export const previewRecords: AppRecord[] = [...tasks, ...clients, ...quotes, ...projects, ...catalog, ...people];
