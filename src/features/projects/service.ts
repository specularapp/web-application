import "server-only";
import { differenceInCalendarDays, format } from "date-fns";
import { projectFace, type ProjectFolderOption } from "./summary";
import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeWebsite } from "@/features/organizations/schemas";
import { listTeamMembers } from "@/features/organizations/service";
import { quoteTotals } from "@/features/quotes/totals";
import type { QuoteStatus } from "@/features/quotes/summary";
import { defaultStages, type TaskStage } from "@/features/tasks/stages";
import type { TaskPriority } from "@/features/tasks/summary";
import type { ProjectGlyph, TaskTreeNode } from "@/features/tasks/tree";
import { slugify } from "@/lib/utils/slug";
import { diffFields, logRecordEvent, summarize } from "@/features/records/history";
import type { Database } from "@/types/database";
import { projectHueFor } from "./list-options";
import type { ProjectsListPage, ProjectsQuery } from "./list-options";
import type { ProjectFormInput } from "./schemas";
import type {
  Project,
  ProjectClient,
  ProjectDetails,
  ProjectHue,
  ProjectOwnerOption,
  ProjectStatus,
  ProjectTool,
  ProjectsSummary,
} from "./summary";

/** A regra de projetos contra o banco, na mesma forma dos outros domínios. */
export type ProjectsClient = SupabaseClient<Database>;

export type ServiceResult<T> = { ok: true; data: T } | { ok: false; error: string };

const SAVE_FAILED = "Não foi possível salvar o projeto. Tente de novo em instantes.";

const columns = `
  id, slug, reference, name, url, description, is_public, status, tags, tools, stages, glyph, hue,
  budget_min, budget_max, started_at, due_at, progress, cover_url, logo_url, owner_id, folder_id,
  clients(id, name, company, avatar_url, company_logo_url)
`;

type Row = {
  id: string;
  slug: string;
  reference: string;
  name: string;
  url: string | null;
  description: string;
  is_public: boolean;
  logo_url: string | null;
  status: ProjectStatus;
  tags: string[];
  tools: ProjectTool[];
  stages: TaskStage[];
  glyph: ProjectGlyph;
  hue: ProjectHue;
  budget_min: number | null;
  budget_max: number | null;
  started_at: string;
  due_at: string | null;
  progress: number;
  cover_url: string | null;
  owner_id: string | null;
  folder_id: string | null;
  /* Junção à esquerda, e não interna: projeto sem cliente existe, e com junção interna ele sumia da lista. */
  clients: { id: string; name: string; company: string | null; avatar_url: string | null; company_logo_url: string | null } | null;
};

type Person = { name: string; avatarUrl: string | null };

function toProject(row: Row, owner: Person, memberIds: string[] = []): Project {
  return {
    id: row.id,
    slug: row.slug,
    reference: row.reference,
    name: row.name,
    url: row.url,
    description: row.description,
    isPublic: row.is_public,
    logoUrl: row.logo_url,
    client: row.clients
      ? {
          id: row.clients.id,
          name: row.clients.name,
          company: row.clients.company ?? undefined,
          avatarUrl: row.clients.avatar_url,
          logoUrl: row.clients.company_logo_url,
        }
      : null,
    ownerId: row.owner_id,
    owner,
    memberIds,
    status: row.status,
    tags: row.tags,
    tools: row.tools,
    budget: row.budget_min !== null && row.budget_max !== null ? { min: row.budget_min, max: row.budget_max } : null,
    startedAt: row.started_at,
    dueAt: row.due_at,
    progress: row.progress,
    coverUrl: row.cover_url,
    hue: row.hue,
  };
}

const NOBODY: Person = { name: "Sem responsável", avatarUrl: null };

/** A função no time como a pessoa a lê, usada tanto no seletor do formulário quanto na equipe da ficha. */
const teamRoles: Record<string, string> = { owner: "Dono", admin: "Administrador", member: "Membro" };

/**
 * Quem colabora em cada projeto, numa consulta para a página inteira: com uma por cartão seriam doze idas ao
 * banco para desenhar uma grade, que é a mesma razão de `peopleFor` existir.
 */
