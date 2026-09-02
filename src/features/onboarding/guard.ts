import "server-only";
import { getOnboardingBilling } from "@/features/billing/queries";
import { getCurrentTeamState } from "@/features/organizations/queries";

// A configuração inicial é um modal sobre o painel, não uma rota: quem ainda não configurou recebe
// a camada por cima do próprio painel. Quem entrou por convite não configura nada e passa direto,
// mesmo que o dono tenha largado a configuração pela metade.
export async function getOnboardingGate() {
  const state = await getCurrentTeamState();
  const canSetup = state.viewer.role === "owner" || state.viewer.role === "admin";
  const needsSetup = !state.team?.completed && canSetup;

  // O catálogo de planos vem junto porque a etapa 3 precisa saber o plano em vigor e se o teste
  // gratuito ainda está de pé. Sem time ainda, vem o catálogo com o gratuito em vigor.
  const billing = needsSetup ? await getOnboardingBilling(state.team?.id ?? null) : null;

  return { state, needsSetup, billing };
}
