"use client";

import styled from "@emotion/styled";
import { CalendarBlankIcon, CaretUpDownIcon } from "@phosphor-icons/react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import type { Route } from "next";
import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from "react";
import { formatMoney } from "@/lib/utils/format";
import { Badge, type BadgeTone } from "../badge";
import { Checkbox } from "../checkbox";
import { Skeleton } from "../skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow, TableScroll } from "../table";
import { VisuallyHidden } from "../visually-hidden";
import { Text } from "../text";

export type DataTableAlign = "start" | "center" | "end";

export type DataTableSortDirection = "asc" | "desc";

export type DataTableSort = { column: string; direction: DataTableSortDirection };

export type DataTableColumn<Row> = {
  id: string;
  header: string;
  align?: DataTableAlign;
  /** Largura fixa da coluna, em qualquer unidade de CSS; sem ela a coluna toma o que o conteúdo pede. */
  width?: string;
  /** Ordenável pelo cabeçalho. Com `sortValue` a tabela ordena sozinha o que recebeu; sem ele, só avisa. */
  sortable?: boolean;
  sortValue?: (row: Row) => string | number | null;
  /** Coluna que sai nas telas estreitas, para as que importam caberem sem rolar. */
  hideBelow?: "md" | "lg";
  cell: (row: Row) => ReactNode;
};

export type DataTableSelection<Row> = {
  selected: string[];
  onChange: (selected: string[]) => void;
  /** O nome da caixa de cada linha para leitor de tela, como "Selecionar Landing page". */
  rowLabel: (row: Row) => string;
};

/** De qual até qual linha a página mostra, para o pé dizer "Mostrando 1 a 12 de 342". */
export type DataTableRange = { page: number; pageSize: number; total: number };

export type DataTableProps<Row> = {
  /** Nome da tabela para leitor de tela e para a região que rola. */
  label: string;
  columns: DataTableColumn<Row>[];
  rows: Row[];
  rowKey: (row: Row) => string;
  /** Com ela, a primeira coluna são as caixas de marcar, com marcar tudo no cabeçalho. */
  selection?: DataTableSelection<Row>;
  /** A ordem em vigor, controlada por quem chama; sem ela a tabela guarda a própria. */
  sort?: DataTableSort | null;
  defaultSort?: DataTableSort;
  onSortChange?: (sort: DataTableSort | null) => void;
  /** A linha inteira abre algo ao clique. Pelo teclado quem abre é a célula principal, um botão ou link
   *  de verdade via `DataTableTitle`: linha clicável sem foco próprio deixaria a tabela sem teclado. */
  onRowClick?: (row: Row) => void;
  /** O que fica na última coluna, alinhado ao fim: o leque de opções, os botões da linha. */
  actions?: (row: Row) => ReactNode;
  density?: "default" | "compact";
  /** Linhas alternadas com um véu, para o olho não perder a linha em tabelas largas. */
  zebra?: boolean;
  loading?: boolean;
  loadingRows?: number;
  /** O que aparece no lugar das linhas quando não há nenhuma. */
  empty?: ReactNode;
  /** O pé: a paginação, na ponta direita. */
  footer?: ReactNode;
  range?: DataTableRange;
  /** Enche a altura de quem a monta e rola as linhas por dentro, com o pé sempre à vista. */
  fill?: boolean;
};

/* Controles com ação própria dentro da linha: clique que nasce neles não abre a linha. */
const INTERACTIVE = "button, a, input, label, [role='button'], [role='menuitem'], [role='checkbox']";

const MOBILE = "@media (max-width: 47.9375rem)";
const TABLET = "@media (max-width: 63.9375rem)";

/* A moldura: a região que rola vestida no fundo da página, e não no cinza elevado, porque a tabela é a
   página e não uma caixa sobre ela. As regras de linha ficam aqui, por atributo, para as células e o
   cabeçalho continuarem sendo os primitivos estáticos da casa. */
