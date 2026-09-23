import "server-only";
import { dbMessage } from "@/lib/db/message";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import type { SupabaseClient } from "@supabase/supabase-js";
import { listTeamMembers } from "@/features/organizations/service";
import { docText, type DocNode } from "@/lib/rich-doc";
import type { Json } from "@/types/database";
import { diffFields, logRecordEvent, summarize } from "@/features/records/history";
import type { Database } from "@/types/database";
import type { TasksQuery } from "./list-options";
import { DEFAULT_TASK_TITLE, type ConfigureStagesInput, type SaveStageInput, type TaskChangeInput, type TaskFormInput } from "./schemas";
import type { TaskStage, TaskStageGlyph, TaskStageKind } from "./stages";
import type { TaskOpenCounts } from "./tree";
import type {
  Subtask,
  Task,
  TaskAttachment,
  TaskAttachmentType,
  TaskEvent,
  TaskLink,
  TaskMention,
  TaskPerson,
  TaskPriority,
  TasksSummary,
} from "./summary";
import { ATTACHMENT_ONLY } from "./summary";
import { estimateLabel, priorityLabels } from "./labels";

/** A regra das tarefas contra o banco, na mesma forma dos outros domínios. */
export type TasksClient = SupabaseClient<Database>;

export type ServiceResult<T> = { ok: true; data: T } | { ok: false; error: string };

const SAVE_FAILED = "Não foi possível salvar a tarefa. Tente de novo em instantes.";

/* A árvore do documento entra numa coluna `jsonb`, e o tipo gerado do banco a descreve como `Json`. As duas
   formas são a mesma coisa em tempo de execução; a conversão é só para o TypeScript, porque `DocNode` tem
   campos opcionais que o `Json` recursivo não sabe casar. */
const asJson = (doc: DocNode | null) => doc as unknown as Json;

/** O quadro carrega as colunas inteiras, então o teto é o que protege a tela de uma base grande. */
const BOARD_LIMIT = 500;

/* Os campos que o cartão do quadro desenha. Conversa e anexo entram só como **contagem**, e o vínculo não
   entra: é a diferença entre carregar quatro junções por cartão e carregar nenhuma. A ficha, que é quem
   mostra as três coisas, busca o resto quando a janela abre. */
const boardColumns = `
  id, reference, project_id, title, description, due_date, start_date, estimate_minutes, stage_id, priority,
  owner_id, tags, alert, position,
  task_stages!inner(id, name, hue, glyph, kind),
  projects(name, reference, slug),
  task_people(user_id),
  subtasks(id, title, done, assignee_id, priority, due_date, position),
  task_attachments(count),
  task_events(count),
  task_links(count)
`;

/* A ficha inteira, buscada quando a janela abre: aí sim a conversa, os anexos e os vínculos por completo. */
const fullColumns = `
  id, reference, project_id, title, description, description_doc, due_date, start_date, estimate_minutes, stage_id, priority,
  owner_id, tags, alert, position,
  task_stages!inner(id, name, hue, glyph, kind),
  projects(name, reference, slug),
  task_people(user_id),
  subtasks(id, title, done, assignee_id, priority, due_date, position),
  task_attachments(id, name, type, url, size_bytes, label, event_id, created_at),
  task_events(id, actor_id, action, kind, mentions, audio_url, audio_seconds, at),
  task_links(id, position, client_id, quote_id, linked_project_id, contract_id,
    clients(id, reference, name, company, avatar_url, company_logo_url),
    quotes(id, reference, title, client_name),
    projects!task_links_linked_project_id_fkey(id, reference, name, description),
    contracts(id, reference, title, description))
`;

type LinkRow = {
  id: string;
  position: number;
  client_id: string | null;
  quote_id: string | null;
  linked_project_id: string | null;
  contract_id: string | null;
  clients: { id: string; reference: string; name: string; company: string | null; avatar_url: string | null; company_logo_url: string | null } | null;
  quotes: { id: string; reference: string; title: string; client_name: string } | null;
  projects: { id: string; reference: string; name: string; description: string } | null;
  contracts: { id: string; reference: string; title: string; description: string } | null;
};

type Counted = { count: number }[];

/** A etapa como a linha do banco a traz, que é o que o modelo mostra sem mais consulta nenhuma. */
type StageRow = { id: string; name: string; hue: TaskStage["hue"]; glyph: TaskStageGlyph; kind: TaskStageKind };

const toStage = (row: StageRow): TaskStage => ({ id: row.id, name: row.name, hue: row.hue, glyph: row.glyph, kind: row.kind });

type BoardRow = Omit<Row, "task_attachments" | "task_events" | "task_links"> & {
  task_attachments: Counted;
  task_events: Counted;
  task_links: Counted;
};

type Row = {
  id: string;
  reference: string;
  project_id: string | null;
  title: string;
  description: string;
  /* Só a ficha carrega o documento: o cartão do quadro vive do texto puro, e a árvore inteira por cartão
     encheria a carga do quadro com o que ele nem desenha. */
  description_doc?: DocNode | null;
  due_date: string;
  start_date: string | null;
  estimate_minutes: number | null;
  stage_id: string;
  task_stages: StageRow;
  priority: TaskPriority;
  owner_id: string | null;
  tags: string[];
  alert: string | null;
  position: number;
  projects: { name: string; reference: string; slug: string } | null;
  task_people: { user_id: string }[];
  subtasks: {
    id: string;
    title: string;
    done: boolean;
    assignee_id: string | null;
    priority: TaskPriority | null;
    due_date: string | null;
    position: number;
  }[];
  task_attachments: {
    id: string;
    name: string;
    type: TaskAttachmentType;
    url: string;
    size_bytes: number | null;
    label: string | null;
    event_id: string | null;
    created_at: string;
  }[];
  task_events: {
    id: string;
    actor_id: string | null;
    action: string;
    kind: "comment" | "change";
    mentions: TaskMention[];
    audio_url: string | null;
    audio_seconds: number | null;
    at: string;
  }[];
  task_links: LinkRow[];
};

