import { redirect } from "next/navigation";
import { OnboardingFlow } from "@/features/onboarding/components/onboarding-flow";
import { ONBOARDING_PATH } from "@/features/onboarding/guard";
import { getCurrentTeamState } from "@/features/organizations/queries";
import { createMetadata } from "@/lib/metadata";

export const metadata = createMetadata({
  title: "Primeiros passos",
  description: "Configure seu time em poucas etapas",
  path: ONBOARDING_PATH,
  noIndex: true,
});

export default async function PrimeirosPassosPage() {
  const state = await getCurrentTeamState(ONBOARDING_PATH);
  if (state.team?.completed || (state.team && state.viewer.role === "member")) redirect("/dashboard");

  return (
    <OnboardingFlow
      team={state.team}
      members={state.members}
      invites={state.invites}
      currentUser={state.viewer}
    />
  );
}
