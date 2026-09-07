import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { ClientsSummary } from "@/features/clients/summary";
import type { FinanceSummary } from "@/features/finance/summary";
import type { WeeklyChallenge } from "@/features/gamification/summary";
import type { TeamSummary } from "@/features/organizations/summary";
import type { ProjectsSummary } from "@/features/projects/summary";
import type { TasksSummary } from "@/features/tasks/summary";
import { dashboardBlocks, type DashboardBlockId } from "../blocks";
import { ChallengeBlock } from "./challenge-block";
import { ClientsBlock } from "./clients-block";
import styles from "./dashboard-grid.module.css";
import { FinanceBlock } from "./finance-block";
import { ProjectsBlock } from "./projects-block";
import { TasksBlock } from "./tasks-block";
import { TeamBlock } from "./team-block";

export type DashboardGridProps = {
  projects: ProjectsSummary;
  finance: FinanceSummary;
  clients: ClientsSummary;
  tasks: TasksSummary;
  team: TeamSummary;
  challenge: WeeklyChallenge;
};

// Cada bloco é um cartão com o cabeçalho padrão, e o conteúdo entra um por vez: bloco sem conteúdo
// ainda fica só com a caixa. O atalho é contorno e pequeno de propósito: leva à tela, não é o foco.
export function DashboardGrid({ projects, finance, clients, tasks, team, challenge }: DashboardGridProps) {
  const content: Partial<Record<DashboardBlockId, ReactNode>> = {
    projects: <ProjectsBlock summary={projects} />,
    finance: <FinanceBlock summary={finance} />,
    clients: <ClientsBlock summary={clients} />,
    tasks: <TasksBlock summary={tasks} />,
    team: <TeamBlock summary={team} />,
    challenge: <ChallengeBlock challenge={challenge} />,
  };

  return (
    <div className={styles.grid}>
      {dashboardBlocks.map((block) => (
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
      ))}
    </div>
  );
}
