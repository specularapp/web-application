import type { Icon } from "@phosphor-icons/react";
import { FolderIcon, MinusCircleIcon, PackageIcon, WrenchIcon } from "@phosphor-icons/react/ssr";
import { svgToken } from "@/lib/generated-svg";
import { gridPageSize as pageSizeForGrid, remapPage } from "@/lib/utils/paging";
import type { BadgeTone } from "@/components/ui/badge";
import type { CatalogItem, CatalogKind, CatalogUnit } from "./summary";

/**
 * O lado leve da listagem do catálogo: nomes dos parâmetros, padrões, rótulos e a lista de filtros em
 * vigor. Separado de `list.ts` porque lá mora o zod que lê a URL no servidor, e a prancha é componente
 * de cliente: importar de lá levaria o zod inteiro para o navegador. Mesma divisão da base de clientes.
 */

/** Trinta por página na tabela (pedido de 2026-09-08): a página só passa quando está completa, e trinta cabe bem numa tela. */
export const CATALOG_PER_PAGE = 30;

/**
 * Na grade a página é o que cabe em até três linhas, e sempre par (pedido de 2026-09-08): a prancha mede
 * quantas colunas a grade formou e pede ao servidor esse tanto. Antes de medir, no servidor e na primeira
 * visita, vale o que o cookie guardou da última vez ou o padrão de quatro colunas.
 */
export const GRID_ROWS = 3;
export const GRID_PER_PAGE_DEFAULT = 12;
export const MAX_PER_PAGE = 30;

export const gridPageSize = (columns: number) => pageSizeForGrid(columns, GRID_ROWS, MAX_PER_PAGE);

export { remapPage };

export const QUERY_PARAM = "busca";
export const KIND_PARAM = "tipo";
export const CATEGORY_PARAM = "categoria";
export const STATUS_PARAM = "situacao";
export const PAGE_PARAM = "pagina";
export const PAGE_SIZE_PARAM = "porPagina";

export const kindValues = ["todos", "produtos", "servicos"] as const;
export const statusValues = ["todos", "ativos", "inativos"] as const;

export type CatalogKindFilter = (typeof kindValues)[number];
export type CatalogStatusFilter = (typeof statusValues)[number];

/* Os padrões saem como o valor literal, e não como o tipo largo: é o que deixa a lista de filtros em
   vigor saber que, fora do padrão, tipo e situação já não são "todos". */
export const DEFAULT_KIND = "todos" satisfies CatalogKindFilter;
export const DEFAULT_STATUS = "todos" satisfies CatalogStatusFilter;
/** Categoria vazia é "todas": ela é texto livre, então não tem lista fechada de valores. */
export const DEFAULT_CATEGORY = "";

/* Rótulos num lugar só: o menu de filtros e a etiqueta do filtro em vigor dizem a mesma coisa. */
export const kindFilterLabels: Record<CatalogKindFilter, string> = {
  todos: "Produtos e serviços",
  produtos: "Só produtos",
  servicos: "Só serviços",
};

const statusFilterLabels: Record<Exclude<CatalogStatusFilter, "todos">, string> = {
  ativos: "Só ativos",
  inativos: "Só inativos",
};

/** O nome do tipo na etiqueta do cartão. */
export const kindLabels: Record<CatalogKind, string> = {
  product: "Produto",
  service: "Serviço",
};

/** A cor de cada tipo, a mesma em cartão, ficha e tabela: produto em teal, serviço em índigo. */
export const kindTones: Record<CatalogKind, BadgeTone> = {
  product: "teal",
  service: "indigo",
};

/** Como o preço é cobrado, para ler junto do valor: "R$ 1.200,00 por projeto". */
export const unitLabels: Record<CatalogUnit, string> = {
  project: "por projeto",
  hour: "por hora",
  month: "por mês",
  unit: "por unidade",
};

/** O que a URL carrega: o que a pessoa filtrou, em que página está e quantos por página. */
export type CatalogQuery = {
  search: string;
  kind: CatalogKindFilter;
  category: string;
  status: CatalogStatusFilter;
  page: number;
  /** Quantos por página: 30 na tabela; na grade, o que cabe em três linhas. Sem parâmetro, o servidor decide pela visão. */
  pageSize: number;
};

