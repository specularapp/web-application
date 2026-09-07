import type { CSSProperties, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { ClientsSummary } from "@/features/clients/summary";
import type { FinanceSummary } from "@/features/finance/summary";
import type { PointsSummary, WeeklyChallenge } from "@/features/gamification/summary";
import type { TeamSummary } from "@/features/organizations/summary";
import type { ProjectsSummary } from "@/features/projects/summary";
import type { QuotesSummary } from "@/features/quotes/summary";
import type { TasksSummary } from "@/features/tasks/summary";
import { squircle } from "@/lib/corners";
import { dashboardBlocks, type DashboardBlockId } from "../blocks";
import { isDefaultLayout, packDashboard, type DashboardLayout } from "../layout";
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
  layout: DashboardLayout;
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
// caixa. Com o layout padrão, a grade é o mapa de áreas nomeadas de sempre. Se a pessoa escondeu ou
// reordenou blocos, a grade entra em `data-custom` e cada bloco chega com a posição calculada por
// `packDashboard` na mesma estrutura, uma vez por largura. O atalho é contorno e pequeno de propósito:
// leva à tela, não é o foco.
export function DashboardGrid({
  layout,
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

  const custom = !isDefaultLayout(layout);
  const blocksById = new Map(dashboardBlocks.map((block) => [block.id, block]));
  const visible = custom
    ? layout.order.filter((id) => !layout.hidden.includes(id)).flatMap((id) => blocksById.get(id) ?? [])
    : dashboardBlocks;
  const slots = custom ? [packDashboard(visible, 1), packDashboard(visible, 2), packDashboard(visible, 3)] : null;

  return (
    <div className={styles.grid} data-custom={custom || undefined}>
      {visible.map((block, index) => {
        // A ordem de leitura vira o atraso da entrada em cascata; no layout mexido, a posição em cada
        // largura vai junto, tudo lido pelo CSS da grade.
        const [one, two, three] = slots?.map((map) => map.get(block.id)) ?? [];
        const vars = {
          "--index": index,
          ...(slots && {
            "--span": one?.span ?? 1,
            "--c1": one?.column,
            "--r1": one?.row,
            "--c2": two?.column,
            "--r2": two?.row,
            "--c3": three?.column,
            "--r3": three?.row,
          }),
        } as CSSProperties;

        return block.bare ? (
          <div key={block.id} className={styles.bare} data-block={block.id} style={vars} {...squircle("xl", { clip: true })}>
            {content[block.id]}
          </div>
        ) : (
          <Card
            key={block.id}
            style={vars}
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
        );
      })}
    </div>
  );
}
