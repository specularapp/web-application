import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { ClientsSummary } from "@/features/clients/summary";
import type { FinanceSummary } from "@/features/finance/summary";
import type { PointsSummary, WeeklyChallenge } from "@/features/gamification/summary";
import type { TeamSummary } from "@/features/organizations/summary";
import type { ProjectsSummary } from "@/features/projects/summary";
import type { QuotesSummary } from "@/features/quotes/summary";
import type { TasksSummary } from "@/features/tasks/summary";
import { dashboardBlocks, type DashboardBlockId } from "../blocks";
import { AchievementsBlock } from "./achievements-block";
import { ChallengeBlock } from "./challenge-block";
import { ClientsBlock } from "./clients-block";
import styles from "./dashboard-grid.module.css";
import { FinanceBlock } from "./finance-block";
import { ProjectsBlock } from "./projects-block";
import { QuoteBlock } from "./quote-block";
import { TasksBlock } from "./tasks-block";
import { TeamBlock } from "./team-block";

export type DashboardGridProps = {
  projects: ProjectsSummary;
  finance: FinanceSummary;
  clients: ClientsSummary;
  tasks: TasksSummary;
  team: TeamSummary;
  challenge: WeeklyChallenge;
  quotes: QuotesSummary;
  achievements: PointsSummary;
};

// Cada bloco é um cartão com o cabeçalho padrão, menos o que se declara `bare`, que desenha a própria
// caixa e entra direto na área da grade. O atalho é contorno e pequeno de propósito: leva à tela, não é
// o foco.
export function DashboardGrid({
  projects,
  finance,
  clients,
  tasks,
  team,
  challenge,
  quotes,
  achievements,
}: DashboardGridProps) {
  const content: Partial<Record<DashboardBlockId, ReactNode>> = {
    projects: <ProjectsBlock summary={projects} />,
    achievements: <AchievementsBlock summary={achievements} />,
    finance: <FinanceBlock summary={finance} />,
    clients: <ClientsBlock summary={clients} />,
    tasks: <TasksBlock summary={tasks} />,
    team: <TeamBlock summary={team} />,
    challenge: <ChallengeBlock challenge={challenge} />,
    quote: <QuoteBlock summary={quotes} />,
  };

  return (
    <div className={styles.grid}>
      {dashboardBlocks.map((block) =>
        block.bare ? (
          <div key={block.id} className={styles.bare} data-block={block.id}>
            {content[block.id]}
          </div>
        ) : (
          <Card
            key={block.id}
            title={block.title}
            icon={<block.icon />}
            action={
              block.action && (
                <Button href={block.action.href} variant="outline" size="sm" radius="md">
                  {block.action.label}
                </Button>
              )
            }
            data-block={block.id}
          >
            {content[block.id]}
          </Card>
        ),
      )}
    </div>
  );
}
