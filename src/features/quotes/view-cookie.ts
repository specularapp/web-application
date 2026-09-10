import { cookieString } from "@/lib/cookies";

/**
 * O jeito de ver os orçamentos: tabela ou grade de cartões (2026-09-10, a pedido: a lista nasceu só em tabela
 * e ganhou os cartões da base de clientes e do catálogo). Vive em cookie, porque é preferência de interface e
 * Web Storage é proibido; assim ela volta na próxima visita e o servidor já manda a página na visão certa.
 *
 * Separado da leitura no servidor pelo mesmo motivo das outras listas: a prancha é componente de cliente e
 * só precisa gravar, e importar de onde mora o zod levaria o zod inteiro para o navegador.
 */

export const QUOTES_VIEW_COOKIE = "sp-orcamentos-visao";

export const quotesViewValues = ["tabela", "grade"] as const;

export type QuotesView = (typeof quotesViewValues)[number];

/** A tabela é o padrão (decisão de 2026-09-09): orçar e acompanhar são a mesma tela, e a tabela é o acompanhar. */
export const DEFAULT_VIEW: QuotesView = "tabela";

/** Grava a escolha no cookie, no cliente. Vive fora do componente porque escrever em `document` de dentro dele o lint barra. */
export function saveQuotesView(view: QuotesView) {
  document.cookie = cookieString(QUOTES_VIEW_COOKIE, view);
}

/**
 * Quantos cartões a grade mostrou por página da última vez: a prancha mede as colunas e grava, e o servidor
 * lê na visita seguinte para a primeira página já vir do tamanho certo, sem pedir de novo depois de medir.
 */
export const QUOTES_GRID_COOKIE = "sp-orcamentos-grade";

export function saveQuotesGridSize(size: number) {
  document.cookie = cookieString(QUOTES_GRID_COOKIE, String(size));
}