async function membersFor(client: ProjectsClient, projectIds: string[]): Promise<Map<string, string[]>> {
  const byProject = new Map<string, string[]>();
  if (projectIds.length === 0) return byProject;

  const { data } = await client.from("project_members").select("project_id, user_id").in("project_id", projectIds);
  for (const row of data ?? []) {
    const list = byProject.get(row.project_id);
    if (list) list.push(row.user_id);
    else byProject.set(row.project_id, [row.user_id]);
  }

  return byProject;
}

/**
 * Deixa `project_members` com exatamente quem o formulário mandou: apaga o que saiu e insere o que entrou, em
 * vez de limpar tudo e regravar, porque limpar tudo perderia o `created_at` de quem continua no projeto.
 */
async function syncMembers(
  client: ProjectsClient,
  organizationId: string,
  projectId: string,
  memberIds: string[],
): Promise<string | undefined> {
  const wanted = [...new Set(memberIds)];
  const { data } = await client.from("project_members").select("user_id").eq("project_id", projectId);
  const current = (data ?? []).map((row) => row.user_id);

  const gone = current.filter((id) => !wanted.includes(id));
  const fresh = wanted.filter((id) => !current.includes(id));

  if (gone.length > 0) {
    const { error } = await client.from("project_members").delete().eq("project_id", projectId).in("user_id", gone);
    if (error) return error.message;
  }

  if (fresh.length > 0) {
    const { error } = await client
      .from("project_members")
      .insert(fresh.map((userId) => ({ project_id: projectId, user_id: userId, organization_id: organizationId })));
    if (error) return error.message;
  }

  return undefined;
}

/** O rosto e o nome de quem responde: uma consulta para a página inteira, e não uma por cartão. */
async function peopleFor(client: ProjectsClient, ids: (string | null)[]) {
  const people = new Map<string, Person>();
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (unique.length === 0) return people;

  const { data } = await client.from("profiles").select("id, full_name, email, avatar_url").in("id", unique);
  for (const row of data ?? []) {
    people.set(row.id, { name: row.full_name || row.email || "Equipe", avatarUrl: row.avatar_url });
  }
  return people;
}

/**
 * A página da grade, filtrada e cortada no banco. As etiquetas e as contagens por situação saem da base
 * inteira, e não da página, senão o menu de filtros ofereceria só o que já está na tela.
 */
export async function listProjects(
  client: ProjectsClient,
  organizationId: string,
  query: ProjectsQuery,
): Promise<ProjectsListPage> {
  let builder = client.from("projects").select(columns, { count: "exact" }).eq("organization_id", organizationId);

  if (query.search) {
    const term = query.search.replace(/[%,()]/g, " ").trim();
    builder = builder.or([`name.ilike.%${term}%`, `reference.ilike.%${term}%`, `description.ilike.%${term}%`].join(","));
  }
  if (query.status !== "todos") builder = builder.eq("status", query.status);
  if (query.tag) builder = builder.contains("tags", [query.tag]);

  /* Prazo só faz sentido em projeto aberto: concluído e cancelado ficam de fora de qualquer janela. O que
     já venceu conta como dentro de qualquer janela, porque é o mais urgente que existe. */
  if (query.due !== "qualquer") {
    const today = format(new Date(), "yyyy-MM-dd");
    builder = builder.in("status", ["active", "paused"]).not("due_at", "is", null);
    if (query.due === "atrasados") {
      builder = builder.lt("due_at", today);
    } else {
      const limit = new Date();
      limit.setDate(limit.getDate() + Number(query.due));
      builder = builder.lte("due_at", format(limit, "yyyy-MM-dd"));
    }
  }

  const start = (query.page - 1) * query.pageSize;
  const [page, all] = await Promise.all([
    builder.order("started_at", { ascending: false }).range(start, start + query.pageSize - 1),
    client.from("projects").select("status, tags").eq("organization_id", organizationId),
  ]);

  const rows = (page.data ?? []) as unknown as Row[];
  const [people, members] = await Promise.all([
    peopleFor(client, rows.map((row) => row.owner_id)),
    membersFor(client, rows.map((row) => row.id)),
  ]);

  const counts: Record<ProjectStatus, number> = { active: 0, paused: 0, done: 0, cancelled: 0 };
  const tags = new Set<string>();
  for (const row of all.data ?? []) {
    counts[row.status as ProjectStatus] += 1;
    for (const tag of row.tags ?? []) tags.add(tag);
  }

  return {
    items: rows.map((row) => toProject(row, (row.owner_id && people.get(row.owner_id)) || NOBODY, members.get(row.id) ?? [])),
    total: page.count ?? rows.length,
    tags: [...tags].sort((a, b) => a.localeCompare(b, "pt-BR")),
    counts,
  };
}

