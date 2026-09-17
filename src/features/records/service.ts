import "server-only";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import type { SupabaseClient } from "@supabase/supabase-js";
import { catalogArtworkUrl, kindLabels, unitLabels } from "@/features/catalog/list-options";
import { contractKinds, contractStatuses } from "@/features/contracts/labels";
import { listTeamMembers } from "@/features/organizations/service";
import { quoteStatuses } from "@/features/quotes/labels";
import { quoteTotals } from "@/features/quotes/totals";
import { projectStatuses } from "@/features/projects/labels";
import { estimateLabel, priorityLabels, priorityTones, statusLabels, stageStatus } from "@/features/tasks/labels";
import { taskStageMeta } from "@/features/tasks/stages";
import { applyPattern } from "@/lib/masks";
import { formatMoney } from "@/lib/utils/format";
import type { Database } from "@/types/database";
import type { AppRecord, RecordFact } from "./records";

/**
 * O índice da casa: tudo o que existe na aplicação e pode ser apontado pelo `#` de um comentário ou pelo
 * vincular registro da ficha. Montado **no servidor** e entregue por prop, e não lido de dentro do
 * componente que busca: são as sete bases da conta inteira, e puxar todas para o navegador levaria a base
 * junto só para mostrar uma lista de nome e identificador.
 *
 * O teto por tipo é o que mantém isso barato numa conta grande: a busca refina, e quem procura um registro
 * específico chega nele pela tela dele.
 */
export type RecordsClient = SupabaseClient<Database>;

/** Quantos de cada tipo o índice carrega: o bastante para a busca achar sem levar a base ao navegador. */
const PER_KIND = 200;

const shortDate = (iso: string) => format(parseISO(iso), "d 'de' MMM. 'de' yyyy", { locale: ptBR });

/* Um fato só entra quando tem o que dizer: sem isto, o resumo encheria de linhas vazias. */
const facts = (...listed: (RecordFact | null | undefined | false)[]) => listed.filter(Boolean) as RecordFact[];

const accessLabels: Record<string, string> = { owner: "Proprietário", admin: "Administrador", member: "Membro" };

