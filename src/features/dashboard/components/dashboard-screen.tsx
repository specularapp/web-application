import { DashboardGrid, type DashboardGridProps } from "./dashboard-grid";
import { DashboardHeader, type DashboardHeaderProps } from "./dashboard-header";
import styles from "./dashboard-screen.module.css";

export type DashboardScreenProps = DashboardHeaderProps & DashboardGridProps;

// A tela do painel inteira: cabeçalho em cima, fixo no topo enquanto a página rola, com vidro atrás, e
// a grade de blocos tomando o que sobra. É o que a
// página monta com dados do banco e a prévia monta com dados de exemplo.
export function DashboardScreen({
  projects,
  finance,
  clients,
  tasks,
  team,
  challenge,
  quotes,
  achievements,
  layout,
  ...header
}: DashboardScreenProps) {
  return (
    <div className={styles.screen}>
      <div className={styles.top}>
        <DashboardHeader {...header} layout={layout} />
      </div>
      <DashboardGrid
        projects={projects}
        finance={finance}
        clients={clients}
        tasks={tasks}
        team={team}
        challenge={challenge}
        quotes={quotes}
        achievements={achievements}
        layout={layout}
      />
    </div>
  );
}