const Frame = styled.div`
  display: grid;
  gap: var(--space-3);
  min-width: 0;

  /* Enchendo a altura: a região toma o que sobra e rola por dentro, e o pé fica numa linha própria. */
  &[data-fill] {
    grid-template-rows: minmax(0, 1fr);
    grid-auto-rows: auto;
    height: 100%;
    min-height: 0;
  }

  & [role="region"] {
    --table-surface: var(--color-bg);
  }

  /* As cores da linha são opacas, misturadas sobre a superfície em vez de véus transparentes, porque a
     célula de ações, presa na ponta, herda a cor da linha e precisa tapar o que rola por baixo dela. */
  & tbody tr {
    background-color: var(--table-surface);
    transition: background-color var(--duration-fast) var(--ease-standard);
  }

  & tbody tr[data-clickable] {
    cursor: pointer;
  }

  @media (hover: hover) {
    & tbody tr[data-clickable]:hover {
      background-color: color-mix(in oklab, var(--color-label) 8%, var(--table-surface));
    }
  }

  /* Marcada, a linha ganha o véu do acento, o mesmo sinal do cartão selecionado. */
  & tbody tr[data-selected] {
    background-color: light-dark(
      color-mix(in oklab, var(--color-accent) 3%, var(--table-surface)),
      color-mix(in oklab, var(--color-accent) 9%, var(--table-surface))
    );
  }

  /* A zebra é 3% da tinta do texto sobre a superfície, um degrau abaixo do hover (8%), para a linha seguinte
     sair só um pouco mais escura nos dois temas. Vai em :where() para pesar menos que o hover e a marcação. */
  & tbody[data-zebra] tr:where(:nth-of-type(even):not([data-selected])) {
    background-color: color-mix(in oklab, var(--color-label) 3%, var(--table-surface));
  }

  /* A coluna da marcação e a das ações são só o que o conteúdo mede, e nunca cedem espaço às outras. */
  & [data-column="select"],
  & [data-column="actions"] {
    width: 1px;
  }

  /* As ações ficam presas na ponta direita (pedido de 2026-09-08): quando a tabela rola na horizontal, o
     leque continua à mão. A célula herda a cor da linha, e os fios dela (o de cima e o da esquerda) vão
     por sombra interna, porque em tabela de bordas fundidas a borda de uma célula presa não acompanha a
     célula. No cabeçalho ela é presa nos dois eixos, em cima e na ponta. */
  & [data-column="actions"] {
    position: sticky;
    inset-inline-end: 0;
  }

  & tbody [data-column="actions"] {
    background-color: inherit;
    border: 0;
    box-shadow:
      inset var(--table-line) 0 0 var(--color-border),
      inset 0 var(--table-line) 0 var(--color-border);
  }

  & tbody tr:first-child [data-column="actions"] {
    box-shadow: inset var(--table-line) 0 0 var(--color-border);
  }

  & [data-column="select"] {
    padding-inline-end: 0;
  }

  & [data-hide="md"] {
    ${MOBILE} {
      display: none;
    }
  }

  & [data-hide="lg"] {
    ${TABLET} {
      display: none;
    }
  }
`;

/* O cabeçalho: o nome e a seta de ordem quando ordenável, na tinta secundária do
   cabeçalho da casa. */
const HeaderInner = styled.span`
  display: inline-flex;
  gap: var(--space-1);
  align-items: center;
  max-width: 100%;

  &[data-align="end"] {
    flex-direction: row-reverse;
  }
`;

/* O botão de ordenar é o próprio nome da coluna, sem caixa: a seta dupla apagada diz que dá para ordenar
   e vira uma seta só, na tinta cheia, quando a coluna manda na ordem. */
