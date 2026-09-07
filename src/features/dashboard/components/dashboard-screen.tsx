import { DashboardGrid, type DashboardGridProps } from "./dashboard-grid";
import { DashboardHeader, type DashboardHeaderProps } from "./dashboard-header";
import styles from "./dashboard-screen.module.css";

export type DashboardScreenProps = DashboardHeaderProps & DashboardGridProps;

// A tela do painel inteira: cabeçalho em cima e a grade de blocos tomando o que sobra. É o que a
// página monta com dados do banco e a prévia monta com dados de exemplo.
export function DashboardScreen({ projects, finance, clients, tasks, team, challenge, ...header }: DashboardScreenProps) {
  return (
    <div className={styles.screen}>
      <DashboardHeader {...header} />
      <DashboardGrid projects={projects} finance={finance} clients={clients} tasks={tasks} team={team} challenge={challenge} />
    </div>
  );
}
