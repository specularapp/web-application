/**
 * Constantes leves do domínio de organizações, fora dos esquemas e dos componentes.
 *
 * Existe por peso (varredura de 2026-09-08): a troca de time só queria o código do plano que libera
 * criar equipe, mas ao importá-lo de `components/create-team-panel.tsx` prendia a gaveta inteira, com o
 * seletor de imagem e o `react-dropzone`, no pacote inicial de quem só abriu o menu.
 */

/** O plano a partir do qual criar mais de uma equipe está liberado. */
export const CREATE_TEAM_PLAN = "alliance" as const;