const NOBODY: TaskPerson = { name: "Sem responsável", avatarUrl: null };

/** O tamanho como a pessoa lê, que é o que o cartão de anexo mostra. */
function readableSize(bytes: number | null) {
  if (bytes === null) return undefined;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

function toAttachment(row: Row["task_attachments"][number]): TaskAttachment {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    url: row.url,
    size: readableSize(row.size_bytes),
    label: row.label ?? undefined,
  };
}

/**
 * O vínculo com o registro do outro lado. Cada tipo tem a própria chave estrangeira, então o que chega é a
 * linha de verdade e não um id solto: registro apagado leva o vínculo junto, e a ficha nunca mostra um
 * documento que não existe mais.
 */
function toLink(row: LinkRow): TaskLink | null {
  if (row.clients) {
    return {
      id: row.clients.id,
      kind: "client",
      reference: row.clients.reference,
      name: row.clients.name,
      caption: row.clients.company ?? undefined,
      media: { kind: "face", name: row.clients.name, src: row.clients.avatar_url ?? row.clients.company_logo_url },
    };
  }
  if (row.quotes) {
    return {
      id: row.quotes.id,
      kind: "quote",
      reference: row.quotes.reference,
      name: row.quotes.title,
      caption: row.quotes.client_name,
    };
  }
  if (row.projects) {
    return {
      id: row.projects.id,
      kind: "project",
      reference: row.projects.reference,
      name: row.projects.name,
      caption: row.projects.description || undefined,
    };
  }
  if (row.contracts) {
    return {
      id: row.contracts.id,
      kind: "contract",
      reference: row.contracts.reference,
      name: row.contracts.title,
      caption: row.contracts.description || undefined,
    };
  }
  return null;
}

/**
 * O cartão do quadro. As listas de anexo e de conversa chegam como contagem, e o cartão só lê o tamanho
 * delas, então elas viram listas de marcadores vazios: é o que mantém um mapeador só para as duas telas sem
 * o cartão precisar saber que está incompleto. Abrir a ficha troca isto pelo conteúdo de verdade.
 */
function toBoardTask(row: BoardRow, people: Map<string, TaskPerson>): Task {
  const placeholders = (count: number) =>
    Array.from({ length: count }, (_, index) => ({ id: `${row.id}-${index}` }) as TaskAttachment);

  return {
    ...toTask({ ...row, task_attachments: [], task_events: [], task_links: [] }, people),
    attachments: placeholders(row.task_attachments[0]?.count ?? 0),
    activity: Array.from({ length: row.task_events[0]?.count ?? 0 }, (_, index) => ({ id: `${row.id}-e${index}` }) as TaskEvent),
    links: Array.from({ length: row.task_links[0]?.count ?? 0 }, (_, index) => ({ id: `${row.id}-l${index}` }) as TaskLink),
  };
}

function toTask(row: Row, people: Map<string, TaskPerson>): Task {
  const person = (id: string | null) => (id && people.get(id)) || NOBODY;
  const owner = person(row.owner_id);

  const subtasks: Subtask[] = [...row.subtasks]
    .sort((a, b) => a.position - b.position)
    .map((subtask) => ({
      id: subtask.id,
      title: subtask.title,
      done: subtask.done,
      person: subtask.assignee_id ? person(subtask.assignee_id) : undefined,
      priority: subtask.priority ?? undefined,
      dueDate: subtask.due_date ?? undefined,
    }));

  const filesByEvent = new Map<string, TaskAttachment[]>();
  const attachments: TaskAttachment[] = [];
  for (const file of row.task_attachments) {
    if (file.event_id) {
      const list = filesByEvent.get(file.event_id) ?? [];
      list.push(toAttachment(file));
      filesByEvent.set(file.event_id, list);
    } else {
      attachments.push(toAttachment(file));
    }
  }

  const activity: TaskEvent[] = [...row.task_events]
    .sort((a, b) => b.at.localeCompare(a.at))
    .map((event) => ({
      id: event.id,
      person: person(event.actor_id),
      action: event.action,
      kind: event.kind,
      mentions: event.mentions?.length ? event.mentions : undefined,
      files: filesByEvent.get(event.id),
      audio: event.audio_url && event.audio_seconds ? { url: event.audio_url, seconds: event.audio_seconds } : undefined,
      at: event.at.slice(0, 16),
    }));

  return {
    id: row.id,
    reference: row.reference,
    title: row.title,
    description: row.description,
    descriptionDoc: row.description_doc ?? null,
    dueDate: row.due_date,
    startDate: row.start_date ?? undefined,
    estimate: row.estimate_minutes ?? undefined,
    stage: toStage(row.task_stages),
    priority: row.priority,
    owner,
    people: [owner, ...row.task_people.map((entry) => person(entry.user_id)).filter((entry) => entry !== owner)],
    project: row.projects
      ? { id: row.project_id ?? "", name: row.projects.name, reference: row.projects.reference, slug: row.projects.slug }
      : undefined,
    links: [...row.task_links].sort((a, b) => a.position - b.position).map(toLink).filter((link): link is TaskLink => link !== null),
    tags: row.tags,
    alert: row.alert ?? undefined,
    subtasks,
    attachments,
    activity,
  };
}

async function peopleOf(client: TasksClient, organizationId: string) {
  const members = await listTeamMembers(client, organizationId);
  return new Map<string, TaskPerson>(
    members.map((member) => [member.userId, { id: member.userId, name: member.name || member.email || "Equipe", avatarUrl: member.avatarUrl }]),
  );
}