export async function getProject(client: ProjectsClient, organizationId: string, id: string): Promise<Project | null> {
  const { data } = await client
    .from("projects")
    .select(columns)
    .eq("organization_id", organizationId)
    .eq("id", id)
    .maybeSingle();

  if (!data) return null;

  const row = data as unknown as Row;
  const [people, members] = await Promise.all([peopleFor(client, [row.owner_id]), membersFor(client, [row.id])]);
  return toProject(row, (row.owner_id && people.get(row.owner_id)) || NOBODY, members.get(row.id) ?? []);
}

/**
 * A ficha completa, buscada quando a janela abre: o cartão mais a equipe, as tarefas do quadro, os
 * orçamentos do cliente e a atividade recente. Não vai junto da listagem porque doze fichas por página
 * encheriam a carga com o que a grade nem desenha.
 */
export async function getProjectDetails(
  client: ProjectsClient,
  organizationId: string,
  id: string,
): Promise<ProjectDetails | null> {
  const project = await getProject(client, organizationId, id);
  if (!project) return null;

  const [members, tasks, quotes, events, team] = await Promise.all([
    client.from("project_members").select("user_id, role").eq("project_id", id),
    client
      .from("tasks")
      .select("id, reference, title, stage, priority, due_date, owner_id")
      .eq("organization_id", organizationId)
      .eq("project_id", id)
      .order("due_date")
      .limit(50),
    client
      .from("quotes")
      .select("id, reference, title, status, issued_at, discount_kind, discount_value, quote_lines(quantity, unit_price, courtesy)")
      .eq("organization_id", organizationId)
      .eq("client_id", project.client?.id ?? "")
      .order("issued_at", { ascending: false })
      .limit(10),
    client
      .from("project_events")
      .select("id, action, task_title, at, actor_id")
      .eq("project_id", id)
      .order("at", { ascending: false })
      .limit(20),
    listTeamMembers(client, organizationId),
  ]);

  const byUser = new Map(team.map((member) => [member.userId, member]));
  const person = (userId: string | null): Person =>
    (userId && byUser.has(userId)
      ? { name: byUser.get(userId)!.name || byUser.get(userId)!.email || "Equipe", avatarUrl: byUser.get(userId)!.avatarUrl }
      : NOBODY);

  const taskRows = tasks.data ?? [];

  /* A equipe da ficha: **quem responde primeiro**, e os colaboradores depois, na ordem em que entraram. O
     responsável não precisa estar em `project_members` para aparecer aqui, senão a ficha diria que ninguém
     cuida do projeto enquanto o cartão mostra o nome dele (2026-09-17). Sem função escrita no vínculo, vale a
     função que a pessoa tem no time, que é o que o bloco mostrava em branco. */
  const roleInTeam = (userId: string) => teamRoles[byUser.get(userId)?.role ?? ""] ?? "Colaborador";

  const collaborators = (members.data ?? [])
    .filter((member) => member.user_id !== project.ownerId)
    .map((member) => ({
      id: member.user_id,
      role: member.role || roleInTeam(member.user_id),
      ...person(member.user_id),
    }));

  return {
    ...project,
    people: [
      ...(project.ownerId ? [{ id: project.ownerId, role: "Responsável", ...person(project.ownerId) }] : []),
      ...collaborators,
    ],
    tasks: taskRows.map((task) => ({
      id: task.id,
      reference: task.reference,
      title: task.title,
      stage: task.stage as TaskStage,
      priority: task.priority as TaskPriority,
      dueDate: task.due_date,
      owner: person(task.owner_id),
    })),
    openTasks: taskRows.filter((task) => task.stage !== "done").length,
    totalTasks: taskRows.length,
    quotes: (quotes.data ?? []).map((quote) => ({
      id: quote.id,
      number: quote.reference,
      title: quote.title,
      amount: quoteTotals({
        lines: (quote.quote_lines ?? []).map((line) => ({
          quantity: Number(line.quantity),
          unitPrice: line.unit_price,
          courtesy: line.courtesy,
        })),
        discount: quote.discount_kind && quote.discount_value !== null ? { kind: quote.discount_kind, value: quote.discount_value } : null,
        installments: 1,
        cashDiscount: 0,
      }).total,
      status: quote.status as QuoteStatus,
      date: quote.issued_at,
    })),
    activity: (events.data ?? []).map((event) => ({
      id: event.id,
      person: person(event.actor_id),
      action: event.action,
      task: event.task_title ?? undefined,
      at: event.at,
    })),
  };
}

