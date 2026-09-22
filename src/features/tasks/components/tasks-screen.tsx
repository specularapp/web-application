import { Topbar } from "@/components/layout/topbar";
import type { AiUsage } from "@/features/ai/summary";
import type { StageOverrides } from "../board-cookie";
import type { TasksBoardData, TasksQuery } from "../list-options";
import type { AppRecord } from "@/features/records/records";
import type { TaskStage } from "../stages";
import type { TaskPerson } from "../summary";
import type { ProjectGlyph } from "../tree";
import type { ProjectHue } from "@/features/projects/summary";
import { TasksBoard } from "./tasks-board";
import type { TaskProjectOption } from "./task-dialog";
import styles from "./tasks-screen.module.css";

export type TasksScreenProps = {
  board: TasksBoardData;
  query: TasksQuery;
  /** O que o cookie guardou de decidido em cada etapa: recolhida, aberta, ou ausente para o padrão dela. */
  collapsed: StageOverrides;
  ai: AiUsage;
  /** O nome do quadro no topo, quando não é o do menu: o do projeto, na página dele. */
  title?: string;
  /** O endereço em que o filtro é escrito: `/tarefas`, ou `/tarefas/<slug>` na página de um projeto. */
  basePath: string;
  /** Quem pode assumir uma tarefa, para os seletores da janela. */
  team?: TaskPerson[];
  /** O índice do que existe na aplicação, para vincular e para marcar no comentário. */
  records?: AppRecord[];
  /** O projeto deste quadro; nulo no balde de tarefas soltas. */
  projectId?: string | null;
  /** Para onde a tarefa pode nascer quando o quadro não é de um projeto. */
  projects?: TaskProjectOption[];
  /** O catálogo de etapas da equipe. */
  stages: TaskStage[];
  /** As etapas que este projeto escolheu; vazio é o que acompanha o catálogo. */
  projectStages?: TaskStage[];
  /** O projeto deste quadro, para trocar a cor dele aqui mesmo. */
  project?: { id: string; name: string; hue: ProjectHue; glyph: ProjectGlyph } | null;
};

// A tela de tarefas inteira: o topo padrão da aplicação, que sangra de ponta a ponta e traz o `h1`, e abaixo
// a prancha com a busca e o quadro, essa sim com o recuo da tela. Server Component: quem tem estado é a
// prancha. Serve o quadro de todas as tarefas e o de um projeto, que é a mesma tela com outra lista, outras
// etapas e outro nome no topo.
export function TasksScreen({ board, query, collapsed, ai, title, basePath, team, records, projectId, projects, stages, projectStages, project }: TasksScreenProps) {
  return (
    <div className={styles.screen}>
      <Topbar ai={ai} title={title} />
      <TasksBoard
        board={board}
        query={query}
        collapsed={collapsed}
        basePath={basePath}
        team={team}
        records={records}
        projectId={projectId}
        projects={projects}
        stages={stages}
        projectStages={projectStages}
        project={project}
      />
    </div>
  );
}
