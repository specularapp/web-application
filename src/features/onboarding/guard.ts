import "server-only";
import { redirect } from "next/navigation";
import { getCurrentTeamState } from "@/features/organizations/queries";

export const ONBOARDING_PATH = "/primeiros-passos";

// Toda página da área logada passa por aqui: quem ainda não configurou o time volta para o fluxo,
// senão o painel abriria vazio e sem organização para consultar. Quem entrou por convite não
// configura nada, então segue direto mesmo que o dono tenha largado a configuração pela metade.
export async function requireOnboarding() {
  const state = await getCurrentTeamState();
  const canSetup = state.viewer.role === "owner" || state.viewer.role === "admin";
  if (!state.team?.completed && canSetup) redirect(ONBOARDING_PATH);
  return state;
}
