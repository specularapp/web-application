import { cookieString } from "@/lib/cookies";
import type { DashboardBlockId } from "./blocks";

/**
 * O lado leve da preferência de layout do painel: o nome do cookie, o formato e a escrita no navegador.
 *
 * Está separado de `layout.ts` por peso (varredura de 2026-09-08): a gaveta de personalizar é componente
 * de cliente e só precisa gravar o cookie, mas ao importar isso de `layout.ts` levava junto o zod que
 * valida a leitura no servidor, 63 KB comprimidos, para toda visita ao painel. A validação continua onde
 * sempre esteve, no servidor, porque cookie é entrada de usuário.
 */

/** Cookie da preferência de layout do painel: ordem dos blocos e quais ficam escondidos. */
export const LAYOUT_COOKIE = "sp-painel";

export type DashboardLayout = {
  order: DashboardBlockId[];
  hidden: DashboardBlockId[];
};

export function serializeDashboardLayout(layout: DashboardLayout) {
  return JSON.stringify(layout);
}

/** Grava a preferência no cookie, no cliente. Vive fora do componente porque escrever em `document` de dentro dele o lint barra. */
export function saveDashboardLayout(layout: DashboardLayout) {
  document.cookie = cookieString(LAYOUT_COOKIE, serializeDashboardLayout(layout));
}
