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

/* O jeito de ver as outras listas do financeiro (2026-10-29, a pedido: "em todas as tabelas do financeiro ter
   como ver em cards também"), um cookie por tela: as contas bancárias nascem nos cartões, que são o desenho
   delas; as outras, na tabela, como eram. */
export const financeViews = {
  contas: { cookie: "sp-contas-visao", fallback: "grade" },
  receber: { cookie: "sp-receber-visao", fallback: "tabela" },
  pagar: { cookie: "sp-pagar-visao", fallback: "tabela" },
  movimentacoes: { cookie: "sp-movimentacoes-visao", fallback: "tabela" },
  transferencias: { cookie: "sp-transferencias-visao", fallback: "tabela" },
} as const satisfies Record<string, { cookie: string; fallback: ChargesView }>;

export type FinanceViewScreen = keyof typeof financeViews;

export function saveFinanceView(screen: FinanceViewScreen, view: ChargesView) {
  document.cookie = cookieString(financeViews[screen].cookie, view);
}

export const CHARGES_GRID_COOKIE = "sp-cobrancas-grade";

export function saveChargesGridSize(size: number) {
  document.cookie = cookieString(CHARGES_GRID_COOKIE, String(size));
}
