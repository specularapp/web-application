import { DashboardScreen } from "@/features/dashboard/components/dashboard-screen";
import { greetingFor } from "@/features/dashboard/greetings";
import { parsePeriod, PERIOD_PARAM } from "@/features/dashboard/period";
import { OnboardingFlow } from "@/features/onboarding/components/onboarding-flow";
import { getOnboardingGate } from "@/features/onboarding/guard";
import { previewProjectsSummary } from "@/features/projects/preview";
import { createMetadata } from "@/lib/metadata";
import { first } from "@/lib/utils/search-params";

export const metadata = createMetadata({
  title: "Painel",
  description: "Visão geral de oportunidades, cobranças, projetos e finanças",
  path: "/dashboard",
});

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const [{ state, needsSetup, billing }, params] = await Promise.all([getOnboardingGate(), searchParams]);
  const period = parsePeriod(first(params[PERIOD_PARAM]));
  const { viewer } = state;

  return (
    <>
      <DashboardScreen
        user={{ name: viewer.name ?? viewer.email ?? "Você", email: viewer.email, avatarUrl: viewer.avatarUrl }}
        greeting={greetingFor(viewer.userId)}
        period={period}
        projects={previewProjectsSummary}
      />

      {needsSetup && billing && (
        <OnboardingFlow
          team={state.team}
          members={state.members}
          invites={state.invites}
          currentUser={viewer}
          billing={billing}
        />
      )}
    </>
  );
}