/**
 * As tarefas que o quadro desenha. Prioridade, prazo e projeto viram condição de SQL; a busca e o "atrasadas"
 * continuam em `buildTasksBoard`, que é quem já faz essas contas para desenhar o cartão.
 */
export async function listTasks(
  client: TasksClient,
  organizationId: string,
  query: TasksQuery,
  projectId?: string | null,
): Promise<Task[]> {
  let builder = client.from("tasks").select(boardColumns).eq("organization_id", organizationId);

  if (projectId === null) builder = builder.is("project_id", null);
  else if (projectId) builder = builder.eq("project_id", projectId);

  if (query.priority !== "todas") builder = builder.eq("priority", query.priority);
  if (query.deadline !== "sempre") {
    const limit = new Date();
    limit.setDate(limit.getDate() + Number(query.deadline));
    builder = builder.lte("due_date", format(limit, "yyyy-MM-dd"));
  }

  const [{ data }, people] = await Promise.all([
    builder.order("due_date").limit(BOARD_LIMIT),
    peopleOf(client, organizationId),
  ]);

  return ((data ?? []) as unknown as BoardRow[]).map((row) => toBoardTask(row, people));
}

/** O id de uma tarefa pelo identificador que a pessoa lê (`TAR-2026-0005`), para o endereço poder usá-lo. */
export async function findTaskId(client: TasksClient, organizationId: string, reference: string): Promise<string | null> {
  const { data } = await client.from("tasks").select("id").eq("organization_id", organizationId).eq("reference", reference).maybeSingle();
  return data?.id ?? null;
}

/** A ficha inteira, com os arquivos do balde privado já trocados por endereços assinados. */
export async function getTask(client: TasksClient, organizationId: string, id: string): Promise<Task | null> {
  const [{ data }, people] = await Promise.all([
    client.from("tasks").select(fullColumns).eq("organization_id", organizationId).eq("id", id).maybeSingle(),
    peopleOf(client, organizationId),
  ]);

  if (!data) return null;
  const row = data as unknown as Row;
  const signed = await signStored(client, [...row.task_attachments.map((file) => file.url), ...row.task_events.map((event) => event.audio_url)]);
  const sign = (url: string) => signed.get(url) ?? url;

  return {
    ...toTask(
      {
        ...row,
        task_attachments: row.task_attachments.map((file) => ({ ...file, url: sign(file.url) })),
        task_events: row.task_events.map((event) => ({ ...event, audio_url: event.audio_url ? sign(event.audio_url) : null })),
      },
      people,
    ),
    loaded: true,
  };
}

/** O bloco do painel: as tarefas mais próximas do vencimento que ainda não fecharam. */
export async function getTasksSummary(
  client: TasksClient,
  organizationId: string,
  limit = 5,
): Promise<TasksSummary> {
  const [{ data }, people] = await Promise.all([
    client
      .from("tasks")
      .select(boardColumns)
      .eq("organization_id", organizationId)
      /* Em aberto é a etapa que não fecha, e quem sabe disso é a linha da etapa: o filtro vai sobre a
         junção, que é interna, então ele recorta as tarefas e não só o que vem junto delas. */
      .neq("task_stages.kind", "done")
      .order("due_date")
      .limit(limit),
    peopleOf(client, organizationId),
  ]);

  return { tasks: ((data ?? []) as unknown as BoardRow[]).map((row) => toBoardTask(row, people)) };
}

export async function saveTask(
  client: TasksClient,
  organizationId: string,
  input: TaskFormInput,
  actorId: string | null = null,
): Promise<ServiceResult<{ id: string }>> {
  const values = {
    organization_id: organizationId,
    project_id: input.projectId,
    title: input.title,
    /* O texto puro é derivado aqui, e não mandado pela tela: é o que a busca varre, e deixar a tela
       escrevê-lo abriria espaço para um dizer uma coisa e o outro dizer outra. */
    description: docText(input.description).slice(0, 20000),
    description_doc: asJson(input.description),
    due_date: input.dueDate,
    start_date: input.startDate || null,
    estimate_minutes: input.estimate,
    stage_id: input.stageId,
    priority: input.priority,
    owner_id: input.ownerId,
    tags: input.tags,
    alert: input.alert || null,
  };

  if (input.id) {
    const { data: before } = await client
      .from("tasks")
      .select("title, description, due_date, start_date, estimate_minutes, stage_id, priority, owner_id, tags, alert, project_id")
      .eq("organization_id", organizationId)
      .eq("id", input.id)
      .maybeSingle();

    const { data, error } = await client
      .from("tasks")
      .update(values)
      .eq("id", input.id)
      .eq("organization_id", organizationId)
      .select("id")
      .maybeSingle();

    if (error || !data) return { ok: false, error: dbMessage(error, SAVE_FAILED) };

    const changes = diffFields(before, values, taskHistoryLabels);
    if (changes.length > 0) {
      await logRecordEvent(client, organizationId, { recordType: "task", recordId: data.id, action: "updated", summary: summarize(changes), changes });
    }
    if (before) await logTaskActivity(client, organizationId, actorId, data.id, await describeSave(client, organizationId, before, values));

    return { ok: true, data: { id: data.id } };
  }

  const { data, error } = await client.from("tasks").insert(values).select("id").single();
  if (error || !data) return { ok: false, error: dbMessage(error, SAVE_FAILED) };

  await logRecordEvent(client, organizationId, { recordType: "task", recordId: data.id, action: "created", summary: `Criou a tarefa ${input.title}` });

  return { ok: true, data: { id: data.id } };
}

/* Os nomes que a pessoa lê no histórico da tarefa. Mover de coluna não entra: é o gesto mais frequente do
   quadro e encheria a linha do tempo com o que a própria coluna já conta. */
