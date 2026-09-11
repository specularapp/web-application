import type { Icon } from "@phosphor-icons/react";
import {
  CheckCircleIcon,
  CircleDashedIcon,
  CircleHalfIcon,
  EyeIcon,
  ProhibitIcon,
  RocketLaunchIcon,
  ThumbsUpIcon,
  TrayIcon,
} from "@phosphor-icons/react/ssr";

/**
 * O catálogo de etapas do quadro de tarefas: cada etapa é uma coluna possível, com nome, glifo, matiz e a
 * situação grossa que ela representa. **Cada projeto escolhe as suas** e em que ordem (2026-09-10, a pedido:
 * "dentro de cada uma terá etapas diferentes"), então o quadro do site institucional tem Publicação e o do
 * Estúdio Bravo tem Bloqueada, sem que uma tela precise saber das etapas da outra.
 *
 * O catálogo é **global e o projeto só seleciona**, em vez de cada projeto inventar as próprias etapas com
 * nomes soltos: é o que mantém `Task.stage` sendo um id que vale em qualquer lugar. Com etapa por projeto, o
 * bloco do painel e a ficha da tarefa teriam de conhecer o projeto para saber se a tarefa está concluída, e
 * o zod da URL não teria uma lista fechada para validar. Nomear uma etapa nova é acrescentar uma linha aqui;
 * nome livre por equipe é para quando isso virar tabela.
 *
 * Do pacote `ssr` como o resto dos mapas leves da casa: este arquivo é lido também no servidor, e a entrada
 * padrão do Phosphor cria contexto ao carregar.
 */

export const stageValues = ["backlog", "todo", "doing", "blocked", "review", "approval", "publishing", "done"] as const;

export type TaskStage = (typeof stageValues)[number];

/** Em que ponto do caminho a etapa está, que é de onde a situação da tarefa é lida. */
export type TaskStageKind = "upcoming" | "ongoing" | "done";

/** Uma etapa como a coluna a desenha: o nome, o glifo do cabeçalho, o matiz da etiqueta e o ponto do caminho. */
export type TaskStageMeta = {
  id: TaskStage;
  label: string;
  icon: Icon;
  /** Token de cor, como no `NavGroup`: a coluna o passa por variável e a etiqueta se tinge sozinha. */
  hue: string;
  kind: TaskStageKind;
};

/* O matiz esquenta conforme a tarefa anda: cinza no que nem entrou na fila, azul no que está por começar,
   laranja no que está sendo feito, vermelho no que travou, roxo na conferência, índigo no aval de quem
   decide, verde-água na publicação e verde no que fechou. É a mesma leitura de cor das etiquetas da casa,
   então a coluna não inventa paleta nenhuma. */
export const taskStageMeta: Record<TaskStage, TaskStageMeta> = {
  backlog: { id: "backlog", label: "Backlog", icon: TrayIcon, hue: "var(--sys-gray)", kind: "upcoming" },
  todo: { id: "todo", label: "A fazer", icon: CircleDashedIcon, hue: "var(--sys-blue)", kind: "upcoming" },
  doing: { id: "doing", label: "Em andamento", icon: CircleHalfIcon, hue: "var(--sys-orange)", kind: "ongoing" },
  blocked: { id: "blocked", label: "Bloqueada", icon: ProhibitIcon, hue: "var(--sys-red)", kind: "ongoing" },
  review: { id: "review", label: "Em revisão", icon: EyeIcon, hue: "var(--sys-purple)", kind: "ongoing" },
  approval: { id: "approval", label: "Aprovação", icon: ThumbsUpIcon, hue: "var(--sys-indigo)", kind: "ongoing" },
  publishing: { id: "publishing", label: "Publicação", icon: RocketLaunchIcon, hue: "var(--sys-teal)", kind: "ongoing" },
  done: { id: "done", label: "Concluída", icon: CheckCircleIcon, hue: "var(--sys-green)", kind: "done" },
};

/** O catálogo inteiro na ordem do caminho, que é a ordem em que as colunas aparecem quando não há projeto. */
export const taskStages: TaskStageMeta[] = stageValues.map((id) => taskStageMeta[id]);

/**
 * As etapas de um projeto que não diz outra coisa, e as do balde de tarefas sem projeto: as cinco de sempre,
 * sem as três que nasceram para fluxos específicos (bloqueio, aval e publicação).
 */
export const defaultStages: TaskStage[] = ["backlog", "todo", "doing", "review", "done"];
