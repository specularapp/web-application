import "server-only";
import { cacheKey, cacheTtl, cached } from "@/lib/cache";
import { cacheTags } from "@/lib/cache/tags";
import { requireOrganization } from "@/features/organizations/context";
import { listTeamMembers } from "@/features/organizations/service";
import { getProjectTree } from "@/features/projects/service";
import type { AppRecord } from "@/features/records/records";
import { getAppRecords } from "@/features/records/queries";
import type { TasksQuery } from "./list-options";
import { listTasks } from "./service";
import type { Task, TaskPerson } from "./summary";
import { findProject, type TaskProject, type TaskTreeNode } from "./tree";

export type TasksScreenData = {
  tasks: Task[];
  team: TaskPerson[];
  tree: TaskTreeNode[];
  /** O projeto do endereço, quando a página é a de um; nulo no quadro de todas. */
  project: TaskProject | null;
  records: AppRecord[];
};

/**
 * O que o quadro precisa de uma vez: as tarefas, a equipe, a arquitetura e o índice da casa que o `#` do
 * comentário e o vincular registro consultam. O projeto sai da árvore pelo endereço, e não de uma consulta
 * à parte, porque a árvore já veio e a página precisa dela.
 */
export async function loadTasksScreenData(query: TasksQuery, slug?: string, next = "/tarefas"): Promise<TasksScreenData> {
  const { supabase, organizationId } = await requireOrganization(next);
  const tree = await getProjectTree(supabase, organizationId);
  const project = slug ? findProject(tree, slug) : null;

  /* Projeto de identificador nulo é o balde de quem não tem projeto: ali o filtro é "sem projeto", e não
     "deste projeto", que é o que `undefined` significa (todas). */
  const scope = project ? (project.reference === null ? null : project.id) : undefined;

  const [tasks, members, records] = await Promise.all([
    cached(
      cacheKey(organizationId, "tasks:board", slug ?? "todas", query.search, query.priority, query.deadline, query.overdue),
      { organizationId, tags: [cacheTags.tasks], ttl: cacheTtl.list },
      () => listTasks(supabase, organizationId, query, scope),
    ),
    listTeamMembers(supabase, organizationId),
    getAppRecords(next),
  ]);

  return {
    tasks,
    team: members.map((member) => ({ name: member.name || member.email || "Equipe", avatarUrl: member.avatarUrl })),
    tree,
    project,
    records,
  };
}

/** Só a arquitetura, que é o que a concha precisa para desenhar o menu. */
export async function getTasksTreeData(next = "/tarefas"): Promise<TaskTreeNode[]> {
  const { supabase, organizationId } = await requireOrganization(next);
  return getProjectTree(supabase, organizationId);
}