const SortButton = styled.button`
  display: inline-flex;
  gap: var(--space-1);
  align-items: center;
  padding: 0;
  font: inherit;
  color: inherit;
  cursor: pointer;
  background: transparent;
  border: 0;
  border-radius: var(--radius-xs);

  & svg {
    flex-shrink: 0;
    width: 0.875rem;
    height: 0.875rem;
    color: var(--color-label-tertiary);
  }

  &[data-active] {
    color: var(--color-label);
  }

  &[data-active] svg {
    color: var(--color-label);
  }

  @media (hover: hover) {
    &:hover {
      color: var(--color-label);
    }

    &:focus-visible {
      outline: 2px solid var(--color-focus);
      outline-offset: 2px;
    }
  }
`;

/* Sem linhas, a frase ocupa o lugar delas, centrada e com respiro. */
const EmptyCell = styled.div`
  display: grid;
  gap: var(--space-1);
  justify-items: center;
  padding: var(--space-8) var(--space-4);
  text-align: center;
`;

/* O pé: quantas linhas a página mostra de um lado e a paginação do outro; no celular um em cima do outro. */
const Foot = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2) var(--space-4);
  align-items: center;
  justify-content: space-between;
  min-width: 0;
`;

/* Nulo e indefinido vão para o fim em qualquer direção; número com número, o resto como texto em pt-BR. */
function compare(a: string | number | null, b: string | number | null) {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), "pt-BR", { numeric: true });
}

const rangeLabel = ({ page, pageSize, total }: DataTableRange) => {
  if (total === 0) return "Nenhum registro";
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return `Mostrando ${from} a ${to} de ${total}`;
};

// A tabela de dados da casa, para toda lista que precise ler em linhas: colunas declaradas por quem chama,
// cabeçalho preso com ordem, marcação com marcar tudo, linha clicável, coluna de ações, densidade,
// zebra, esqueleto de carga, vazio e pé com contagem e paginação. Ela compõe os primitivos estáticos de
// `ui/table` e cuida só do que é interação e estado; a aparência das células fica com quem chama, pelos
// ajudantes deste módulo (`DataTableTitle`, `DataTableStatus`, `DataTableTags`, `DataTableDate`,
// `DataTableMoney`), que são a receita das referências: identidade com foto e legenda em footnote, situação
// na etiqueta (sem ponto, pela regra da casa), etiquetas em fila, data com o glifo do calendário e dinheiro em
// footnote e algarismos tabulares. O cabeçalho não tem dica de interrogação: o nome da coluna basta. O glifo
// de ordem é sempre o chevron duplo da casa, o mesmo dos seletores; a coluna ativa só troca de tinta, e a
// direção fica em `aria-sort`. Setas para cima e para baixo destoavam do resto da tela.
//
// A tabela rola dentro da própria região, e não a página: em tela estreita quem cede é a rolagem
// horizontal de dentro, e as colunas marcadas com `hideBelow` saem antes disso. Com `fill` ela toma a
// altura de quem a monta e rola as linhas por dentro, com o cabeçalho preso e o pé sempre à vista; o que sobra
// abaixo da última linha vira linhas vazias na mesma grade, para a tabela não acabar num vazio.
export function DataTable<Row>({
  label,
  columns,
  rows,
  rowKey,
  selection,
  sort,
  defaultSort,
  onSortChange,
  onRowClick,
  actions,
  density = "default",
  zebra = false,
  loading = false,
  loadingRows = 6,
  empty,
  footer,
  range,
  fill = false,
}: DataTableProps<Row>) {
  // Enchendo a altura, o que sobra abaixo da última linha vira linhas vazias na mesma grade, para a tabela
  // não acabar num vazio: a região é medida quando muda de tamanho e a cada troca de linhas, e o número de
  // linhas de enchimento é o que cabe inteiro no que sobrou, na altura de uma linha de verdade. As linhas
  // de enchimento ficam fora da medida (marcadas por `data-filler`), senão a conta se realimentava.
  const regionRef = useRef<HTMLDivElement>(null);
  const [filler, setFiller] = useState({ count: 0, height: 0 });
  const rowCount = rows.length;

  useEffect(() => {
    const region = regionRef.current;
    if (!fill || !region) return;

    const measure = () => {
      const table = region.querySelector("table");
      const body = table?.tBodies[0];
      if (!table || !body) return;
      const real = Array.from(body.rows).filter((row) => !row.hasAttribute("data-filler"));
      const height = real[0]?.offsetHeight ?? 0;
      if (!height) {
        setFiller({ count: 0, height: 0 });
        return;
      }
      const used = (table.tHead?.offsetHeight ?? 0) + real.reduce((sum, row) => sum + row.offsetHeight, 0);
      const count = Math.max(0, Math.floor((region.clientHeight - used) / height));
      setFiller((current) => (current.count === count && current.height === height ? current : { count, height }));
    };

    const observer = new ResizeObserver(measure);
    observer.observe(region);
    return () => observer.disconnect();
  }, [fill, rowCount]);

  // A ordem é de quem chama quando ele a passa; senão a tabela guarda a própria, começando pelo padrão.
  const [ownSort, setOwnSort] = useState<DataTableSort | null>(defaultSort ?? null);
  const activeSort = sort === undefined ? ownSort : sort;

  // Clicar no cabeçalho roda a ordem: crescente, decrescente e de volta ao natural.
  const changeSort = (column: string) => {
    const next: DataTableSort | null =
      activeSort?.column !== column
        ? { column, direction: "asc" }
        : activeSort.direction === "asc"
          ? { column, direction: "desc" }
          : null;
    if (sort === undefined) setOwnSort(next);
    onSortChange?.(next);
  };

  const sortColumn = activeSort ? columns.find((column) => column.id === activeSort.column) : undefined;
  const sortValue = sortColumn?.sortValue;
  const sorted =
    activeSort && sortValue
      ? [...rows].sort((a, b) => compare(sortValue(a), sortValue(b)) * (activeSort.direction === "asc" ? 1 : -1))
      : rows;

  const keys = sorted.map(rowKey);
  const marked = selection ? keys.filter((key) => selection.selected.includes(key)).length : 0;
  const allMarked = marked > 0 && marked === keys.length;
  const span = columns.length + (selection ? 1 : 0) + (actions ? 1 : 0);

  const openRow = (row: Row) => (event: MouseEvent<HTMLTableRowElement>) => {
    if ((event.target as HTMLElement).closest(INTERACTIVE)) return;
    onRowClick?.(row);
  };

  const ariaSort = (column: DataTableColumn<Row>) => {
    if (!column.sortable) return undefined;
    if (activeSort?.column !== column.id) return "none";
    return activeSort.direction === "asc" ? "ascending" : "descending";
  };

  return (
    <Frame data-fill={fill || undefined}>
      <TableScroll label={label} ref={regionRef}>
        <Table density={density}>
          <TableHead>
            <TableRow>
              {selection && (
                <TableHeaderCell data-column="select">
                  <Checkbox
                    checked={allMarked}
                    indeterminate={marked > 0 && !allMarked}
                    onChange={(event) => selection.onChange(event.target.checked ? keys : [])}
                    aria-label="Selecionar as linhas desta página"
                  />
                </TableHeaderCell>
              )}
              {columns.map((column) => {
                const active = activeSort?.column === column.id;
                return (
                  <TableHeaderCell
                    key={column.id}
                    align={column.align}
                    aria-sort={ariaSort(column)}
                    data-hide={column.hideBelow}
                    style={column.width ? ({ width: column.width, minWidth: column.width } as CSSProperties) : undefined}
                  >
                    <HeaderInner data-align={column.align}>
                      {column.sortable ? (
                        <SortButton type="button" data-active={active || undefined} onClick={() => changeSort(column.id)}>
                          {column.header}
                          <CaretUpDownIcon aria-hidden="true" />
                        </SortButton>
                      ) : (
                        <span>{column.header}</span>
                      )}
                    </HeaderInner>
                  </TableHeaderCell>
                );
              })}
              {actions && (
                <TableHeaderCell align="end" data-column="actions">
                  <VisuallyHidden>Opções</VisuallyHidden>
                </TableHeaderCell>
              )}
            </TableRow>
          </TableHead>

          <TableBody data-zebra={zebra || undefined}>
            {loading ? (
              Array.from({ length: loadingRows }, (_, index) => (
                <TableRow key={index}>
                  {selection && (
                    <TableCell data-column="select">
                      <Skeleton shape="rect" width="1.25rem" height="1.25rem" />
                    </TableCell>
                  )}
                  {columns.map((column, position) => (
                    <TableCell key={column.id} align={column.align} data-hide={column.hideBelow}>
                      {/* Larguras variadas para o esqueleto não ler como uma grade: a primeira coluna é a
                          mais larga, as outras alternam. */}
                      <Skeleton width={position === 0 ? "60%" : (index + position) % 2 === 0 ? "45%" : "30%"} />
                    </TableCell>
                  ))}
                  {actions && <TableCell data-column="actions" />}
                </TableRow>
              ))
            ) : sorted.length === 0 ? (
              <TableRow>
                <TableCell colSpan={span}>
                  <EmptyCell>
                    {empty ?? (
                      <Text variant="footnote" tone="secondary">
                        Nada por aqui
                      </Text>
                    )}
                  </EmptyCell>
                </TableCell>
              </TableRow>
            ) : (
              sorted.map((row, index) => {
                const key = keys[index];
                const isSelected = selection?.selected.includes(key) ?? false;
                return (
                  <TableRow
                    key={key}
                    data-selected={isSelected || undefined}
                    data-clickable={onRowClick ? "" : undefined}
                    onClick={onRowClick ? openRow(row) : undefined}
                  >
                    {selection && (
                      <TableCell data-column="select">
                        <Checkbox
                          checked={isSelected}
                          onChange={(event) =>
                            selection.onChange(
                              event.target.checked ? [...selection.selected, key] : selection.selected.filter((entry) => entry !== key),
                            )
                          }
                          aria-label={selection.rowLabel(row)}
                        />
                      </TableCell>
                    )}
                    {columns.map((column) => (
                      <TableCell key={column.id} align={column.align} data-hide={column.hideBelow}>
                        {column.cell(row)}
                      </TableCell>
                    ))}
                    {actions && (
                      <TableCell align="end" data-column="actions">
                        {actions(row)}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })
            )}
            {fill &&
              !loading &&
              Array.from({ length: filler.count }, (_, index) => (
                <TableRow key={`filler-${index}`} data-filler aria-hidden="true" style={{ height: filler.height }}>
                  {selection && <TableCell data-column="select" />}
                  {columns.map((column) => (
                    <TableCell key={column.id} data-hide={column.hideBelow} />
                  ))}
                  {actions && <TableCell data-column="actions" />}
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </TableScroll>

      {(range || footer) && (
        <Foot>
          {range && (
            <Text as="span" variant="footnote" tone="secondary">
              {rangeLabel(range)}
            </Text>
          )}
          {footer}
        </Foot>
      )}
    </Frame>
  );
}

/* A célula de identidade: a foto ou a arte, o título e a legenda. O título é botão ou link de verdade quando
   a linha abre algo, porque é por ele que o teclado entra. */
const TitleCell = styled.span`
  display: flex;
  gap: var(--space-3);
  align-items: center;
  min-width: 0;
