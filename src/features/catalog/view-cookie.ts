import { cookieString } from "@/lib/cookies";

/**
 * O jeito de ver o catálogo: grade de cartões ou tabela. Vive em cookie, como a preferência de layout do
 * painel, porque é preferência de interface e Web Storage é proibido; assim ela volta na próxima visita e
 * o servidor já manda a página na visão certa, sem piscar a outra antes.
 *
 * Separado da leitura no servidor pelo mesmo motivo de `layout-cookie.ts` do painel: a prancha é componente
 * de cliente e só precisa gravar, e importar de onde mora o zod levaria o zod inteiro para o navegador.
 */

export const CATALOG_VIEW_COOKIE = "sp-catalogo-visao";

export const catalogViewValues = ["grade", "tabela"] as const;

export type CatalogView = (typeof catalogViewValues)[number];

export const DEFAULT_VIEW: CatalogView = "grade";

/** Grava a escolha no cookie, no cliente. Vive fora do componente porque escrever em `document` de dentro dele o lint barra. */
export function saveCatalogView(view: CatalogView) {
  document.cookie = cookieString(CATALOG_VIEW_COOKIE, view);
}

/**
 * Quantos cartões a grade mostrou por página da última vez: a prancha mede as colunas e grava, e o servidor
 * lê na visita seguinte para a primeira página já vir do tamanho certo, sem pedir de novo depois de medir.
 */
export const CATALOG_GRID_COOKIE = "sp-catalogo-grade";

export function saveCatalogGridSize(size: number) {
  document.cookie = cookieString(CATALOG_GRID_COOKIE, String(size));
}