const taskHistoryLabels = {
  title: "título",
  description: "descrição",
  due_date: "prazo",
  start_date: "começo",
  estimate_minutes: "estimativa",
  priority: "prioridade",
  owner_id: "responsável",
  tags: "etiquetas",
  alert: "aviso",
} as const;

/** Mover o cartão de coluna: a única escrita que o quadro faz ao arrastar. */
export async function moveTask(
  client: TasksClient,
  organizationId: string,
  id: string,
  stageId: string,
  position: number,
  actorId: string | null = null,
): Promise<ServiceResult<undefined>> {
  const { error } = await client
    .from("tasks")
    .update({ stage_id: stageId, position })
    .eq("id", id)
    .eq("organization_id", organizationId);

  if (error) return { ok: false, error: dbMessage(error, "Não foi possível concluir a operação. Tente de novo em instantes.") };
  const stage = await stageName(client, stageId);
  if (stage) await logTaskActivity(client, organizationId, actorId, id, [`moveu para ${stage}`]);
  return { ok: true, data: undefined };
}

export async function deleteTask(
  client: TasksClient,
  organizationId: string,
  id: string,
): Promise<ServiceResult<undefined>> {
  const { error } = await client.from("tasks").delete().eq("organization_id", organizationId).eq("id", id);
  if (error) return { ok: false, error: dbMessage(error, "Não foi possível concluir a operação. Tente de novo em instantes.") };

  await logRecordEvent(client, organizationId, { recordType: "task", recordId: id, action: "deleted", summary: "Excluiu a tarefa" });

  return { ok: true, data: undefined };
}

/**
 * Quantas tarefas em aberto cada projeto tem, contadas no banco. O menu precisa só disso, e carregar as
 * linhas para contar custaria a base inteira a cada navegação.
 */
export async function getTaskOpenCounts(client: TasksClient, organizationId: string): Promise<TaskOpenCounts> {
  const { data } = await client.rpc("task_open_counts", { p_organization_id: organizationId });

  const byProject: Record<string, number> = {};
  let loose = 0;
  for (const row of data ?? []) {
    if (row.project_id) byProject[row.project_id] = row.total;
    else loose += row.total;
  }

  return { byProject, loose };
}

/**
 * Uma cópia da tarefa, na mesma etapa e logo abaixo dela. É o caminho de quem tem a mesma tarefa para dois
 * clientes, ou para as cinco peças da mesma campanha: o que muda é o título, e o resto é igual.
 *
 * As subtarefas vêm juntas, zeradas: a lista de passos é parte do que se está copiando, mas o que já foi
 * feito na original não foi feito nesta. Comentários e anexos **não** vêm: aquilo é a conversa daquela
 * tarefa, e não o molde dela.
 */
export async function duplicateTask(
  client: TasksClient,
  organizationId: string,
  id: string,
): Promise<ServiceResult<{ id: string }>> {
  const { data: source } = await client
    .from("tasks")
    .select("project_id, title, description, description_doc, due_date, start_date, estimate_minutes, stage_id, priority, owner_id, tags, alert, position, subtasks(title, position)")
    .eq("organization_id", organizationId)
    .eq("id", id)
    .maybeSingle();

  if (!source) return { ok: false, error: "Essa tarefa não está mais no quadro." };

  const { subtasks, position, title, ...fields } = source;

  const { data, error } = await client
    .from("tasks")
    .insert({ ...fields, organization_id: organizationId, title: `${title} (cópia)`, position: position + 1 })
    .select("id")
    .single();

  if (error || !data) return { ok: false, error: dbMessage(error, SAVE_FAILED) };

  if ((subtasks ?? []).length > 0) {
    await client.from("subtasks").insert(
      (subtasks ?? []).map((step) => ({ organization_id: organizationId, task_id: data.id, title: step.title, position: step.position, done: false })),
    );
  }

  return { ok: true, data: { id: data.id } };
}

/* ------------------------------------- as etapas da equipe ------------------------------------- */

/**
 * O catálogo de etapas da equipe, na ordem em que ela o arrumou (2026-09-21). É a lista que o quadro de
 * todas as tarefas desenha como colunas, e é de onde cada projeto escolhe as suas.
 */
export async function listTaskStages(client: TasksClient, organizationId: string): Promise<TaskStage[]> {
  const { data } = await client
    .from("task_stages")
    .select("id, name, hue, glyph, kind")
    .eq("organization_id", organizationId)
    .order("position");

  return ((data ?? []) as StageRow[]).map(toStage);
}

/** As etapas que um projeto usa, na ordem das colunas dele. Lista vazia é projeto que ainda não escolheu. */
export async function listProjectStages(client: TasksClient, organizationId: string, projectId: string): Promise<TaskStage[]> {
  const { data } = await client
    .from("project_stages")
    .select("position, task_stages!inner(id, name, hue, glyph, kind)")
    .eq("organization_id", organizationId)
    .eq("project_id", projectId)
    .order("position");

  return ((data ?? []) as unknown as { task_stages: StageRow }[]).map((row) => toStage(row.task_stages));
}

const STAGE_TAKEN = "Já existe uma etapa com esse nome.";
const STAGE_FAILED = "Não foi possível salvar a etapa. Tente de novo em instantes.";