`;

const TitleCopy = styled.span`
  display: grid;
  min-width: 0;
`;

const titleReset = `
  display: block;
  min-width: 0;
  max-width: 100%;
  padding: 0;
  overflow: hidden;
  font-family: var(--font-body);
  font-size: var(--text-footnote);
  font-weight: var(--weight-medium);
  letter-spacing: var(--tracking-tight);
  color: var(--color-label);
  text-align: start;
  text-decoration: none;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
  background: transparent;
  border: 0;

  @media (hover: hover) {
    &:hover {
      text-decoration: underline;
    }

    &:focus-visible {
      outline: 2px solid var(--color-focus);
      outline-offset: 2px;
      border-radius: var(--radius-xs);
    }
  }
`;

const TitleButton = styled.button`
  ${titleReset}
`;

const TitleLink = styled(Link)`
  ${titleReset}
`;

export type DataTableTitleProps = {
  title: string;
  caption?: string;
  /** A foto, o avatar ou a arte, no tamanho da linha. */
  media?: ReactNode;
  onClick?: () => void;
  href?: Route;
};

export function DataTableTitle({ title, caption, media, onClick, href }: DataTableTitleProps) {
  return (
    <TitleCell>
      {media}
      <TitleCopy>
        {onClick ? (
          <TitleButton type="button" aria-haspopup="dialog" onClick={onClick}>
            {title}
          </TitleButton>
        ) : href ? (
          <TitleLink href={href}>{title}</TitleLink>
        ) : (
          <Text as="span" variant="footnote" weight="medium" truncate>
            {title}
          </Text>
        )}
        {caption && (
          <Text as="span" variant="caption1" tone="secondary" truncate>
            {caption}
          </Text>
        )}
      </TitleCopy>
    </TitleCell>
  );
}

/** A situação na etiqueta pequena da casa, sem ponto: a cor do texto e do fundo já dizem o estado. */
export function DataTableStatus({ tone, children }: { tone: BadgeTone; children: ReactNode }) {
  return (
    <Badge tone={tone} size="sm">
      {children}
    </Badge>
  );
}

const TagsRow = styled.span`
  display: inline-flex;
  gap: var(--space-1);
  align-items: center;
  white-space: nowrap;
