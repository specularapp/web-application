import { cookieString } from "@/lib/cookies";

/**
 * O jeito de ver a base de clientes: grade de cartões ou tabela. Vive em cookie, como no catálogo, porque
 * é preferência de interface e Web Storage é proibido; assim ela volta na próxima visita e o servidor já
 * manda a página na visão certa, sem piscar a outra antes.
 *
 * Separado da leitura no servidor pelo mesmo motivo de `layout-cookie.ts` do painel: a prancha é componente
 * de cliente e só precisa gravar, e importar de onde mora o zod levaria o zod inteiro para o navegador.
 */

export const CLIENTS_VIEW_COOKIE = "sp-clientes-visao";

export const clientsViewValues = ["grade", "tabela"] as const;

export type ClientsView = (typeof clientsViewValues)[number];

export const DEFAULT_VIEW: ClientsView = "grade";

/** Grava a escolha no cookie, no cliente. Vive fora do componente porque escrever em `document` de dentro dele o lint barra. */
export function saveClientsView(view: ClientsView) {
  document.cookie = cookieString(CLIENTS_VIEW_COOKIE, view);
}

/**
 * Quantos cartões a grade mostrou por página da última vez: a prancha mede as colunas e grava, e o servidor
 * lê na visita seguinte para a primeira página já vir do tamanho certo, sem pedir de novo depois de medir.
 */
export const CLIENTS_GRID_COOKIE = "sp-clientes-grade";

export function saveClientsGridSize(size: number) {
  document.cookie = cookieString(CLIENTS_GRID_COOKIE, String(size));
}