/** Cria ou renomeia uma etapa da equipe: é o mesmo formulário, e o id diz qual dos dois. */
export async function saveTaskStage(
  client: TasksClient,
  organizationId: string,
  input: SaveStageInput,
): Promise<ServiceResult<TaskStage>> {
  const values = { name: input.name, hue: input.hue, glyph: input.glyph, kind: input.kind };

  if (input.id) {
    const { data, error } = await client
      .from("task_stages")
      .update(values)
      .eq("id", input.id)
      .eq("organization_id", organizationId)
      .select("id, name, hue, glyph, kind")
      .maybeSingle();

    if (error) return { ok: false, error: error.code === "23505" ? STAGE_TAKEN : dbMessage(error, STAGE_FAILED) };
    if (!data) return { ok: false, error: "Essa etapa não está mais no catálogo." };
    return { ok: true, data: toStage(data as StageRow) };
  }

  /* Etapa nova entra no fim da fila: a ordem é a do caminho do trabalho, e quem acabou de criar ainda não
     disse onde ela cabe. Arrastar na lista é o que decide isso depois. */
  const { count } = await client
    .from("task_stages")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId);

  const { data, error } = await client
    .from("task_stages")
    .insert({ ...values, organization_id: organizationId, position: count ?? 0 })
    .select("id, name, hue, glyph, kind")
    .single();

  if (error || !data) return { ok: false, error: error?.code === "23505" ? STAGE_TAKEN : dbMessage(error, STAGE_FAILED) };
  return { ok: true, data: toStage(data as StageRow) };
}

/**
 * Apaga uma etapa. Quem faz o trabalho é a função do banco, porque são duas escritas que precisam cair
 * juntas: as tarefas vão para a etapa de destino e só então a linha sai. Sem destino e com tarefa dentro, é
 * o próprio banco que recusa, com a contagem na mensagem.
 */
export async function deleteTaskStage(client: TasksClient, id: string, moveTo: string | null): Promise<ServiceResult<undefined>> {
  const { error } = await client.rpc("delete_task_stage", { p_id: id, p_move_to: moveTo ?? undefined });
  if (error) return { ok: false, error: dbMessage(error, "Não foi possível apagar a etapa.") };
  return { ok: true, data: undefined };
}

/** A ordem do catálogo, numa escrita só. */
export async function reorderTaskStages(client: TasksClient, ids: string[]): Promise<ServiceResult<undefined>> {
  const { error } = await client.rpc("reorder_task_stages", { p_ids: ids });
  if (error) return { ok: false, error: dbMessage(error, "Não foi possível salvar a ordem.") };
  return { ok: true, data: undefined };
}

/**
 * As colunas do quadro de um projeto: quais etapas ele usa e em que ordem. O que sai continua existindo no
 * catálogo da equipe, e a tarefa que estava numa etapa retirada fica onde está e volta a aparecer quando a
 * etapa voltar.
 */
export async function setProjectStages(
  client: TasksClient,
  organizationId: string,
  projectId: string,
  stageIds: string[],
): Promise<ServiceResult<undefined>> {
  const { error: cleared } = await client
    .from("project_stages")
    .delete()
    .eq("organization_id", organizationId)
    .eq("project_id", projectId)
    .not("stage_id", "in", `(${stageIds.join(",")})`);

  if (cleared) return { ok: false, error: cleared.message || STAGE_FAILED };

  const { error } = await client.from("project_stages").upsert(
    stageIds.map((stageId, index) => ({ project_id: projectId, stage_id: stageId, organization_id: organizationId, position: index })),
    { onConflict: "project_id,stage_id" },
  );

  if (error) return { ok: false, error: dbMessage(error, STAGE_FAILED) };
  return { ok: true, data: undefined };
}

/** O balde das imagens que entram no meio da descrição. Público, como os outros de imagem da casa. */
const TASK_IMAGE_BUCKET = "task-images";

const imageExtensions: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/avif": "avif",
};

/**
 * Assina a subida de uma imagem da descrição e já devolve o endereço público dela. Os dois vêm juntos porque
 * o caminho é conhecido antes de o arquivo subir, e o endereço não tem onde ser gravado depois: ele mora
 * dentro do documento, num nó de imagem. A pasta começa pelo id da organização, que é de onde a policy do
 * balde tira a permissão.
 */
export async function createTaskImageUpload(
  client: TasksClient,
  organizationId: string,
  input: { taskId: string; contentType: string },
): Promise<ServiceResult<{ path: string; token: string; url: string }>> {
  const { data: task } = await client
    .from("tasks")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("id", input.taskId)
    .maybeSingle();

  if (!task) return { ok: false, error: "Essa tarefa não está mais no quadro." };

  const path = `${organizationId}/tarefa/${input.taskId}-${crypto.randomUUID()}.${imageExtensions[input.contentType] ?? "webp"}`;
  const { data, error } = await client.storage.from(TASK_IMAGE_BUCKET).createSignedUploadUrl(path);
  if (error || !data) return { ok: false, error: "Não foi possível preparar o envio da imagem." };

  const {
    data: { publicUrl },
  } = client.storage.from(TASK_IMAGE_BUCKET).getPublicUrl(data.path);

  return { ok: true, data: { path: data.path, token: data.token, url: publicUrl } };
}

/**
 * Salva só a descrição. Escrita própria, e não a ficha inteira, porque quem escreve não tem o formulário em
 * mãos: a ficha grava sozinha enquanto a pessoa digita, e mandar o resto em branco apagaria o que não foi
 * editado. O texto puro é derivado aqui, como no salvar inteiro.
 */
export async function saveTaskDescription(
  client: TasksClient,
  organizationId: string,
  id: string,
  description: DocNode | null,
): Promise<ServiceResult<undefined>> {
  const { data, error } = await client
    .from("tasks")
    .update({ description: docText(description).slice(0, 20000), description_doc: asJson(description) })
    .eq("id", id)
    .eq("organization_id", organizationId)
    .select("id")
    .maybeSingle();

  if (error || !data) return { ok: false, error: dbMessage(error, SAVE_FAILED) };
  return { ok: true, data: undefined };
}