/** O bloco do painel: o total, quantos clientes foram atendidos e os últimos meses. */
export async function getProjectsSummary(
  client: ProjectsClient,
  organizationId: string,
  months = 6,
): Promise<ProjectsSummary> {
  const { data, count } = await client
    .from("projects")
    .select("started_at, status, due_at, progress, clients(id, name, avatar_url, company_logo_url)", { count: "exact" })
    .eq("organization_id", organizationId)
    .order("started_at", { ascending: false })
    .limit(400);

  const rows = data ?? [];
  const clients = new Map<string, { name: string; avatarUrl: string | null }>();
  for (const row of rows) {
    /* Projeto sem cliente não entra na contagem de clientes atendidos, que é o que o bloco mostra. */
    if (row.clients && !clients.has(row.clients.id)) {
      clients.set(row.clients.id, { name: row.clients.name, avatarUrl: row.clients.company_logo_url ?? row.clients.avatar_url });
    }
  }

  const buckets = new Map<string, { started: number; completed: number }>();
  const now = new Date();
  for (let index = months - 1; index >= 0; index -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - index, 1);
    buckets.set(format(date, "yyyy-MM"), { started: 0, completed: 0 });
  }

  for (const row of rows) {
    const started = buckets.get(row.started_at.slice(0, 7));
    if (started) started.started += 1;
    if (row.status === "done" && row.due_at) {
      const completed = buckets.get(row.due_at.slice(0, 7));
      if (completed) completed.completed += 1;
    }
  }

  return {
    total: count ?? rows.length,
    clientCount: clients.size,
    clients: [...clients.values()].slice(0, 6),
    months: [...buckets.entries()].map(([month, values]) => ({ month, ...values })),
  };
}

/**
 * O endereço do quadro de tarefas não repete: dois projetos com o mesmo nome ganham sufixo, como o endereço
 * público do time. Na edição o slug fica o que era, para o quadro não mudar de lugar.
 */
