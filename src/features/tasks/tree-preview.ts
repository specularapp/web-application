import { formatReference } from "@/lib/utils/reference";
import { defaultStages, type TaskStage } from "./stages";
import type { ProjectGlyph, TaskTreeNode } from "./tree";

/**
 * A arquitetura de exemplo enquanto pastas e projetos não existem no banco: duas pastas na raiz, uma pasta
 * dentro de uma delas e, no fim, o balde de quem não tem projeto. Quem montar a tabela troca só a origem,
 * porque a contagem é calculada em cima das tarefas por `buildTaskTree`.
 *
 * Cada projeto declara duas coisas próprias. As **etapas** do quadro dele, e é aqui que dá para ver que elas
 * são diferentes de verdade: o site institucional tem Publicação, a Padaria Aurora troca a revisão pelo
 * Aprovação de quem decide, o Estúdio Bravo tem Bloqueada, e o design system usa as cinco de sempre. E o
 * **glifo com o matiz** do azulejo na árvore (2026-09-10, a pedido), que é o que distingue um projeto do
 * outro de relance, no lugar do mesmo ícone repetido em toda linha.
 */

type ProjectInput = {
  id: string;
  name: string;
  /** A sequência do identificador do projeto; nulo é o balde de quem não tem projeto. */
  sequence: number | null;
  glyph: ProjectGlyph;
  hue: string;
  stages?: TaskStage[];
};

const project = ({ id, name, sequence, glyph, hue, stages = defaultStages }: ProjectInput) =>
  ({
    kind: "project" as const,
    id,
    slug: id,
    name,
    reference: sequence === null ? null : formatReference("project", 2026, sequence),
    stages,
    glyph,
    hue,
  }) satisfies Extract<TaskTreeNode, { kind: "project" }>;

export const previewTaskTree: TaskTreeNode[] = [
  {
    kind: "folder",
    id: "produto",
    name: "Produto",
    children: [
      project({ id: "design-system", name: "Design system", sequence: 7, glyph: "palette", hue: "var(--sys-purple)" }),
      project({
        id: "site-institucional",
        name: "Site institucional",
        sequence: 11,
        glyph: "globe",
        hue: "var(--sys-blue)",
        stages: ["todo", "doing", "review", "publishing", "done"],
      }),
    ],
  },
  {
    kind: "folder",
    id: "clientes",
    name: "Clientes",
    children: [
      project({
        id: "padaria-aurora",
        name: "Padaria Aurora",
        sequence: 14,
        glyph: "storefront",
        hue: "var(--sys-orange)",
        stages: ["todo", "doing", "approval", "done"],
      }),
      project({
        id: "estudio-bravo",
        name: "Estúdio Bravo",
        sequence: 16,
        glyph: "megaphone",
        hue: "var(--sys-pink)",
        stages: ["backlog", "todo", "doing", "blocked", "review", "done"],
      }),
      {
        kind: "folder",
        id: "prospeccao",
        name: "Prospecção",
        children: [
          project({
            id: "novos-contatos",
            name: "Novos contatos",
            sequence: 19,
            glyph: "binoculars",
            hue: "var(--sys-cyan)",
            stages: ["todo", "doing", "done"],
          }),
        ],
      },
    ],
  },
  /* O balde fica na raiz e por último: é onde mora o que ainda não foi para projeto nenhum, e sem ele essas
     tarefas existiriam só na lista de todas. */
  project({ id: "sem-projeto", name: "Sem projeto", sequence: null, glyph: "tray", hue: "var(--sys-gray)" }),
];