export async function listAppRecords(client: RecordsClient, organizationId: string): Promise<AppRecord[]> {
  const [tasks, clients, quotes, projects, contracts, catalog, team] = await Promise.all([
    client
      .from("tasks")
      .select("id, reference, title, description, stage, priority, due_date, estimate_minutes, owner_id, projects(name), subtasks(done)")
      .eq("organization_id", organizationId)
      .order("due_date")
      .limit(PER_KIND),
    client
      .from("clients")
      .select("id, reference, name, company, email, phone, city, role, about, active")
      .eq("organization_id", organizationId)
      .order("name")
      .limit(PER_KIND),
    client
      .from("quotes")
      .select("id, reference, title, status, client_name, issued_at, discount_kind, discount_value, quote_lines(name, quantity, unit_price, courtesy)")
      .eq("organization_id", organizationId)
      .order("issued_at", { ascending: false })
      .limit(PER_KIND),
    client
      .from("projects")
      .select("id, reference, name, description, status, progress, started_at, due_at, clients(name)")
      .eq("organization_id", organizationId)
      .order("started_at", { ascending: false })
      .limit(PER_KIND),
    client
      .from("contracts")
      .select("id, reference, title, description, kind, status, amount, created_at, clients(name)")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(PER_KIND),
    client
      .from("catalog_items")
      .select("id, reference, name, description, kind, category, price, unit, hue, active")
      .eq("organization_id", organizationId)
      .order("name")
      .limit(PER_KIND),
    listTeamMembers(client, organizationId),
  ]);

  const people = new Map(team.map((member) => [member.userId, member]));
  const nameOf = (id: string | null) => (id && people.get(id)?.name) || "a equipe";

  const taskRecords: AppRecord[] = (tasks.data ?? []).map((task) => ({
    key: `task-${task.id}`,
    kind: "task",
    reference: task.reference,
    name: task.title,
    caption: task.projects?.name,
    href: "/tarefas",
    tags: [
      { text: taskStageMeta[task.stage].label, tone: "neutral" as const },
      { text: priorityLabels[task.priority], tone: priorityTones[task.priority] },
      { text: statusLabels[stageStatus(task.stage)], tone: "info" as const },
    ],
    facts: facts(
      { glyph: "person", text: `Com ${nameOf(task.owner_id)}` },
      { glyph: "date", text: `Prazo em ${shortDate(task.due_date)}` },
      task.estimate_minutes ? { glyph: "estimate", text: estimateLabel(task.estimate_minutes) } : null,
      task.projects ? { glyph: "project", text: task.projects.name } : null,
      task.subtasks.length > 0
        ? { glyph: "list", text: `${task.subtasks.filter((item) => item.done).length} de ${task.subtasks.length} subtarefas` }
        : null,
    ),
    note: task.description,
  }));

  const clientRecords: AppRecord[] = (clients.data ?? []).map((entry) => ({
    key: `client-${entry.id}`,
    kind: "client",
    reference: entry.reference,
    name: entry.name,
    caption: entry.company ?? undefined,
    href: `/clientes/${entry.id}` as AppRecord["href"],
    media: { kind: "face", name: entry.name },
    tags: [{ text: entry.active ? "Ativo" : "Inativo", tone: entry.active ? ("success" as const) : ("neutral" as const) }],
    facts: facts(
      entry.company ? { glyph: "company", text: entry.company } : null,
      entry.role ? { glyph: "role", text: entry.role } : null,
      entry.email ? { glyph: "at", text: entry.email } : null,
      entry.phone ? { glyph: "phone", text: applyPattern("phone", entry.phone) } : null,
      entry.city ? { glyph: "city", text: entry.city } : null,
    ),
    note: entry.about ?? undefined,
  }));

  const quoteRecords: AppRecord[] = (quotes.data ?? []).map((quote) => {
    const lines = (quote.quote_lines ?? []).map((line) => ({
      name: line.name,
      quantity: Number(line.quantity),
      unitPrice: line.unit_price,
      courtesy: line.courtesy,
    }));
    const total = quoteTotals({
      lines,
      discount: quote.discount_kind && quote.discount_value !== null ? { kind: quote.discount_kind, value: quote.discount_value } : null,
      installments: 1,
      cashDiscount: 0,
    }).total;

    return {
      key: `quote-${quote.id}`,
      kind: "quote",
      reference: quote.reference,
      name: quote.title,
      caption: quote.client_name,
      href: `/orcamentos/${quote.id}` as AppRecord["href"],
      tags: [{ text: quoteStatuses[quote.status].label, tone: quoteStatuses[quote.status].tone }],
      facts: facts(
        { glyph: "money", text: formatMoney(total) },
        { glyph: "person", text: quote.client_name },
        { glyph: "date", text: shortDate(quote.issued_at) },
        lines.length > 0 ? { glyph: "items", text: `${lines.length} ${lines.length === 1 ? "item" : "itens"}` } : null,
      ),
      note: lines.map((line) => line.name).join(", "),
    };
  });

  const projectRecords: AppRecord[] = (projects.data ?? []).map((project) => ({
    key: `project-${project.id}`,
    kind: "project",
    reference: project.reference,
    name: project.name,
    caption: project.clients?.name,
    href: `/projetos/${project.id}` as AppRecord["href"],
    tags: [{ text: projectStatuses[project.status].label, tone: projectStatuses[project.status].tone }],
    facts: facts(
      project.clients ? { glyph: "person", text: project.clients.name } : null,
      { glyph: "date", text: `Começou em ${shortDate(project.started_at)}` },
      project.due_at ? { glyph: "date", text: `Entrega em ${shortDate(project.due_at)}` } : null,
      { glyph: "list", text: `${project.progress}% concluído` },
    ),
    note: project.description,
  }));

  const contractRecords: AppRecord[] = (contracts.data ?? []).map((contract) => ({
    key: `contract-${contract.id}`,
    kind: "contract",
    reference: contract.reference,
    name: contract.title,
    caption: contract.clients?.name,
    href: `/contratos/${contract.id}` as AppRecord["href"],
    tags: [
      { text: contractKinds[contract.kind].label, tone: "neutral" as const },
      { text: contractStatuses[contract.status].label, tone: contractStatuses[contract.status].tone },
    ],
    facts: facts(
      contract.clients ? { glyph: "person", text: contract.clients.name } : null,
      contract.amount !== null ? { glyph: "money", text: formatMoney(contract.amount) } : null,
      { glyph: "date", text: shortDate(contract.created_at.slice(0, 10)) },
    ),
    note: contract.description,
  }));

  const catalogRecords: AppRecord[] = (catalog.data ?? []).map((item) => ({
    key: `catalog-${item.id}`,
    kind: "catalog",
    reference: item.reference,
    name: item.name,
    caption: item.category,
    href: `/catalogo/${item.id}` as AppRecord["href"],
    media: { kind: "art", items: [{ url: catalogArtworkUrl({ id: item.id, hue: item.hue }), hue: `var(--sys-${item.hue})` }], total: 1 },
    tags: [
      { text: kindLabels[item.kind], tone: "neutral" as const },
      { text: item.active ? "Ativo" : "Inativo", tone: item.active ? ("success" as const) : ("neutral" as const) },
    ],
    facts: facts(
      { glyph: "money", text: `${formatMoney(item.price)} ${unitLabels[item.unit]}` },
      { glyph: "tag", text: item.category },
    ),
    note: item.description,
  }));

  const personRecords: AppRecord[] = team.map((member) => ({
    key: `person-${member.userId}`,
    kind: "person",
    name: member.name || member.email || "Equipe",
    caption: accessLabels[member.role] ?? "Membro",
    href: "/configuracoes/equipe",
    media: { kind: "face", name: member.name || member.email || "Equipe" },
    facts: facts(member.email ? { glyph: "at", text: member.email } : null),
  }));

  return [
    ...taskRecords,
    ...clientRecords,
    ...quoteRecords,
    ...projectRecords,
    ...contractRecords,
    ...catalogRecords,
    ...personRecords,
  ];
}
