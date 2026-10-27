import { cookieString } from "@/lib/cookies";

/**
 * O jeito de ver o funil: o quadro de etapas ou a tabela (2026-10-26, a pedido, no padrão do funil da pousada).
 * Vive em cookie, como nas outras listas, porque é preferência de interface e Web Storage é proibido; assim
 * o servidor já manda o funil na visão certa, sem piscar a outra antes.
 *
 * Separado da leitura no servidor para a prancha, que só grava, não levar o zod para o navegador.
 */

export const CRM_VIEW_COOKIE = "sp-funil-visao";

export const crmViewValues = ["quadro", "tabela"] as const;

export type CrmView = (typeof crmViewValues)[number];

export const DEFAULT_CRM_VIEW: CrmView = "quadro";

/** Grava a escolha no cookie, no cliente. Vive fora do componente porque escrever em `document` de dentro dele o lint barra. */
export function saveCrmView(view: CrmView) {
  document.cookie = cookieString(CRM_VIEW_COOKIE, view);
}