/**
 * A tarefa que nasce já aberta (2026-09-22). Ela entra no banco com o nome padrão e o prazo de hoje, e a
 * ficha, que abre em seguida, grava o resto enquanto a pessoa preenche.
 *
 * O prazo é obrigatório na tabela, então ele nasce em hoje: é o valor que quem cria uma tarefa sem pensar na
 * data teria escolhido, e é o que a ficha mostra para trocar em um clique.
 */
export async function createTask(
  client: TasksClient,
  organizationId: string,
  input: { id?: string; projectId: string | null; stageId: string },
  actorId: string | null = null,
): Promise<ServiceResult<{ id: string; reference: string }>> {
  const { data, error } = await client
    .from("tasks")
    .insert({
      ...(input.id && { id: input.id }),
      organization_id: organizationId,
      project_id: input.projectId,
      stage_id: input.stageId,
      title: DEFAULT_TASK_TITLE,
      due_date: format(new Date(), "yyyy-MM-dd"),
    })
    .select("id, reference")
    .single();

  if (error || !data) return { ok: false, error: dbMessage(error, SAVE_FAILED) };

  await logRecordEvent(client, organizationId, { recordType: "task", recordId: data.id, action: "created", summary: `Criou a tarefa ${DEFAULT_TASK_TITLE}` });
  await logTaskActivity(client, organizationId, actorId, data.id, ["criou a tarefa"]);

  return { ok: true, data: { id: data.id, reference: data.reference } };
}

/**
 * As etapas da equipe arrumadas de uma vez (2026-09-22), no desenho que o funil de vendas já usa: a lista
 * inteira na ordem, o que é novo sem id, e as que saem dizendo para onde vão as tarefas delas.
 *
 * A ordem das escritas importa: primeiro o que fica (para a etapa de destino de uma remoção já existir),
 * depois as remoções, que passam pela função do banco, que move e apaga na mesma transação, e por fim as
 * colunas do projeto, se a janela foi aberta de um quadro.
 */
export async function configureTaskStages(
  client: TasksClient,
  organizationId: string,
  input: ConfigureStagesInput,
): Promise<ServiceResult<undefined>> {
  const ids: string[] = [];

  for (const [index, stage] of input.stages.entries()) {
    const values = { name: stage.name, hue: stage.hue, glyph: stage.glyph, kind: stage.kind, position: index };

    if (stage.id) {
      const { error } = await client.from("task_stages").update(values).eq("id", stage.id).eq("organization_id", organizationId);
      if (error) return { ok: false, error: error.code === "23505" ? STAGE_TAKEN : dbMessage(error, STAGE_FAILED) };
      ids.push(stage.id);
      continue;
    }

    const { data, error } = await client
      .from("task_stages")
      .insert({ ...values, organization_id: organizationId })
      .select("id")
      .single();

    if (error || !data) return { ok: false, error: error?.code === "23505" ? STAGE_TAKEN : dbMessage(error, STAGE_FAILED) };
    ids.push(data.id);
  }

  for (const removal of input.removals) {
    const removed = await deleteTaskStage(client, removal.id, removal.moveTo);
    if (!removed.ok) return removed;
  }

  if (input.projectId) return setProjectStages(client, organizationId, input.projectId, ids);

  return { ok: true, data: undefined };
}

/* ---------------------------------- o que muda dentro da ficha ---------------------------------- */

/** O balde privado dos arquivos da tarefa: anexo da ficha, arquivo e áudio da conversa. */
const TASK_FILE_BUCKET = "task-files";

/**
 * Como um arquivo do balde é guardado na coluna de endereço: o prefixo diz que o que vem depois é caminho, e
 * não um endereço pronto. Na leitura ele vira um endereço assinado; um link ou um Figma segue como está.
 */
const STORED_PREFIX = `${TASK_FILE_BUCKET}:`;

const stored = (path: string) => `${STORED_PREFIX}${path}`;

/** Quanto vale o endereço assinado que a ficha recebe: o bastante para uma sessão de trabalho. */
const SIGNED_SECONDS = 60 * 60 * 6;

/**
 * Troca os caminhos guardados pelos endereços assinados, numa ida só ao Storage para a ficha inteira. É o que
 * faz a imagem, o arquivo e o áudio continuarem abrindo depois de recarregar, num balde que não é público.
 */
async function signStored(client: TasksClient, urls: (string | null)[]) {
  const paths = [
    ...new Set(urls.filter((url): url is string => Boolean(url?.startsWith(STORED_PREFIX))).map((url) => url.slice(STORED_PREFIX.length))),
  ];
  const signed = new Map<string, string>();
  if (paths.length === 0) return signed;
  const { data } = await client.storage.from(TASK_FILE_BUCKET).createSignedUrls(paths, SIGNED_SECONDS);
  for (const entry of data ?? []) {
    if (entry.path && entry.signedUrl) signed.set(stored(entry.path), entry.signedUrl);
  }
  return signed;
}

const linkColumns = { client: "client_id", quote: "quote_id", project: "linked_project_id", contract: "contract_id" } as const;

const extensionOf = (name: string) => {
  const match = /\.([a-z0-9]{1,8})$/i.exec(name);
  return match ? `.${match[1].toLowerCase()}` : "";
};

export type TaskChangeResult = ServiceResult<{ path?: string; token?: string }>;

const CHANGE_FAILED = "Não foi possível guardar essa mudança. Tente de novo em instantes.";

/**
 * Aplica uma mudança da ficha (2026-09-22). A tarefa é conferida antes, pela organização, e todo caminho de
 * arquivo precisa estar na pasta dela: sem isso, um pedido forjado gravaria na tarefa um arquivo de outra.
 */
