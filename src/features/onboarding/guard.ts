import "server-only";
import { getCurrentTeamState } from "@/features/organizations/queries";

// A configuração inicial é um modal sobre o painel, não uma rota: quem ainda não configurou recebe
// a camada por cima do próprio painel. Quem entrou por convite não configura nada e passa direto,
// mesmo que o dono tenha largado a configuração pela metade.
export async function getOnboardingGate() {
  const state = await getCurrentTeamState();
  const canSetup = state.viewer.role === "owner" || state.viewer.role === "admin";

  return { state, needsSetup: !state.team?.completed && canSetup };
}
