"use server";

import { firstIssue, guardAction, revalidateDomain } from "@/features/organizations/context";
import { cacheTags } from "@/lib/cache/tags";
import { subtaskToggleSchema, taskCommentSchema, taskFormSchema, taskIdSchema, taskMoveSchema } from "./schemas";
import { addTaskComment, deleteTask, getTask, moveTask, saveTask, toggleSubtask } from "./service";
import type { Task } from "./summary";

export type TaskSaveResult = { ok: true; id: string } | { ok: false; error: string; field?: string };
export type TaskResult = { ok: true } | { ok: false; error: string };

/** A ficha completa de uma tarefa, buscada quando a janela abre. */
export async function loadTaskAction(id: string): Promise<Task | null> {
  const guard = await guardAction("task-load");
  if (!guard.ok) return null;

  return getTask(guard.context.supabase, guard.context.organizationId, id);
}

/** Salva a tarefa, criando ou editando: é o mesmo formulário e a mesma regra. */
export async function saveTaskAction(input: unknown): Promise<TaskSaveResult> {
  const guard = await guardAction("task-save");
  if (!guard.ok) return { ok: false, error: guard.error };

  const parsed = taskFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) };

  const saved = await saveTask(guard.context.supabase, guard.context.organizationId, parsed.data);
  if (!saved.ok) return { ok: false, error: saved.error };

  await revalidateDomain(guard.context.organizationId, [cacheTags.tasks], ["/tarefas"]);
  return { ok: true, id: saved.data.id };
}

/**
 * Arrastar o cartão de coluna. A etapa precisa ser uma das que o projeto declara, e quem recusa isso é o
 * gatilho do banco: sem ele, um pedido forjado mandaria o cartão para uma coluna que o quadro nem desenha.
 */
export async function moveTaskAction(input: unknown): Promise<TaskResult> {
  const guard = await guardAction("task-move");
  if (!guard.ok) return { ok: false, error: guard.error };

  const parsed = taskMoveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Etapa inválida." };

  const moved = await moveTask(
    guard.context.supabase,
    guard.context.organizationId,
    parsed.data.id,
    parsed.data.stage,
    parsed.data.position,
  );
  if (!moved.ok) return { ok: false, error: moved.error };

  await revalidateDomain(guard.context.organizationId, [cacheTags.tasks], ["/tarefas"]);
  return { ok: true };
}

export async function deleteTaskAction(input: unknown): Promise<TaskResult> {
  const guard = await guardAction("task-delete");
  if (!guard.ok) return { ok: false, error: guard.error };

  const parsed = taskIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Tarefa inválida." };

  const removed = await deleteTask(guard.context.supabase, guard.context.organizationId, parsed.data);
  if (!removed.ok) return { ok: false, error: removed.error };

  await revalidateDomain(guard.context.organizationId, [cacheTags.tasks], ["/tarefas"]);
  return { ok: true };
}

/** Marcar e desmarcar uma subtarefa: a escrita mais frequente da ficha. */
export async function toggleSubtaskAction(input: unknown): Promise<TaskResult> {
  const guard = await guardAction("subtask-toggle");
  if (!guard.ok) return { ok: false, error: guard.error };

  const parsed = subtaskToggleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Subtarefa inválida." };

  const toggled = await toggleSubtask(
    guard.context.supabase,
    guard.context.organizationId,
    parsed.data.id,
    parsed.data.done,
  );
  if (!toggled.ok) return { ok: false, error: toggled.error };

  return { ok: true };
}

/** Um comentário na conversa da tarefa, com o que ele marcou. */
export async function commentTaskAction(input: unknown): Promise<TaskResult> {
  const guard = await guardAction("task-comment");
  if (!guard.ok) return { ok: false, error: guard.error };

  const parsed = taskCommentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error).error };

  const { supabase, organizationId, user } = guard.context;
  const added = await addTaskComment(
    supabase,
    organizationId,
    user.id,
    parsed.data.taskId,
    parsed.data.text,
    parsed.data.mentions,
  );
  if (!added.ok) return { ok: false, error: added.error };

  await revalidateDomain(guard.context.organizationId, [cacheTags.tasks], ["/tarefas"]);
  return { ok: true };
}