export async function applyTaskChange(
  client: TasksClient,
  organizationId: string,
  userId: string,
  taskId: string,
  change: TaskChangeInput,
): Promise<TaskChangeResult> {
  const { data: task } = await client.from("tasks").select("id").eq("organization_id", organizationId).eq("id", taskId).maybeSingle();
  if (!task) return { ok: false, error: "Essa tarefa não está mais no quadro." };

  const folder = `${organizationId}/tarefa/${taskId}/`;
  const inFolder = (path: string) => path.startsWith(folder) && !path.includes("..");
  const done = (error: { message: string } | null): TaskChangeResult =>
    error ? { ok: false, error: dbMessage(error, CHANGE_FAILED) } : { ok: true, data: {} };
  /* A nota na atividade da tarefa, com quem fez: é o que a conversa mostra entre as mensagens. */
  const note = (action: string) => logTaskActivity(client, organizationId, userId, taskId, [action]);

  switch (change.op) {
    case "upload": {
      const path = `${folder}${crypto.randomUUID()}${extensionOf(change.name)}`;
      const { data, error } = await client.storage.from(TASK_FILE_BUCKET).createSignedUploadUrl(path);
      if (error || !data) return { ok: false, error: "Não foi possível preparar o envio do arquivo." };
      return { ok: true, data: { path: data.path, token: data.token } };
    }

    case "comment": {
      if ((change.audio && !inFolder(change.audio.path)) || change.files.some((file) => !inFolder(file.path))) {
        return { ok: false, error: "Arquivo fora desta tarefa." };
      }
      const { data: event, error } = await client
        .from("task_events")
        .insert({
          organization_id: organizationId,
          task_id: taskId,
          actor_id: userId,
          action: change.text || ATTACHMENT_ONLY,
          kind: "comment",
          mentions: change.mentions as unknown as Json,
          audio_url: change.audio ? stored(change.audio.path) : null,
          audio_seconds: change.audio?.seconds ?? null,
        })
        .select("id")
        .single();
      if (error || !event) return done(error ?? { message: CHANGE_FAILED });
      if (change.files.length === 0) return done(null);
      const { error: filesError } = await client.from("task_attachments").insert(
        change.files.map((file) => ({
          organization_id: organizationId,
          task_id: taskId,
          event_id: event.id,
          name: file.name,
          type: file.type,
          url: stored(file.path),
          size_bytes: file.sizeBytes,
        })),
      );
      return done(filesError);
    }

    case "subtask-add": {
      const { count } = await client.from("subtasks").select("id", { count: "exact", head: true }).eq("task_id", taskId);
      await note(`adicionou a subtarefa "${change.title}"`);
      const { error } = await client.from("subtasks").insert({
        id: change.id,
        organization_id: organizationId,
        task_id: taskId,
        title: change.title,
        assignee_id: change.assigneeId,
        priority: change.priority,
        due_date: change.dueDate,
        position: count ?? 0,
      });
      return done(error);
    }

    case "subtask-update": {
      const values = {
        ...(change.title !== undefined && { title: change.title }),
        ...(change.done !== undefined && { done: change.done }),
        ...(change.assigneeId !== undefined && { assignee_id: change.assigneeId }),
        ...(change.priority !== undefined && { priority: change.priority }),
        ...(change.dueDate !== undefined && { due_date: change.dueDate }),
      };
      const { data: row, error } = await client.from("subtasks").update(values).eq("id", change.id).eq("task_id", taskId).select("title").maybeSingle();
      if (!error && row) {
        await note(
          change.done === true
            ? `concluiu a subtarefa "${row.title}"`
            : change.done === false
              ? `reabriu a subtarefa "${row.title}"`
              : `editou a subtarefa "${row.title}"`,
        );
      }
      return done(error);
    }

    case "subtask-remove": {
      const { data: row, error } = await client.from("subtasks").delete().eq("id", change.id).eq("task_id", taskId).select("title").maybeSingle();
      if (!error && row) await note(`removeu a subtarefa "${row.title}"`);
      return done(error);
    }

    case "subtask-order": {
      /* Uma escrita por subtarefa, todas presas à tarefa: uma lista de subtarefas é curta, e o filtro pela
         tarefa impede que um id de fora mude de lugar. */
      const results = await Promise.all(
        change.ids.map((id, position) => client.from("subtasks").update({ position }).eq("id", id).eq("task_id", taskId)),
      );
      const failure = results.find((result) => result.error)?.error ?? null;
      if (!failure) await note("reorganizou as subtarefas");
      return done(failure);
    }

    case "people": {
      const { error } = await client.from("task_people").delete().eq("task_id", taskId);
      if (!error) await note("atualizou quem está envolvido");
      if (error || change.userIds.length === 0) return done(error);
      const { error: insertError } = await client
        .from("task_people")
        .insert([...new Set(change.userIds)].map((user) => ({ task_id: taskId, user_id: user, organization_id: organizationId })));
      return done(insertError);
    }

    case "link-add": {
      const { count } = await client.from("task_links").select("id", { count: "exact", head: true }).eq("task_id", taskId);
      const { error } = await client.from("task_links").insert({
        organization_id: organizationId,
        task_id: taskId,
        client_id: change.kind === "client" ? change.recordId : null,
        quote_id: change.kind === "quote" ? change.recordId : null,
        linked_project_id: change.kind === "project" ? change.recordId : null,
        contract_id: change.kind === "contract" ? change.recordId : null,
        position: count ?? 0,
      });
      if (!error) await note(`vinculou ${await linkName(client, change.kind, change.recordId)}`);
      return done(error);
    }

    case "link-remove": {
      const { error } = await client.from("task_links").delete().eq("task_id", taskId).eq(linkColumns[change.kind], change.recordId);
      if (!error) await note(`desvinculou ${await linkName(client, change.kind, change.recordId)}`);
      return done(error);
    }

    case "attachment-add": {
      if (change.path && !inFolder(change.path)) return { ok: false, error: "Arquivo fora desta tarefa." };
      const { error } = await client.from("task_attachments").insert({
        id: change.id,
        organization_id: organizationId,
        task_id: taskId,
        name: change.name,
        type: change.type,
        url: change.path ? stored(change.path) : (change.url ?? ""),
        size_bytes: change.sizeBytes,
      });
      if (!error) await note(`anexou "${change.name}"`);
      return done(error);
    }

    case "attachment-remove": {
      const { data: file } = await client.from("task_attachments").select("url, name").eq("id", change.id).eq("task_id", taskId).maybeSingle();
      const { error } = await client.from("task_attachments").delete().eq("id", change.id).eq("task_id", taskId);
      if (!error && file) await note(`removeu o anexo "${file.name}"`);
      if (!error && file?.url.startsWith(STORED_PREFIX)) {
        await client.storage.from(TASK_FILE_BUCKET).remove([file.url.slice(STORED_PREFIX.length)]);
      }
      return done(error);
    }
  }
}