`;

/** Etiquetas em fila, as primeiras à vista e o resto numa contagem, para a linha não crescer. */
export function DataTableTags({ items, max = 3 }: { items: string[]; max?: number }) {
  const shown = items.slice(0, max);
  const rest = items.length - shown.length;
  return (
    <TagsRow>
      {shown.map((item) => (
        <Badge key={item} size="sm">
          {item}
        </Badge>
      ))}
      {rest > 0 && (
        <Badge size="sm" variant="outline" title={items.slice(max).join(", ")}>
          +{rest}
        </Badge>
      )}
    </TagsRow>
  );
}

const DateCell = styled.span`
  display: inline-flex;
  gap: var(--space-1);
  align-items: center;
  white-space: nowrap;
  color: var(--color-label-secondary);

  & svg {
    flex-shrink: 0;
    width: 0.875rem;
    height: 0.875rem;
    color: var(--color-label-tertiary);
  }
`;

/** Uma data com o glifo do calendário na frente, em `d MMM. yyyy`. */
export function DataTableDate({ iso }: { iso: string }) {
  return (
    <DateCell>
      <CalendarBlankIcon aria-hidden="true" />
      <Text as="span" variant="footnote" tone="inherit">
        {format(parseISO(iso), "d MMM. yyyy", { locale: ptBR })}
      </Text>
    </DateCell>
  );
}

/** Dinheiro em centavos, por extenso e em algarismos tabulares, para as colunas alinharem à direita. */
export function DataTableMoney({ cents, weight = "semibold" }: { cents: number; weight?: "medium" | "semibold" }) {
  return (
    <Text as="span" variant="footnote" weight={weight}>
      {formatMoney(cents)}
    </Text>
  );
}

/** Campo sem nada, ou que não se aplica ao item, diz isso em palavras na etiqueta neutra: a coluna não
 *  fica vazia nem parece quebrada, e lê igual em toda tabela da casa. */
export function DataTableEmptyValue() {
  return <Badge size="sm">Não condiz</Badge>;
}