async function uniqueSlug(client: ProjectsClient, organizationId: string, name: string) {
  const base = slugify(name, 60) || "projeto";
  const { data } = await client
    .from("projects")
    .select("slug")
    .eq("organization_id", organizationId)
    .like("slug", `${base}%`);

  const taken = new Set((data ?? []).map((row) => row.slug));
  if (!taken.has(base)) return base;

  let suffix = 2;
  while (taken.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

export async function saveProject(
  client: ProjectsClient,
  organizationId: string,
  input: ProjectFormInput,
): Promise<ServiceResult<{ id: string }>> {
  const budget =
    input.budgetMin === null && input.budgetMax === null
      ? { min: null, max: null }
      : { min: input.budgetMin ?? input.budgetMax ?? 0, max: input.budgetMax ?? input.budgetMin ?? 0 };

  const values = {
    organization_id: organizationId,
    name: input.name,
    url: normalizeWebsite(input.url),
    description: input.description,
    is_public: input.isPublic,
    client_id: input.clientId || null,
    owner_id: input.ownerId || null,
    status: input.status,
    tags: input.tags,
    tools: input.tools,
    budget_min: budget.min,
    budget_max: budget.max,
    started_at: input.startedAt,
    due_at: input.dueAt || null,
    progress: input.progress,
    cover_url: input.coverUrl || null,
  };

  if (input.id) {
    /* O que estava, para o histórico dizer o de e o para. Uma leitura a mais só na edição. */
    const { data: before } = await client
      .from("projects")
      .select("name, url, description, is_public, client_id, owner_id, status, tags, tools, budget_min, budget_max, started_at, due_at, progress")
      .eq("organization_id", organizationId)
      .eq("id", input.id)
      .maybeSingle();

    const { data, error } = await client
      .from("projects")
      .update(values)
      .eq("id", input.id)
      .eq("organization_id", organizationId)
      .select("id")
      .maybeSingle();

    if (error || !data) return { ok: false, error: error?.message || SAVE_FAILED };

    const failed = await syncMembers(client, organizationId, data.id, input.memberIds);
    if (failed) return { ok: false, error: failed };

    const changes = diffFields(before, values, projectHistoryLabels);
    if (changes.length > 0) {
      await logRecordEvent(client, organizationId, { recordType: "project", recordId: data.id, action: "updated", summary: summarize(changes), changes });
    }

    return { ok: true, data: { id: data.id } };
  }

  const { data, error } = await client
    .from("projects")
    .insert({
      ...values,
      slug: await uniqueSlug(client, organizationId, input.name),
      hue: projectHueFor(input.name),
      stages: defaultStages,
    })
    .select("id")
    .single();

  if (error || !data) return { ok: false, error: error?.message || SAVE_FAILED };

  const failed = await syncMembers(client, organizationId, data.id, input.memberIds);
  if (failed) return { ok: false, error: failed };

  await logRecordEvent(client, organizationId, { recordType: "project", recordId: data.id, action: "created", summary: `Criou o projeto ${input.name}` });

  return { ok: true, data: { id: data.id } };
}

/* Os nomes que a pessoa lê no histórico do projeto: só o que ela mesma edita na ficha. */
const projectHistoryLabels = {
  name: "nome",
  url: "site",
  description: "descrição",
  is_public: "público",
  client_id: "cliente",
  owner_id: "responsável",
  status: "situação",
  tags: "etiquetas",
  tools: "ferramentas",
  budget_min: "valor mínimo",
  budget_max: "valor máximo",
  started_at: "começo",
  due_at: "entrega",
  progress: "andamento",
} as const;

export async function deleteProject(
  client: ProjectsClient,
  organizationId: string,
  id: string,
): Promise<ServiceResult<undefined>> {
  const { error } = await client.from("projects").delete().eq("organization_id", organizationId).eq("id", id);
  if (error) return { ok: false, error: error.message };

  /* O histórico sobrevive ao registro: apagar o projeto não apaga quem o apagou. */
  await logRecordEvent(client, organizationId, { recordType: "project", recordId: id, action: "deleted", summary: "Excluiu o projeto" });

  return { ok: true, data: undefined };
}

/** Os clientes que o formulário oferece, em ordem de empresa ou nome. */
export async function listProjectClients(client: ProjectsClient, organizationId: string): Promise<ProjectClient[]> {
  const { data } = await client
    .from("clients")
    .select("id, name, company, avatar_url, company_logo_url")
    .eq("organization_id", organizationId)
    .eq("active", true)
    .order("name");

  /* A logo da empresa vem junto: é ela que a marca do projeto veste quando o projeto não tem logo própria, e
     sem esta coluna a prévia do formulário caía no rosto da pessoa (2026-09-17). */
  return (data ?? [])
    .map((row) => ({
      id: row.id,
      name: row.name,
      company: row.company ?? undefined,
      avatarUrl: row.avatar_url,
      logoUrl: row.company_logo_url,
    }))
    .sort((a, b) => (a.company ?? a.name).localeCompare(b.company ?? b.name, "pt-BR"));
}

/** Quem da equipe pode responder por um projeto, como o seletor do formulário lista. */
export async function listProjectOwners(
  client: ProjectsClient,
  organizationId: string,
): Promise<ProjectOwnerOption[]> {
  const members = await listTeamMembers(client, organizationId);

  return members.map((member) => ({
    id: member.userId,
    name: member.name || member.email || "Equipe",
    role: teamRoles[member.role] ?? "Membro",
    avatarUrl: member.avatarUrl,
  }));
}

/**
 * A arquitetura do menu de tarefas: as pastas da organização, com os projetos nas folhas, mais o balde de
 * quem não tem projeto. Montada aqui, no servidor, porque o menu é componente de cliente e o que cruza essa
 * fronteira precisa ser serializável.
 */
export async function getProjectTree(client: ProjectsClient, organizationId: string): Promise<TaskTreeNode[]> {
  const [folders, projects] = await Promise.all([
    client
      .from("project_folders")
      .select("id, parent_id, name, position")
      .eq("organization_id", organizationId)
      .order("position"),
    client
      .from("projects")
      .select("id, slug, reference, name, stages, glyph, hue, folder_id, status, logo_url, clients(avatar_url, company_logo_url)")
      .eq("organization_id", organizationId)
      .in("status", ["active", "paused"])
      .order("started_at", { ascending: false }),
  ]);

  const leaves = new Map<string | null, TaskTreeNode[]>();
  for (const project of projects.data ?? []) {
    const list = leaves.get(project.folder_id) ?? [];
    list.push({
      kind: "project",
      id: project.id,
      slug: project.slug,
      name: project.name,
      reference: project.reference,
      stages: project.stages as TaskStage[],
      glyph: project.glyph as ProjectGlyph,
      hue: `var(--sys-${project.hue})`,
      imageUrl: projectFace({
        logoUrl: project.logo_url,
        client: project.clients && { avatarUrl: project.clients.avatar_url, logoUrl: project.clients.company_logo_url },
      }),
    });
    leaves.set(project.folder_id, list);
  }

  const children = (parentId: string | null): TaskTreeNode[] => [
    ...(folders.data ?? [])
      .filter((folder) => folder.parent_id === parentId)
      .map((folder) => ({ kind: "folder" as const, id: folder.id, name: folder.name, children: children(folder.id) })),
    ...(leaves.get(parentId) ?? []),
  ];

  return children(null);
}

/**
 * As pastas da organização em lista rasa, do jeito que um seletor precisa: o nome já vem com o caminho
 * inteiro ("Clientes / Aurora"), porque numa lista de escolha a pessoa precisa saber qual "Aurora" é.
 */
export async function listProjectFolders(client: ProjectsClient, organizationId: string): Promise<ProjectFolderOption[]> {
  const { data } = await client
    .from("project_folders")
    .select("id, parent_id, name, position")
    .eq("organization_id", organizationId)
    .order("position");

  const rows = data ?? [];
  const walk = (parentId: string | null, trail: string[]): ProjectFolderOption[] =>
    rows
      .filter((row) => row.parent_id === parentId)
      .flatMap((row) => {
        const path = [...trail, row.name];
        return [{ id: row.id, name: row.name, path: path.join(" / "), depth: trail.length }, ...walk(row.id, path)];
      });

  return walk(null, []);
}

/** Cria uma pasta, ou renomeia a que veio com id. A posição nasce no fim do nível, que é onde a última entra. */
export async function saveProjectFolder(
  client: ProjectsClient,
  organizationId: string,
  input: { id?: string; name: string; parentId: string | null },
): Promise<ServiceResult<{ id: string }>> {
  if (input.id) {
    const { data, error } = await client
      .from("project_folders")
      .update({ name: input.name, parent_id: input.parentId })
      .eq("id", input.id)
      .eq("organization_id", organizationId)
      .select("id")
      .maybeSingle();

    if (error || !data) return { ok: false, error: error?.message || SAVE_FAILED };
    return { ok: true, data: { id: data.id } };
  }

  /* Quantas já existem no mesmo nível, para a nova entrar no fim. O filtro do pai muda de operador conforme
     ele exista ou não: `is` só aceita nulo, e `eq` não acha nulo nenhum. */
  const level = client.from("project_folders").select("id", { count: "exact", head: true }).eq("organization_id", organizationId);
  const { count } = await (input.parentId ? level.eq("parent_id", input.parentId) : level.is("parent_id", null));

  const { data, error } = await client
    .from("project_folders")
    .insert({ organization_id: organizationId, name: input.name, parent_id: input.parentId, position: count ?? 0 })
    .select("id")
    .single();

  if (error || !data) return { ok: false, error: error?.message || SAVE_FAILED };
  return { ok: true, data: { id: data.id } };
}

/**
 * Apaga uma pasta. Os projetos dentro dela **não** somem: o vínculo é `on delete set null`, então eles voltam
 * para a raiz da árvore. Pasta é organização, e apagar a gaveta não é apagar o que estava nela.
 */
export async function deleteProjectFolder(
  client: ProjectsClient,
  organizationId: string,
  id: string,
): Promise<ServiceResult<undefined>> {
  const { error } = await client.from("project_folders").delete().eq("id", id).eq("organization_id", organizationId);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: undefined };
}

/** Move um projeto para uma pasta, ou para a raiz quando ela é nula. */
export async function moveProject(
  client: ProjectsClient,
  organizationId: string,
  input: { id: string; folderId: string | null },
): Promise<ServiceResult<undefined>> {
  const { error } = await client
    .from("projects")
    .update({ folder_id: input.folderId })
    .eq("id", input.id)
    .eq("organization_id", organizationId);

  if (error) return { ok: false, error: error.message };
  return { ok: true, data: undefined };
}

/** Quanto falta para a entrega, em dias: negativo é atraso. Usado pelo aviso da ficha e pelo menu. */
export const daysToDue = (dueAt: string) => differenceInCalendarDays(new Date(dueAt), new Date());

/** A situação do projeto, pelo leque: pausar, retomar, concluir. Escrita própria, e não a ficha inteira. */
export async function setProjectStatus(
  client: ProjectsClient,
  organizationId: string,
  id: string,
  status: ProjectStatus,
): Promise<ServiceResult<undefined>> {
  const { data, error } = await client
    .from("projects")
    .update({ status, ...(status === "done" ? { progress: 100 } : {}) })
    .eq("id", id)
    .eq("organization_id", organizationId)
    .select("id")
    .maybeSingle();

  if (error || !data) return { ok: false, error: error?.message || SAVE_FAILED };

  await logRecordEvent(client, organizationId, {
    recordType: "project",
    recordId: id,
    action: "updated",
    summary: status === "paused" ? "Pausou o projeto" : status === "done" ? "Concluiu o projeto" : status === "cancelled" ? "Cancelou o projeto" : "Retomou o projeto",
    changes: [{ field: "status", label: "situação", from: null, to: status }],
  });

  return { ok: true, data: undefined };
}

/**
 * As etapas do quadro do projeto, na ordem das colunas. Uma tarefa numa etapa que saiu fica onde está e some
 * do quadro até a etapa voltar; o gatilho do banco cuida de as novas só nascerem em etapa que existe.
 */
export async function setProjectStages(
  client: ProjectsClient,
  organizationId: string,
  id: string,
  stages: TaskStage[],
): Promise<ServiceResult<undefined>> {
  const { data, error } = await client
    .from("projects")
    .update({ stages })
    .eq("id", id)
    .eq("organization_id", organizationId)
    .select("id")
    .maybeSingle();

  if (error || !data) return { ok: false, error: error?.message || SAVE_FAILED };
  return { ok: true, data: undefined };
}

/** Entra ou sai da vitrine pública. Escrita própria, porque a página do portfólio não tem a ficha em mãos. */
export async function setProjectPublic(
  client: ProjectsClient,
  organizationId: string,
  id: string,
  isPublic: boolean,
): Promise<ServiceResult<undefined>> {
  const { data, error } = await client
    .from("projects")
    .update({ is_public: isPublic })
    .eq("id", id)
    .eq("organization_id", organizationId)
    .select("id")
    .maybeSingle();

  if (error || !data) return { ok: false, error: error?.message || SAVE_FAILED };

  await logRecordEvent(client, organizationId, {
    recordType: "project",
    recordId: id,
    action: "updated",
    summary: isPublic ? "Colocou no portfólio" : "Tirou do portfólio",
    changes: [{ field: "is_public", label: "público", from: isPublic ? "não" : "sim", to: isPublic ? "sim" : "não" }],
  });

  return { ok: true, data: undefined };
}
