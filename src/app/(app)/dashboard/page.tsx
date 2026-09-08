import { DashboardScreen } from "@/features/dashboard/components/dashboard-screen";
import { greetingFor } from "@/features/dashboard/greetings";
import { LAYOUT_COOKIE, parseDashboardLayout } from "@/features/dashboard/layout";
import { parsePeriod, PERIOD_PARAM } from "@/features/dashboard/period";
import dynamic from "next/dynamic";
import { getOnboardingGate } from "@/features/onboarding/guard";
import { previewClientsSummary } from "@/features/clients/preview";
import { previewFinanceSummary } from "@/features/finance/preview";
import { previewPointsSummary, previewWeeklyChallenge } from "@/features/gamification/preview";
import { previewTeamSummary } from "@/features/organizations/preview";
import { previewProjectsSummary } from "@/features/projects/preview";
import { previewQuotesSummary } from "@/features/quotes/preview";
import { previewTasksSummary } from "@/features/tasks/preview";
import { createMetadata } from "@/lib/metadata";
import { cookies } from "next/headers";
import { first } from "@/lib/utils/search-params";

/* A configuração inicial entra por importação dinâmica (varredura de peso de 2026-09-08): ela só
   aparece na primeira vez que a pessoa entra, mas o import estático punha no pacote de toda visita ao
   painel os quatro passos, o seletor de imagem e os elementos de cartão do Stripe. */
const OnboardingFlow = dynamic(() =>
  import("@/features/onboarding/components/onboarding-flow").then((module) => module.OnboardingFlow),
);

export const metadata = createMetadata({
  title: "Painel",
  description: "Visão geral de oportunidades, cobranças, projetos e finanças",
  path: "/dashboard",
});

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const [{ state, needsSetup, billing }, params, cookieStore] = await Promise.all([getOnboardingGate(), searchParams, cookies()]);
  const layout = parseDashboardLayout(cookieStore.get(LAYOUT_COOKIE)?.value);
  const period = parsePeriod(first(params[PERIOD_PARAM]));
  const { viewer } = state;

  return (
    <>
      <DashboardScreen
        user={{ name: viewer.name ?? viewer.email ?? "Você", email: viewer.email, avatarUrl: viewer.avatarUrl }}
        greeting={greetingFor(viewer.userId)}
        period={period}
        projects={previewProjectsSummary}
        finance={previewFinanceSummary}
        clients={previewClientsSummary}
        tasks={previewTasksSummary}
        team={previewTeamSummary}
        challenge={previewWeeklyChallenge}
        quotes={previewQuotesSummary}
        achievements={previewPointsSummary}
        layout={layout}
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
