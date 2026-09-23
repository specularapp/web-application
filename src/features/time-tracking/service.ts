import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { StartTimerInput } from "./schemas";
import { logTaskActivity } from "@/features/tasks/service";
import { durationLabel, type TimeEntry } from "./summary";

type TimeClient = SupabaseClient<Database>;
type ServiceResult<T> = { ok: true; data: T } | { ok: false; error: string };
type TimeRow = Database["public"]["Tables"]["time_entries"]["Row"] & {
  projects: { id: string; name: string; reference: string } | null;
  tasks: { id: string; title: string; reference: string } | null;
};

const ENTRY_COLUMNS = "*, projects(id, name, reference), tasks(id, title, reference)";

const entryOf = (row: TimeRow): TimeEntry => ({
  id: row.id,
  projectId: row.project_id,
  projectName: row.projects?.name ?? null,
  projectReference: row.projects?.reference ?? null,
  taskId: row.task_id,
  taskTitle: row.tasks?.title ?? null,
  taskReference: row.tasks?.reference ?? null,
  note: row.note,
  startedAt: row.started_at,
  stoppedAt: row.stopped_at,
  durationSeconds: row.duration_seconds,
});

export async function getActiveTimeEntry(client: TimeClient, organizationId: string, userId: string): Promise<TimeEntry | null> {
  const { data } = await client
    .from("time_entries")
    .select(ENTRY_COLUMNS)
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .is("stopped_at", null)
    .maybeSingle();
  return data ? entryOf(data as unknown as TimeRow) : null;
}

async function finishEntry(client: TimeClient, organizationId: string, userId: string, id: string): Promise<ServiceResult<TimeEntry>> {
  const { data: current } = await client
    .from("time_entries")
    .select("started_at")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .eq("id", id)
    .is("stopped_at", null)
    .maybeSingle();
  if (!current) return { ok: false, error: "Cronômetro ativo não encontrado." };
  const stoppedAt = new Date();
  const durationSeconds = Math.max(0, Math.floor((stoppedAt.getTime() - new Date(current.started_at).getTime()) / 1000));
  const { data, error } = await client
    .from("time_entries")
    .update({ stopped_at: stoppedAt.toISOString(), duration_seconds: durationSeconds })
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .eq("id", id)
    .select(ENTRY_COLUMNS)
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "Não foi possível parar o cronômetro." };
  const entry = entryOf(data as unknown as TimeRow);
  /* O trecho fechado entra na atividade da tarefa, como toda mudança dela (2026-09-23). */
  if (entry.taskId && durationSeconds > 0) {
    await logTaskActivity(client, organizationId, userId, entry.taskId, [`registrou ${durationLabel(durationSeconds)} de tempo`]);
  }
  return { ok: true, data: entry };
}

export async function startTimeEntry(client: TimeClient, organizationId: string, userId: string, input: StartTimerInput): Promise<ServiceResult<TimeEntry>> {
  let projectId = input.projectId ?? null;
  if (input.taskId) {
    const { data: task } = await client.from("tasks").select("id, project_id").eq("organization_id", organizationId).eq("id", input.taskId).maybeSingle();
    if (!task) return { ok: false, error: "Tarefa não encontrada." };
    if (projectId && task.project_id && projectId !== task.project_id) return { ok: false, error: "A tarefa não pertence a este projeto." };
    projectId = task.project_id ?? projectId;
  } else if (projectId) {
    const { data: project } = await client.from("projects").select("id").eq("organization_id", organizationId).eq("id", projectId).maybeSingle();
    if (!project) return { ok: false, error: "Projeto não encontrado." };
  }

  const active = await getActiveTimeEntry(client, organizationId, userId);
  if (active) {
    const stopped = await finishEntry(client, organizationId, userId, active.id);
    if (!stopped.ok) return stopped;
  }
  const { data, error } = await client
    .from("time_entries")
    .insert({ organization_id: organizationId, user_id: userId, project_id: projectId, task_id: input.taskId ?? null, note: input.note })
    .select(ENTRY_COLUMNS)
    .single();
  return error || !data ? { ok: false, error: error?.message ?? "Não foi possível iniciar o cronômetro." } : { ok: true, data: entryOf(data as unknown as TimeRow) };
}

export async function stopTimeEntry(client: TimeClient, organizationId: string, userId: string, id: string) {
  return finishEntry(client, organizationId, userId, id);
}

/** O que a pessoa já registrou numa tarefa, do mais recente para trás. A RLS só entrega os apontamentos dela. */
export async function listTaskTimeEntries(client: TimeClient, organizationId: string, userId: string, taskId: string): Promise<TimeEntry[]> {
  const { data } = await client
    .from("time_entries")
    .select(ENTRY_COLUMNS)
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .eq("task_id", taskId)
    .order("started_at", { ascending: false })
    .limit(50);
  return (data ?? []).map((row) => entryOf(row as unknown as TimeRow));
}