export const defaultQuery: CatalogQuery = {
  search: "",
  kind: DEFAULT_KIND,
  category: DEFAULT_CATEGORY,
  status: DEFAULT_STATUS,
  page: 1,
  pageSize: CATALOG_PER_PAGE,
};

/** Um filtro fora do padrão: o glifo e o nome que a barra mostra, e o que devolve só ele ao padrão. */
export type ActiveCatalogFilter = { id: string; label: string; icon: Icon; clear: Partial<CatalogQuery> };

/**
 * Os filtros fora do padrão, na ordem em que aparecem no menu. A barra mostra um por etiqueta, e a
 * contagem na quina do funil é o tamanho desta lista: um lugar só decide o que está em vigor.
 */
export function activeCatalogFilters(query: CatalogQuery): ActiveCatalogFilter[] {
  const list: ActiveCatalogFilter[] = [];

  if (query.kind !== DEFAULT_KIND) {
    const icon = query.kind === "produtos" ? PackageIcon : WrenchIcon;
    list.push({ id: "kind", label: kindFilterLabels[query.kind], icon, clear: { kind: DEFAULT_KIND } });
  }
  if (query.category !== DEFAULT_CATEGORY) {
    list.push({ id: "category", label: query.category, icon: FolderIcon, clear: { category: DEFAULT_CATEGORY } });
  }
  if (query.status !== DEFAULT_STATUS) {
    list.push({ id: "status", label: statusFilterLabels[query.status], icon: MinusCircleIcon, clear: { status: DEFAULT_STATUS } });
  }

  return list;
}

/** Tudo de volta ao padrão, menos a busca: é o que "Limpar filtros" faz. */
export const clearedFilters: Partial<CatalogQuery> = {
  kind: DEFAULT_KIND,
  category: DEFAULT_CATEGORY,
  status: DEFAULT_STATUS,
  page: 1,
};

/**
 * A página pronta: os cartões que a grade mostra, quantos itens o filtro encontrou ao todo e as
 * categorias que existem na base inteira, para o menu de filtros oferecer só o que tem.
 */
export type CatalogListPage = {
  items: CatalogItem[];
  total: number;
  categories: string[];
};

/**
 * O endereço da arte gerada de um item sem foto: o matiz vai no caminho, porque a linha do desenho é
 * tingida nele, e o token sai do id, porque o desenho é do item e não muda quando o nome muda. A rota que
 * desenha é `/api/artwork/[hue]/[token]`, sobre `artwork.ts`.
 */
export function catalogArtworkUrl(item: Pick<CatalogItem, "id" | "hue">) {
  return `/api/artwork/${item.hue}/${svgToken(item.id)}.svg`;
}

/** Como o estoque de um produto se lê: a frase curta e a cor, decididas uma vez para o cartão, a ficha e a tabela. */
export type StockTone = Extract<BadgeTone, "neutral" | "success" | "warning" | "danger">;

export type StockReading = { label: string; short: string; tone: StockTone; quantity: number | null };

/**
 * Esgotado em vermelho, no mínimo ou abaixo em laranja, o resto em verde. Produto sem controle de quantidade
 * (hospedagem, domínio sob demanda) lê como "Sob demanda", neutro: não há o que contar. Serviço não tem
 * estoque e devolve nulo, para quem desenha nem tentar.
 */
/** Sem limite, como serviço e produto sob demanda: a tabela mostra o infinito nos dois lados. */
export const UNLIMITED_STOCK = "∞/∞";

export function readStock(item: Pick<CatalogItem, "kind" | "stock">): StockReading | null {
  if (item.kind !== "product") return null;
  if (!item.stock) return { label: "Sob demanda", short: UNLIMITED_STOCK, tone: "neutral", quantity: null };

  const { quantity, capacity, minimum } = item.stock;
  const units = quantity === 1 ? "1 unidade" : `${quantity} unidades`;
  const short = `${quantity}/${capacity}`;
  if (quantity <= 0) return { label: "Esgotado", short, tone: "danger", quantity };
  if (quantity <= minimum) return { label: `Baixo: ${units}`, short, tone: "warning", quantity };
  return { label: `${units} em estoque`, short, tone: "success", quantity };
}
