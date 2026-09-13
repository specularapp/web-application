import { cookieString } from "@/lib/cookies";

/**
 * Quantos cartões a grade mostrou por página da última vez: a prancha mede as colunas e grava, e o servidor
 * lê na visita seguinte para a primeira página já vir do tamanho certo, sem pedir de novo depois de medir.
 * Separado da leitura no servidor pelo mesmo motivo do catálogo: a prancha é componente de cliente e só
 * precisa gravar, e a leitura com zod mora em `list.ts`.
 */
export const PROJECTS_GRID_COOKIE = "sp-projetos-grade";

/** Grava a medida no cookie, no cliente. Vive fora do componente porque escrever em `document` de dentro dele o lint barra. */
export function saveProjectsGridSize(size: number) {
  document.cookie = cookieString(PROJECTS_GRID_COOKIE, String(size));
}
