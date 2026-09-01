import { OnboardingFlow } from "@/features/onboarding/components/onboarding-flow";
import { getOnboardingGate } from "@/features/onboarding/guard";
import { createMetadata } from "@/lib/metadata";

export const metadata = createMetadata({
  title: "Painel",
  description: "Visão geral de oportunidades, cobranças, projetos e finanças",
  path: "/dashboard",
});

export default async function DashboardPage() {
  const { state, needsSetup } = await getOnboardingGate();

  if (!needsSetup) return null;

  return (
    <OnboardingFlow
      team={state.team}
      members={state.members}
      invites={state.invites}
      currentUser={state.viewer}
    />
  );
}