/* --------------------------------- a atividade da tarefa --------------------------------- */

/** Quanto tempo a mesma nota, da mesma pessoa, não se repete: o salvar automático grava a cada pausa. */
const SAME_NOTE_WINDOW = 10 * 60 * 1000;

/**
 * Uma nota na atividade da tarefa (2026-09-23, a pedido: "as atividades precisam refletir as coisas que
 * acontecem na tarefa"). Vai para `task_events` como mudança, com quem fez, que é o que a conversa desenha
 * entre as mensagens, no formato "Aleph moveu para Em revisão". A mesma nota seguida da mesma pessoa não se
 * repete dentro de dez minutos: sem isso, escrever a descrição deixaria uma nota por pausa de digitação.
 *
 * Sem quem fez não há nota: a RLS exige que o autor seja quem está gravando, e o que o sistema faz sozinho
 * não é conversa da equipe.
 */
export async function logTaskActivity(client: TasksClient, organizationId: string, actorId: string | null, taskId: string, actions: string[]) {
  if (!actorId || actions.length === 0) return;
  const { data: last } = await client
    .from("task_events")
    .select("action, actor_id, kind, at")
    .eq("task_id", taskId)
    .order("at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const repeated = (action: string) =>
    Boolean(last && last.kind === "change" && last.actor_id === actorId && last.action === action && Date.now() - new Date(last.at).getTime() < SAME_NOTE_WINDOW);
  const fresh = actions.filter((action) => !repeated(action));
  if (fresh.length === 0) return;
  await client
    .from("task_events")
    .insert(fresh.map((action) => ({ organization_id: organizationId, task_id: taskId, actor_id: actorId, action, kind: "change" as const })));
}

async function stageName(client: TasksClient, stageId: string) {
  const { data } = await client.from("task_stages").select("name").eq("id", stageId).maybeSingle();
  return data?.name ?? null;
}

const linkArticles = { client: "o cliente", quote: "o orçamento", project: "o projeto", contract: "o contrato" } as const;

/** O registro vinculado como a nota o nomeia: "o orçamento ORC-2026-0001". */
async function linkName(client: TasksClient, kind: keyof typeof linkArticles, id: string) {
  const table = kind === "client" ? "clients" : kind === "quote" ? "quotes" : kind === "project" ? "projects" : "contracts";
  const { data } = await client.from(table).select("reference").eq("id", id).maybeSingle();
  return `${linkArticles[kind]} ${data?.reference ?? ""}`.trim();
}

const noteDay = (iso: string) => format(parseISO(iso), "d 'de' MMM.", { locale: ptBR });

type SavedRow = {
  title: string;
  description: string;
  due_date: string;
  start_date: string | null;
  estimate_minutes: number | null;
  stage_id: string;
  priority: TaskPriority;
  owner_id: string | null;
  tags: string[];
  alert: string | null;
  project_id: string | null;
};

/** O que o salvar da ficha mudou, em notas: uma por campo, no jeito que a conversa lê. */
async function describeSave(client: TasksClient, organizationId: string, before: SavedRow, after: Omit<SavedRow, never> & Record<string, unknown>) {
  const notes: string[] = [];
  if (before.title !== after.title) notes.push(`renomeou para "${after.title}"`);
  if (before.stage_id !== after.stage_id) {
    const stage = await stageName(client, after.stage_id);
    if (stage) notes.push(`moveu para ${stage}`);
  }
  if (before.priority !== after.priority) notes.push(`mudou a prioridade para ${priorityLabels[after.priority]}`);
  if (before.due_date !== after.due_date) notes.push(`mudou o prazo para ${noteDay(after.due_date)}`);
  if (before.start_date !== after.start_date) notes.push(after.start_date ? `mudou o início para ${noteDay(after.start_date)}` : "tirou a data de início");
  if (before.estimate_minutes !== after.estimate_minutes) {
    notes.push(after.estimate_minutes ? `estimou em ${estimateLabel(after.estimate_minutes)}` : "tirou a estimativa");
  }
  if (before.owner_id !== after.owner_id) {
    if (!after.owner_id) notes.push("tirou o responsável");
    else {
      const person = (await peopleOf(client, organizationId)).get(after.owner_id);
      notes.push(`passou a tarefa para ${person?.name ?? "outra pessoa"}`);
    }
  }
  if ([...before.tags].sort().join() !== [...after.tags].sort().join()) notes.push("atualizou as etiquetas");
  if ((before.alert ?? "") !== (after.alert ?? "")) notes.push(after.alert ? "atualizou o aviso" : "tirou o aviso");
  if (before.description !== after.description) notes.push("atualizou a descrição");
  if (before.project_id !== after.project_id) notes.push(after.project_id ? "mudou a tarefa de projeto" : "tirou a tarefa do projeto");
  return notes;
}
