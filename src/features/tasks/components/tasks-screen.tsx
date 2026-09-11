import { Topbar } from "@/components/layout/topbar";
import type { AiUsage } from "@/features/ai/summary";
import type { StageOverrides } from "../board-cookie";
import type { TasksBoardData, TasksQuery } from "../list-options";
import type { AppRecord } from "@/features/records/records";
import type { TaskPerson } from "../summary";
import { TasksBoard } from "./tasks-board";
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
};

// A tela de tarefas inteira: o topo padrão da aplicação, que sangra de ponta a ponta e traz o `h1`, e abaixo
// a prancha com a busca e o quadro, essa sim com o recuo da tela. Server Component: quem tem estado é a
// prancha. Serve o quadro de todas as tarefas e o de um projeto, que é a mesma tela com outra lista, outras
// etapas e outro nome no topo.
export function TasksScreen({ board, query, collapsed, ai, title, basePath, team, records }: TasksScreenProps) {
  return (
    <div className={styles.screen}>
      <Topbar ai={ai} title={title} />
      <TasksBoard board={board} query={query} collapsed={collapsed} basePath={basePath} team={team} records={records} />
    </div>
  );
}
