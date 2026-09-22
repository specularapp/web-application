import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { BadgeTone } from "@/components/ui/badge";
import { contractStatuses } from "@/features/contracts/labels";
import { listStageDefinitions } from "@/features/crm/service";
import { crmStatusTones } from "@/features/crm/labels";
import { crmStageMeta, stageKind } from "@/features/crm/stages";
import { chargeStatuses } from "@/features/finance/labels";
import { projectStatuses } from "@/features/projects/labels";
import { quoteStatuses } from "@/features/quotes/labels";
import { quoteTotals } from "@/features/quotes/totals";
import { formatMoney } from "@/lib/utils/format";
import type { Database } from "@/types/database";

/**
 * O mapa de relação de um registro: tudo o que se liga a ele, com a ligação nomeada.
 *
 * É a resposta visual para "o que este cliente tem na casa": os orçamentos que saíram dele, os projetos que
 * viraram trabalho, os contratos que formalizaram, as cobranças que ele paga e as oportunidades que ainda
 * estão no funil. A tela desenha isso como mapa mental, no mesmo motor de fluxo das automações.
 *
 * O que sai daqui é **dado**, e não desenho: nós com tipo, nome e uma linha de apoio, e arestas com o nome
 * da ligação. Quem escolhe posição e cor é a tela, porque isso é do desenho e muda com ele.
 */
export type RelationClient = SupabaseClient<Database>;

/**
 * O que o mapa desenha. Não é o `RecordKind` do índice da casa (`records.ts`): aquele é o que a busca e a
 * marcação de comentário alcançam, e este é o que se pendura num cliente, que inclui cobrança e
 * oportunidade e não inclui pessoa nem tarefa.
 */
export type RelationKind = "client" | "quote" | "project" | "contract" | "charge" | "opportunity";

/** Um campo do registro no nó, com o nome do que ele é: é o que deixa ler o mapa sem abrir cada registro. */
export type RelationField = { label: string; value: string };

export type RelationNode = {
  id: string;
  kind: RelationKind;
  /** O identificador que a pessoa lê, quando o registro tem um. */
  reference?: string;
  name: string;
  /** Linha de apoio: o valor, a situação, o prazo. */
  caption?: string;
  /**
   * A imagem do registro, quando ele tem uma: a logo da marca do cliente, a logo ou a capa do projeto
   * (2026-09-17, a pedido). É o que deixa reconhecer o registro antes de ler, que é o que o mapa serve para
   * fazer. Sem imagem o nó fica com o glifo do domínio, como antes.
   */
  imageUrl?: string | null;
  /**
   * Os campos do registro, nomeados e na ordem de leitura: valor, emissão, prazo, andamento. Sai daqui já
   * formatado porque o mapa mostra seis domínios de uma vez, e formatar na tela arrastaria seis mapas de
   * rótulo para o navegador.
   */
  fields?: RelationField[];
  /** Onde o registro mora, para o nó levar até ele. */
  href?: string;
  /* A situação já resolvida em nome e tom, e não o valor cru do banco: o mapa mostra cinco domínios de uma
     vez, e traduzir cada um na tela seria arrastar cinco mapas de rótulo para o navegador só para escrever
     "Aprovado". O tom é o da etiqueta da própria página do registro, então a cor não muda de lugar para
     lugar. */
  status?: { label: string; tone: BadgeTone };
};

export type RelationEdge = {
  id: string;
  from: string;
  to: string;
  /** O que a ligação quer dizer: "virou", "cobra", "formaliza". */
  label: string;
};

export type RelationMap = {
  root: RelationNode;
  nodes: RelationNode[];
  edges: RelationEdge[];
};

/** Quantos de cada tipo o mapa desenha: passando disso ele vira emaranhado e deixa de responder nada. */
const PER_KIND = 12;

/* Só o nome e o tom saem dos mapas de rótulo da casa: o glifo deles é um componente React, e componente não
   atravessa a fronteira de uma Server Action. */
const badge = (meta: { label: string; tone: BadgeTone }) => ({ label: meta.label, tone: meta.tone });

/* A data como a casa escreve nas listas: dia, mês e ano em dois dígitos. Nula some do nó em vez de virar
   campo vazio, porque campo vazio ocupa linha e não diz nada. */
const day = (iso: string | null | undefined) =>
  iso ? new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }) : null;

