"use client";

import { ClockIcon, DotsThreeIcon } from "@phosphor-icons/react";
import { parseISO } from "date-fns";
import { useState, type CSSProperties, type ReactNode } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ListPagination, PagedBody } from "@/components/ui/list-pagination";
import { ListTable, type ListTableSort } from "@/components/ui/list-table";
import { useListPagination } from "@/hooks/use-list-pagination";
import { applyPattern, onlyDigits } from "@/lib/masks";
import { expectedOf, sourceHues, sourceLabels } from "../labels";
import type { CrmStage } from "../stages";
import type { Opportunity } from "../summary";
import { opportunityTagCatalog } from "../tags";
import { OpportunityMenu } from "./opportunity-menu";
import { SourceMark } from "./source-mark";
import { useCrmStages } from "./stage-context";
import styles from "./opportunities-table.module.css";

export type OpportunitiesTableProps = {
  /** Todas as oportunidades que o filtro deixou, na ordem do quadro: a tabela ordena e pagina por conta própria. */
  opportunities: Opportunity[];
  onOpen: (opportunity: Opportunity) => void;
  stages: CrmStage[];
  onMove: (opportunity: Opportunity, stage: CrmStage) => void;
  onDelete: (opportunity: Opportunity) => void;
  /** O funil de cada linha só aparece no quadro de todas, onde as linhas vêm de funis diferentes. */
  showFunnel: boolean;
  /** O retrato do filtro: trocá-lo volta a lista para a primeira página. */
  filterKey: string;
};

/* O valor como a lista da pousada mostra: em reais inteiros, sem os centavos, que só pesam na coluna. */
const reais = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

const money = (cents: number) => `R$ ${reais.format(Math.round(cents / 100))}`;

/** O telefone como se lê, sem o 55 do país: é ele que aparece embaixo do nome, como na lista da pousada. */
function phoneOf(opportunity: Opportunity) {
  const digits = onlyDigits(opportunity.contact?.phone ?? "");
  if (!digits) return undefined;
  return applyPattern("phone", digits.length > 11 && digits.startsWith("55") ? digits.slice(2) : digits);
}

/** Há quanto tempo foi o último contato, curto, como a pousada escreve: "há 5 m", "há 3 h", "há 12 d". */
function timeAgo(iso: string) {
  const minutes = Math.max(0, Math.round((Date.now() - parseISO(iso).getTime()) / 60_000));
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  return `há ${Math.round(hours / 24)} d`;
}

/* Controles com ação própria dentro da linha: o clique neles não abre a ficha. */
const INTERACTIVE = "button, a, input, label, [role='button'], [role='menuitem']";

const Muted = ({ children }: { children: ReactNode }) => <span className={styles.muted}>{children}</span>;

/** A ordem da lista pela coluna escolhida no cabeçalho, como na lista do funil da pousada. */
function sortRows(rows: Opportunity[], sort: ListTableSort | null, stageOrder: Map<CrmStage, number>) {
  if (!sort) return rows;
  const key = (item: Opportunity): string | number => {
    switch (sort.id) {
      case "opportunity":
        return item.title.toLocaleLowerCase("pt-BR");
      case "stage":
        return stageOrder.get(item.stage) ?? 99;
      case "value":
        return item.value;
      case "expected":
        return item.expectedAt || "9999";
      case "owner":
        return item.owner.id ? item.owner.name.toLocaleLowerCase("pt-BR") : "~";
      default:
        return item.lastTouchAt || item.enteredAt || "";
    }
  };
  const direction = sort.direction === "asc" ? 1 : -1;
  return rows.toSorted((a, b) => {
    const x = key(a);
    const y = key(b);
    return (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "pt-BR")) * direction;
  });
}

/**
 * A lista do funil, com a tabela e as páginas trazidas da lista do funil da pousada (2026-10-26, a pedido:
 * "pegar a tabela e o pagination que tem lá e trazer para cá, adaptando para as nossas informações"): a venda com
 * o rosto do cliente e o telefone, a etapa com o ícone dela, o valor, quando deve fechar, a origem com o logo,
 * quem cuida com a foto, as etiquetas e o último contato; no fim, o leque da linha. Clicar na linha abre a
 * ficha. As páginas flutuam no pé, na pílula de lá.
 */
