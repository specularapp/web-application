import type { BadgeTone } from "@/components/ui/badge";
import type { TeamMemberProjectStatus } from "./summary";

/**
 * Constantes leves do domínio de organizações, fora dos esquemas e dos componentes.
 *
 * Existe por peso (varredura de 2026-09-08): a troca de time só queria o código do plano que libera
 * criar equipe, mas ao importá-lo de `components/create-team-panel.tsx` prendia a gaveta inteira, com o
 * seletor de imagem e o `react-dropzone`, no pacote inicial de quem só abriu o menu.
 */

/** O plano a partir do qual criar mais de uma equipe está liberado. */
export const CREATE_TEAM_PLAN = "alliance" as const;

/** A situação de um projeto na ficha de quem é da equipe: etiqueta e tom, para o perfil do membro e a página da conta. */
export const memberProjectStatuses: Record<TeamMemberProjectStatus, { label: string; tone: BadgeTone }> = {
  ongoing: { label: "Em andamento", tone: "accent" },
  done: { label: "Concluído", tone: "success" },
  paused: { label: "Pausado", tone: "warning" },
};
