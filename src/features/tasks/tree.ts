import { defaultStages, stageValues, type TaskStage } from "./stages";
import type { Task } from "./summary";

/**
 * A arquitetura das tarefas: pastas dentro de pastas e, nas folhas, projetos (2026-09-10, a pedido). É ela
 * que o menu abre quando a pasta Tarefas é escolhida, para a pessoa dizer para onde vai antes de ver quadro
 * nenhum, e é ela que dá endereço próprio a cada projeto: `/tarefas/<slug>`.
 *
 * A pasta só organiza; quem tem quadro é o projeto, com as etapas dele. Uma pasta não é um destino, então
 * não tem endereço: clicar nela abre e fecha o galho.
 */

/** Uma pasta: só agrupa, e pode ter pasta dentro, como na referência de arquitetura do usuário. */
export type TaskFolder = {
  kind: "folder";
  id: string;
  name: string;
  children: TaskTreeNode[];
};

/**
 * O desenho de um projeto na árvore, por **chave** e não pelo componente do glifo (2026-09-10, a pedido de
 * cada projeto ter o próprio ícone): a árvore é montada no servidor e entregue ao menu, que é componente de
 * cliente, e o que cruza essa fronteira precisa ser serializável. O menu traduz a chave em glifo, na mesma
 * receita do mapa de tipos de anexo.
 */
export const projectGlyphs = ["kanban", "palette", "globe", "storefront", "megaphone", "binoculars", "tray"] as const;

export type ProjectGlyph = (typeof projectGlyphs)[number];

export type TaskProject = {
  kind: "project";
  id: string;
  /** O endereço da página do quadro: `/tarefas/<slug>`. */
  slug: string;
  name: string;
  /**
   * O identificador do projeto no padrão da casa (`PRJ-2026-0007`), o mesmo que a tarefa carrega, que é como
   * as duas pontas se encontram. **Nulo é o balde de quem não tem projeto**: tarefa solta continua tendo
   * lugar na arquitetura em vez de existir só na lista de todas.
   */
  reference: string | null;
  /** As etapas do quadro deste projeto, na ordem em que as colunas aparecem. */
  stages: TaskStage[];
  /** O glifo do azulejo dele na árvore, que é o que distingue um projeto do outro de relance. */
  glyph: ProjectGlyph;
  /** Token de cor do azulejo, como no `NavGroup`: a linha o passa por variável e o azulejo se tinge. */
  hue: string;
  /**
   * A cara do projeto no menu (2026-09-20, a pedido): a logo dele, a do cliente ou o rosto do cliente, na
   * ordem de `projectFace`. Nulo cai no glifo, que é o que a maioria das contas novas vê.
   */
  imageUrl: string | null;
};

export type TaskTreeNode = TaskFolder | TaskProject;

export const isTaskFolder = (node: TaskTreeNode): node is TaskFolder => node.kind === "folder";

/**
 * A árvore como o menu a desenha: a mesma forma, com a contagem em cada nó e sem as etapas, que são coisa da
 * página. A contagem é **do que está em aberto**, e não do total: no menu ela responde "quanto falta aqui", e
 * o projeto que fechou tudo mostra zero em vez de mostrar a própria história. Pasta soma os filhos.
 */
export type TaskTreeItem =
  | { kind: "folder"; id: string; name: string; open: number; children: TaskTreeItem[] }
  | {
      kind: "project";
      id: string;
      slug: string;
      name: string;
      open: number;
      glyph: ProjectGlyph;
      hue: string;
      /** A cara do projeto, quando ele tem uma: é ela que o azulejo do menu veste no lugar do glifo. */
      imageUrl: string | null;
      /** As etapas do quadro, para o leque do menu arrumá-las sem ir à página. */
      stages: TaskStage[];
      /** O balde das tarefas sem projeto: não se edita nem se apaga. */
      bucket?: boolean;
    };