export function OpportunitiesTable({ opportunities, onOpen, stages, onMove, onDelete, showFunnel, filterKey }: OpportunitiesTableProps) {
  const meta = useCrmStages();
  const [sort, setSort] = useState<ListTableSort | null>({ id: "lastTouch", direction: "desc" });
  const stageOrder = new Map(stages.map((stage, index) => [stage, index]));
  const sorted = sortRows(opportunities, sort, stageOrder);
  const page = useListPagination(sorted, `${filterKey}|${sort?.id}|${sort?.direction}`);

  return (
    <div className={styles.tableWrap}>
      <PagedBody pager={<ListPagination state={page} noun="oportunidades" />}>
        <ListTable<Opportunity>
          label="Oportunidades do funil"
          rows={page.rows}
          rowId={(item) => item.id}
          sort={sort}
          onSortChange={setSort}
          empty={<p className={styles.empty}>Nenhuma oportunidade com esses filtros.</p>}
          rowProps={(item) => ({
            /* O leque da linha tem ação própria, e o menu dele abre em portal: clique que nasce num controle, ou
               fora da linha no DOM, não abre a ficha. */
            onClick: (event) => {
              const target = event.target as HTMLElement;
              if (!event.currentTarget.contains(target) || target.closest(INTERACTIVE)) return;
              onOpen(item);
            },
            "data-clickable": true,
          })}
          columns={[
            {
              id: "opportunity",
              header: "Oportunidade",
              sortable: true,
              firstDirection: "asc",
              cell: (item) => (
                <span className={styles.tableLead}>
                  <Avatar name={item.client.name} src={item.client.avatarUrl ?? undefined} size="xs" />
                  <span>
                    <strong>{item.title}</strong>
                    <small>{phoneOf(item) ?? item.client.company ?? item.client.name}</small>
                  </span>
                </span>
              ),
            },
            {
              id: "stage",
              header: "Etapa",
              sortable: true,
              firstDirection: "asc",
              cell: (item) => {
                const stage = meta[item.stage];
                if (!stage) return <Muted>Sem etapa</Muted>;
                const Glyph = stage.icon;
                return (
                  <span className={styles.stageChip} style={{ "--tone": stage.hue } as CSSProperties}>
                    <Glyph aria-hidden="true" />
                    {stage.label}
                  </span>
                );
              },
            },
            {
              id: "value",
              header: "Valor",
              align: "end",
              sortable: true,
              firstDirection: "desc",
              cell: (item) => <strong className={styles.money}>{money(item.value)}</strong>,
            },
            {
              id: "expected",
              header: "Fechamento",
              sortable: true,
              firstDirection: "asc",
              cell: (item) => {
                if (!item.expectedAt) return <Muted>Sem data</Muted>;
                const expected = expectedOf(item);
                return (
                  <Badge tone={expected.tone} size="sm">
                    {expected.label}
                  </Badge>
                );
              },
            },
            ...(showFunnel
              ? [
                  {
                    id: "funnel",
                    header: "Funil",
                    cell: (item: Opportunity) => (item.funnel ? item.funnel.name : <Muted>Sem funil</Muted>),
                  },
                ]
              : []),
            {
              id: "source",
              header: "Origem",
              cell: (item) => (
                <span className={styles.tableSource}>
                  <span className={styles.logo} style={{ color: sourceHues[item.source] }}>
                    <SourceMark source={item.source} />
                  </span>
                  {sourceLabels[item.source]}
                </span>
              ),
            },
            {
              id: "owner",
              header: "Responsável",
              sortable: true,
              firstDirection: "asc",
              cell: (item) =>
                item.owner.id ? (
                  <span className={styles.person}>
                    <Avatar name={item.owner.name} src={item.owner.avatarUrl ?? undefined} size="xs" />
                    {item.owner.name.split(" ")[0]}
                  </span>
                ) : (
                  <Muted>Sem responsável</Muted>
                ),
            },
            {
              id: "tags",
              header: "Etiquetas",
              cell: (item) =>
                item.tags.length > 0 ? (
                  <span className={styles.tags}>
                    {item.tags.slice(0, 2).map((tag) => (
                      <Badge key={tag} hue={opportunityTagCatalog.hueOf(tag)} size="sm">
                        {tag}
                      </Badge>
                    ))}
                    {item.tags.length > 2 && (
                      <Badge size="sm" variant="outline" title={item.tags.slice(2).join(", ")}>
                        +{item.tags.length - 2}
                      </Badge>
                    )}
                  </span>
                ) : (
                  <Muted>Nenhuma</Muted>
                ),
            },
            {
              id: "lastTouch",
              header: "Último contato",
              sortable: true,
              firstDirection: "desc",
              cell: (item) =>
                item.lastTouchAt ? (
                  <span className={styles.inline} title={new Date(item.lastTouchAt).toLocaleString("pt-BR")}>
                    <ClockIcon aria-hidden="true" />
                    {timeAgo(item.lastTouchAt)}
                  </span>
                ) : (
                  <Muted>Nenhum</Muted>
                ),
            },
            {
              id: "actions",
              header: "Ações",
              align: "end",
              cell: (item) => (
                <span className={styles.tableActions}>
                  <OpportunityMenu
                    opportunity={item}
                    onOpen={() => onOpen(item)}
                    stages={stages}
                    onMove={(stage) => onMove(item, stage)}
                    onDelete={() => onDelete(item)}
                    icon={<DotsThreeIcon />}
                  />
                </span>
              ),
            },
          ]}
        />
      </PagedBody>
    </div>
  );
}
