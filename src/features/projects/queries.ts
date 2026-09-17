import "server-only";
import { cacheKey, cacheTtl, cached } from "@/lib/cache";
import { cacheTags } from "@/lib/cache/tags";
import { getOrganizationContext, requireOrganization } from "@/features/organizations/context";
import type { TaskTreeNode } from "@/features/tasks/tree";
import type { ProjectsListPage, ProjectsQuery } from "./list-options";
import {
  getProject,
  getProjectDetails,
  getProjectTree,
  getProjectsSummary,
  listProjectClients,
  listProjectOwners,
  listProjects,
} from "./service";
import type { Project, ProjectClient, ProjectDetails, ProjectOwnerOption, ProjectsSummary } from "./summary";

/** O que a tela de projetos precisa de uma vez: a página da grade, os clientes e a equipe do formulário. */
export type ProjectsScreenData = {
  page: ProjectsListPage;
  clients: ProjectClient[];
  owners: ProjectOwnerOption[];
};

const queryKey = (query: ProjectsQuery) =>
  [query.search, query.status, query.due, query.tag, query.page, query.pageSize].join("|");

export async function getProjectsScreenData(query: ProjectsQuery, next = "/projetos"): Promise<ProjectsScreenData> {
  const { supabase, organizationId } = await requireOrganization(next);

  const [page, clients, owners] = await Promise.all([
    cached(
      cacheKey(organizationId, "projects:list", queryKey(query)),
      { organizationId, tags: [cacheTags.projects], ttl: cacheTtl.list },
      () => listProjects(supabase, organizationId, query),
    ),
    cached(
      cacheKey(organizationId, "projects:clients"),
      { organizationId, tags: [cacheTags.clients], ttl: cacheTtl.summary },
      () => listProjectClients(supabase, organizationId),
    ),
    cached(
      cacheKey(organizationId, "projects:owners"),
      { organizationId, tags: [cacheTags.organization], ttl: cacheTtl.summary },
      () => listProjectOwners(supabase, organizationId),
    ),
  ]);

  return { page, clients, owners };
}

export async function getProjectById(id: string, next = "/projetos"): Promise<Project | null> {
  const { supabase, organizationId } = await requireOrganization(next);
  return getProject(supabase, organizationId, id);
}

export async function getProjectDetailsById(id: string, next = "/projetos"): Promise<ProjectDetails | null> {
  const { supabase, organizationId } = await requireOrganization(next);
  return getProjectDetails(supabase, organizationId, id);
}

const EMPTY_BLOCK: ProjectsSummary = { total: 0, clientCount: 0, clients: [], months: [] };

/* O bloco do painel abre sem time, porque o painel abre sem time: é nele que a configuração inicial
   aparece por cima, e quem acabou de se cadastrar ainda não tem o que contar. */
export async function getProjectsBlock(): Promise<ProjectsSummary> {
  const context = await getOrganizationContext();
  if (!context) return EMPTY_BLOCK;
  const { supabase, organizationId } = context;

  return cached(
    cacheKey(organizationId, "projects:block"),
    { organizationId, tags: [cacheTags.projects], ttl: cacheTtl.summary },
    () => getProjectsSummary(supabase, organizationId),
  );
}

/** A arquitetura que o menu de tarefas desenha. */
export async function getTasksTree(next = "/tarefas"): Promise<TaskTreeNode[]> {
  const { supabase, organizationId } = await requireOrganization(next);

  return cached(
    cacheKey(organizationId, "projects:tree"),
    { organizationId, tags: [cacheTags.projects], ttl: cacheTtl.shell },
    () => getProjectTree(supabase, organizationId),
  );
}
