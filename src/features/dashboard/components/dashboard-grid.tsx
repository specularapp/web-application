import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { ProjectsSummary } from "@/features/projects/summary";
import { dashboardBlocks, type DashboardBlockId } from "../blocks";
import styles from "./dashboard-grid.module.css";
import { ProjectsBlock } from "./projects-block";

export type DashboardGridProps = {
  projects: ProjectsSummary;
};

// Cada bloco é um cartão com o cabeçalho padrão, e o conteúdo entra um por vez: bloco sem conteúdo
// ainda fica só com a caixa. O atalho é contorno e pequeno de propósito: leva à tela, não é o foco.
export function DashboardGrid({ projects }: DashboardGridProps) {
  const content: Partial<Record<DashboardBlockId, ReactNode>> = {
    projects: <ProjectsBlock summary={projects} />,
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