/** Os campos que existem, na ordem dada: o que veio nulo não vira linha. */
const fieldsOf = (...entries: [string, string | null | undefined][]): RelationField[] =>
  entries.filter((entry): entry is [string, string] => Boolean(entry[1])).map(([label, value]) => ({ label, value }));

/**
 * O mapa de um cliente. Cinco leituras em paralelo, cada uma já filtrada pelo cliente: é barato porque toda
 * tabela tem índice por `client_id`, e o teto por tipo segura o desenho.
 */
export async function getClientRelations(
  client: RelationClient,
  organizationId: string,
  clientId: string,
): Promise<RelationMap | null> {
  const { data: contact } = await client
    .from("clients")
    .select("id, reference, name, company, avatar_url, company_logo_url, email, phone, city")
    .eq("organization_id", organizationId)
    .eq("id", clientId)
    .maybeSingle();

  if (!contact) return null;

  const [quotes, projects, contracts, charges, opportunities, definitions] = await Promise.all([
    client
      .from("quotes")
      .select("id, reference, title, status, issued_at, valid_until, discount_kind, discount_value, quote_lines(quantity, unit_price, courtesy)")
      .eq("organization_id", organizationId)
      .eq("client_id", clientId)
      .order("issued_at", { ascending: false })
      .limit(PER_KIND),
    client
      .from("projects")
      .select("id, reference, name, status, progress, logo_url, cover_url, started_at, due_at")
      .eq("organization_id", organizationId)
      .eq("client_id", clientId)
      .order("started_at", { ascending: false })
      .limit(PER_KIND),
    client
      .from("contracts")
      .select("id, reference, title, status, amount, signed_at, created_at, quote_id, project_id")
      .eq("organization_id", organizationId)
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(PER_KIND),
    client
      .from("charges")
      .select("id, reference, title, amount, cancelled_at, quote_id, contract_id, project_id, charge_installments(amount, paid_at)")
      .eq("organization_id", organizationId)
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(PER_KIND),
    client
      .from("opportunities")
      .select("id, reference, title, stage, value, quote_id")
      .eq("organization_id", organizationId)
      .eq("client_id", clientId)
      .order("entered_at", { ascending: false })
      .limit(PER_KIND),
    listStageDefinitions(client, organizationId),
  ]);

  const root: RelationNode = {
    id: contact.id,
    kind: "client",
    reference: contact.reference,
    name: contact.name,
    caption: contact.company ?? undefined,
    /* A marca da empresa antes do rosto da pessoa, a mesma ordem que o projeto segue: quem lê o mapa procura
       a marca que conhece. */
    imageUrl: contact.company_logo_url ?? contact.avatar_url,
    fields: fieldsOf(["Empresa", contact.company], ["E-mail", contact.email], ["Telefone", contact.phone], ["Cidade", contact.city]),
    href: `/clientes/${contact.id}`,
  };

  const nodes: RelationNode[] = [];
  const edges: RelationEdge[] = [];
  /* Só se liga ao que está no mapa: um contrato que nasceu de um orçamento fora do teto continua pendurado
     no cliente, e não numa aresta solta apontando para o nada. */
  const present = new Set<string>([root.id]);

  type QuoteRow = NonNullable<typeof quotes.data>[number];

  const quoteAmount = (quote: QuoteRow) =>
    quoteTotals({
      lines: (quote.quote_lines ?? []).map((line) => ({
        quantity: Number(line.quantity),
        unitPrice: line.unit_price,
        courtesy: line.courtesy,
      })),
      discount: quote.discount_kind && quote.discount_value !== null ? { kind: quote.discount_kind, value: quote.discount_value } : null,
      installments: 1,
      cashDiscount: 0,
    }).total;

  /* De quem cada orçamento nasceu. É montado antes de desenhar os orçamentos porque um orçamento que veio de
     uma oportunidade pendura **nela**, e não no cliente: cada nó tem um pai só, senão o mapa deixa de ser
     mapa mental e vira emaranhado de fios cruzados. */
  const opportunityOfQuote = new Map<string, string>();

  for (const opportunity of opportunities.data ?? []) {
    nodes.push({
      id: opportunity.id,
      kind: "opportunity",
      reference: opportunity.reference,
      name: opportunity.title,
      caption: formatMoney(opportunity.value),
      fields: fieldsOf(["Valor", formatMoney(opportunity.value)], ["Etapa", (definitions.find((stage) => stage.id === opportunity.stage)?.label ?? crmStageMeta[opportunity.stage]?.label ?? "Etapa")]),
      status: { label: (definitions.find((stage) => stage.id === opportunity.stage)?.label ?? crmStageMeta[opportunity.stage]?.label ?? "Etapa"), tone: crmStatusTones[stageKind(opportunity.stage)] },
      href: "/crm",
    });
    present.add(opportunity.id);
    edges.push({ id: `c-${opportunity.id}`, from: root.id, to: opportunity.id, label: "oportunidade" });
    if (opportunity.quote_id) opportunityOfQuote.set(opportunity.quote_id, opportunity.id);
  }

  for (const quote of quotes.data ?? []) {
    nodes.push({
      id: quote.id,
      kind: "quote",
      reference: quote.reference,
      name: quote.title,
      caption: formatMoney(quoteAmount(quote)),
      fields: fieldsOf(["Total", formatMoney(quoteAmount(quote))], ["Emissão", day(quote.issued_at)], ["Validade", day(quote.valid_until)]),
      status: badge(quoteStatuses[quote.status]),
      href: `/orcamentos/${quote.id}`,
    });
    present.add(quote.id);

    const owner = opportunityOfQuote.get(quote.id);
    edges.push({ id: `c-${quote.id}`, from: owner ?? root.id, to: quote.id, label: owner ? "virou" : "orçou" });
  }

  for (const project of projects.data ?? []) {
    nodes.push({
      id: project.id,
      kind: "project",
      reference: project.reference,
      name: project.name,
      caption: `${project.progress}% concluído`,
      /* A logo do projeto primeiro e a capa depois: a logo é a marca, a capa é a imagem do trabalho, e num
         azulejo pequeno a marca lê melhor. */
      imageUrl: project.logo_url ?? project.cover_url,
      fields: fieldsOf(["Andamento", `${project.progress}%`], ["Início", day(project.started_at)], ["Entrega", day(project.due_at)]),
      status: badge(projectStatuses[project.status]),
      href: `/projetos/${project.id}`,
    });
    present.add(project.id);
    edges.push({ id: `c-${project.id}`, from: root.id, to: project.id, label: "projeto" });
  }

  for (const contract of contracts.data ?? []) {
    nodes.push({
      id: contract.id,
      kind: "contract",
      reference: contract.reference,
      name: contract.title,
      caption: contract.amount === null ? undefined : formatMoney(contract.amount),
      fields: fieldsOf(
        ["Valor", contract.amount === null ? null : formatMoney(contract.amount)],
        ["Assinado", day(contract.signed_at)],
        ["Criado", day(contract.created_at)],
      ),
      status: badge(contractStatuses[contract.status]),
      href: `/contratos/${contract.id}`,
    });
    present.add(contract.id);

    /* O contrato pendura no que o originou quando ele está no mapa; senão, no cliente. */
    const parent = [contract.quote_id, contract.project_id].find((id) => id && present.has(id));
    edges.push({
      id: `k-${contract.id}`,
      from: parent ?? root.id,
      to: contract.id,
      label: parent ? "formaliza" : "contrato",
    });
  }

  for (const charge of charges.data ?? []) {
    const paid = (charge.charge_installments ?? []).reduce(
      (sum, installment) => sum + (installment.paid_at ? installment.amount : 0),
      0,
    );

    nodes.push({
      id: charge.id,
      kind: "charge",
      reference: charge.reference,
      name: charge.title,
      caption: `${formatMoney(paid)} de ${formatMoney(charge.amount)}`,
      fields: fieldsOf(
        ["Total", formatMoney(charge.amount)],
        ["Recebido", formatMoney(paid)],
        ["Em aberto", formatMoney(Math.max(0, charge.amount - paid))],
        ["Parcelas", String((charge.charge_installments ?? []).length)],
      ),
      /* Sem "vencida" aqui: isso depende do vencimento de cada parcela, e o mapa não é a tela de cobrança.
         Quem quer saber se venceu abre a cobrança pelo próprio nó. */
      status: badge(chargeStatuses[charge.cancelled_at ? "cancelled" : paid >= charge.amount ? "paid" : paid > 0 ? "partial" : "open"]),
      href: `/cobrancas/${charge.id}`,
    });

    const parent = [charge.contract_id, charge.quote_id, charge.project_id].find((id) => id && present.has(id));
    edges.push({ id: `b-${charge.id}`, from: parent ?? root.id, to: charge.id, label: parent ? "cobra" : "cobrança" });
    present.add(charge.id);
  }

  return { root, nodes, edges };
}
