import { cookieString } from "@/lib/cookies";

/**
 * O jeito de ver os contratos: o funil por situação ou a tabela (2026-10-26, a pedido: "a visualização em
 * etapas para ficar mais organizado e o modo tabela", no lugar da grade de cartões). Vive em cookie, porque é
 * preferência de interface e Web Storage é proibido; assim ela volta na próxima visita e o servidor já manda
 * a página na medida da visão.
 *
 * Separado da leitura no servidor pelo mesmo motivo das outras listas: a prancha é componente de cliente e só
 * precisa gravar, e importar de onde mora o zod levaria o zod inteiro para o navegador.
 */
export const CONTRACTS_VIEW_COOKIE = "sp-contratos-visao";

export const contractsViewValues = ["funil", "tabela"] as const;

export type ContractsView = (typeof contractsViewValues)[number];

/** O funil é o padrão: contrato é documento que anda, e as etapas mostram onde cada um parou. */
export const DEFAULT_CONTRACTS_VIEW: ContractsView = "funil";

/** Grava a escolha no cookie, no cliente. Vive fora do componente porque escrever em `document` de dentro dele o lint barra. */
export function saveContractsView(view: ContractsView) {
  document.cookie = cookieString(CONTRACTS_VIEW_COOKIE, view);
}