/** As tarefas de um projeto: as do identificador dele, ou as sem projeto nenhum quando ele é o balde. */
export function tasksOfProject(tasks: Task[], project: TaskProject) {
  if (project.reference === null) return tasks.filter((task) => !task.project);
  return tasks.filter((task) => task.project?.reference === project.reference);
}

/**
 * Quantas tarefas em aberto cada projeto tem, e quantas estão soltas. Vem contado do banco, e não das
 * tarefas carregadas: o menu é redesenhado em toda navegação, e contar carregando as linhas custaria a base
 * inteira por página vista para produzir um inteiro por projeto.
 */
export type TaskOpenCounts = { byProject: Record<string, number>; loose: number };

export const noTaskCounts: TaskOpenCounts = { byProject: {}, loose: 0 };

/** A árvore com as contagens resolvidas, pronta para o menu. Roda no servidor, junto da concha. */
export function buildTaskTree(nodes: TaskTreeNode[], counts: TaskOpenCounts): TaskTreeItem[] {
  return nodes.map((node): TaskTreeItem => {
    if (isTaskFolder(node)) {
      const children = buildTaskTree(node.children, counts);
      return {
        kind: "folder",
        id: node.id,
        name: node.name,
        open: children.reduce((sum, child) => sum + child.open, 0),
        children,
      };
    }

    return {
      kind: "project",
      id: node.id,
      slug: node.slug,
      name: node.name,
      open: node.reference === null ? counts.loose : (counts.byProject[node.id] ?? 0),
      glyph: node.glyph,
      hue: node.hue,
      imageUrl: node.imageUrl,
      stages: node.stages,
      bucket: node.reference === null || undefined,
    };
  });
}

/** Todos os projetos da árvore, achatados, na ordem em que aparecem. */
export function flattenProjects(nodes: TaskTreeNode[]): TaskProject[] {
  return nodes.flatMap((node) => (isTaskFolder(node) ? flattenProjects(node.children) : [node]));
}

/** O projeto de um endereço, ou nulo quando o slug não existe, o que a página trata como 404. */
export function findProject(nodes: TaskTreeNode[], slug: string) {
  return flattenProjects(nodes).find((project) => project.slug === slug) ?? null;
}

/**
 * Os ids das pastas que levam até um projeto, para o menu abrir o galho onde a pessoa está. Anda na árvore
 * contada, que é a que o menu recebe: o menu não conhece as etapas, só o desenho.
 */
export function pathToItem(items: TaskTreeItem[], slug: string, trail: string[] = []): string[] {
  for (const item of items) {
    if (item.kind === "folder") {
      const found = pathToItem(item.children, slug, [...trail, item.id]);
      if (found.length > 0) return found;
    } else if (item.slug === slug) {
      return trail;
    }
  }
  return [];
}

/**
 * As etapas que o quadro de todas as tarefas mostra, na ordem do catálogo: as que **algum projeto escolheu**
 * mais as que alguma tarefa ocupa. Ele cruza projetos com fluxos diferentes, então uma lista fixa esconderia
 * o que está em Publicação ou em Bloqueada, e as etapas que ninguém configurou não viram coluna à toa.
 *
 * As etapas vêm do projeto, e não das tarefas (2026-09-20, a pedido de ver todas as etapas mesmo sem tarefa
 * criada): antes a coluna só existia depois de alguém pôr algo nela, então um quadro novo abria vazio e o
 * caminho que a equipe combinou não aparecia em lugar nenhum. As tarefas continuam entrando na conta para o
 * que está numa etapa que o projeto tirou do quadro depois não sumir da vista.
 */
export function boardStages(tasks: Task[], nodes: TaskTreeNode[]): TaskStage[] {
  const wanted = new Set<TaskStage>([...flattenProjects(nodes).flatMap((project) => project.stages), ...tasks.map((task) => task.stage)]);
  const present = stageValues.filter((stage) => wanted.has(stage));
  return present.length > 0 ? present : defaultStages;
}
