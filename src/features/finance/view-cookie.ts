import { cookieString } from "@/lib/cookies";

/**
 * O jeito de ver as cobranças, grade de cartões ou tabela, e quantos cartões a grade mostrou por página da
 * última vez: vivem em cookie, como na base de clientes, porque é preferência de interface e Web Storage é
 * proibido. Separado da leitura no servidor porque a prancha é componente de cliente e só precisa gravar.
 */

export const CHARGES_VIEW_COOKIE = "sp-cobrancas-visao";

export const chargesViewValues = ["grade", "tabela"] as const;

export type ChargesView = (typeof chargesViewValues)[number];

export const DEFAULT_CHARGES_VIEW: ChargesView = "tabela";

export function saveChargesView(view: ChargesView) {
  document.cookie = cookieString(CHARGES_VIEW_COOKIE, view);
}

export const CHARGES_GRID_COOKIE = "sp-cobrancas-grade";

export function saveChargesGridSize(size: number) {
  document.cookie = cookieString(CHARGES_GRID_COOKIE, String(size));
}
