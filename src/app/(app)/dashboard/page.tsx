import dynamic from "next/dynamic";
import { cookies } from "next/headers";
import { getClientsBlock } from "@/features/clients/queries";
import { DashboardScreen } from "@/features/dashboard/components/dashboard-screen";
import { greetingFor } from "@/features/dashboard/greetings";
import { LAYOUT_COOKIE, parseDashboardLayout } from "@/features/dashboard/layout";
import { parsePeriod, PERIOD_PARAM } from "@/features/dashboard/period";
import { getFinanceBlock } from "@/features/finance/queries";
import { getGamificationBlocks } from "@/features/gamification/queries";
import { getOnboardingGate } from "@/features/onboarding/guard";
import { getOrganizationContext } from "@/features/organizations/context";
import { getTeamSummary } from "@/features/organizations/service";
import type { TeamSummary } from "@/features/organizations/summary";
import { getProjectsBlock } from "@/features/projects/queries";
import { getQuotesBlock } from "@/features/quotes/detail";
import { getTasksBlock } from "@/features/tasks/detail";
import { createMetadata } from "@/lib/metadata";
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

const EMPTY_TEAM: TeamSummary = { members: [] };

/**
 * O painel é a única tela que abre sem time: é por cima dele que a configuração inicial aparece, e é nela
 * que o time nasce. Por isso o contexto aqui é opcional, e não exigido: exigir mandava quem acabou de se
 * cadastrar de volta para o próprio painel, sem fim, e a janela que criaria o time nunca chegava a desenhar.
 */
export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const [{ state, needsSetup, billing }, params, cookieStore, context] = await Promise.all([
    getOnboardingGate(),
    searchParams,
    cookies(),
    getOrganizationContext(),
  ]);

  const layout = parseDashboardLayout(cookieStore.get(LAYOUT_COOKIE)?.value);
  const period = parsePeriod(first(params[PERIOD_PARAM]));
  const { viewer } = state;

  /* Os oito blocos saem juntos: cada um é do domínio dele, e esperar um pelo outro faria o painel abrir no
     tempo da soma em vez de no tempo do mais lento. */
  const [projects, finance, clients, tasks, team, quotes, gamification] = await Promise.all([
    getProjectsBlock(),
    getFinanceBlock(),
    getClientsBlock(),
    getTasksBlock(),
    context ? getTeamSummary(context.supabase, context.organizationId) : EMPTY_TEAM,
    getQuotesBlock(),
    getGamificationBlocks(),
  ]);

  return (
    <>
      <DashboardScreen
        user={{ name: viewer.name ?? viewer.email ?? "Você", email: viewer.email, avatarUrl: viewer.avatarUrl }}
        greeting={greetingFor(viewer.userId)}
        period={period}
        projects={projects}
        finance={finance}
        clients={clients}
        tasks={tasks}
        team={team}
        challenge={gamification.challenge}
        quotes={quotes}
        achievements={gamification.points}
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
