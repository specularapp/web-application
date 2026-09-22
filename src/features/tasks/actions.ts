"use server";

import { firstIssue, guardAction, revalidateDomain } from "@/features/organizations/context";
import { cacheTags } from "@/lib/cache/tags";
import {
  configureStagesSchema,
  createTaskSchema,
  deleteStageSchema,
  projectStagesSchema,
  saveStageSchema,
  saveTaskDescriptionSchema,
  stageOrderSchema,
  subtaskToggleSchema,
  taskCommentSchema,
  taskFormSchema,
  taskIdSchema,
  taskImageUploadSchema,
  taskMoveSchema,
} from "./schemas";
import {
  addTaskComment,
  configureTaskStages,
  createTask,
  createTaskImageUpload,
  deleteTask,
  deleteTaskStage,
  duplicateTask,
  getTask,
  moveTask,
  reorderTaskStages,
  saveTask,
  saveTaskDescription,
  saveTaskStage,
  setProjectStages,
  toggleSubtask,
} from "./service";
import type { TaskStage } from "./stages";
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
    parsed.data.stageId,
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

/** Uma cópia da tarefa, na mesma etapa e logo abaixo dela. */
export async function duplicateTaskAction(input: unknown): Promise<TaskResult> {
  const guard = await guardAction("task-duplicate");
  if (!guard.ok) return { ok: false, error: guard.error };

  const parsed = taskIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Escolha uma tarefa." };

  const copy = await duplicateTask(guard.context.supabase, guard.context.organizationId, parsed.data);
  if (!copy.ok) return { ok: false, error: copy.error };

  await revalidateDomain(guard.context.organizationId, [cacheTags.tasks], ["/tarefas"]);
  return { ok: true };
}

/* ------------------------------------- as etapas da equipe ------------------------------------- */

export type StageSaveResult = { ok: true; stage: TaskStage } | { ok: false; error: string; field?: string };

/**
 * Cria ou edita uma etapa do catálogo da equipe (2026-09-21). Derruba o cache de tarefas e a concha, porque
 * a etapa aparece nas colunas, nos cartões e na contagem do menu.
 */
export async function saveTaskStageAction(input: unknown): Promise<StageSaveResult> {
  const guard = await guardAction("task-stage-save");
  if (!guard.ok) return { ok: false, error: guard.error };

  const parsed = saveStageSchema.safeParse(input);
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) };

  const saved = await saveTaskStage(guard.context.supabase, guard.context.organizationId, parsed.data);
  if (!saved.ok) return { ok: false, error: saved.error, field: saved.error.includes("nome") ? "name" : undefined };

  await revalidateDomain(guard.context.organizationId, [cacheTags.tasks, cacheTags.shell], ["/tarefas"]);
  return { ok: true, stage: saved.data };
}

/** Apaga uma etapa; com tarefas dentro, `moveTo` diz para onde elas vão e o banco recusa sem isso. */
export async function deleteTaskStageAction(input: unknown): Promise<TaskResult> {
  const guard = await guardAction("task-stage-delete");
  if (!guard.ok) return { ok: false, error: guard.error };

  const parsed = deleteStageSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Etapa inválida." };

  const removed = await deleteTaskStage(guard.context.supabase, parsed.data.id, parsed.data.moveTo);
  if (!removed.ok) return { ok: false, error: removed.error };

  await revalidateDomain(guard.context.organizationId, [cacheTags.tasks, cacheTags.shell], ["/tarefas"]);
  return { ok: true };
}

/** A ordem do catálogo da equipe, que é a ordem das colunas de quem não escolheu as suas. */
export async function reorderTaskStagesAction(input: unknown): Promise<TaskResult> {
  const guard = await guardAction("task-stage-order");
  if (!guard.ok) return { ok: false, error: guard.error };

  const parsed = stageOrderSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Ordem inválida." };

  const saved = await reorderTaskStages(guard.context.supabase, parsed.data.ids);
  if (!saved.ok) return { ok: false, error: saved.error };

  await revalidateDomain(guard.context.organizationId, [cacheTags.tasks, cacheTags.shell], ["/tarefas"]);
  return { ok: true };
}

/** Quais etapas o quadro de um projeto usa, e em que ordem as colunas aparecem. */
export async function setProjectStagesAction(input: unknown): Promise<TaskResult> {
  const guard = await guardAction("project-stages");
  if (!guard.ok) return { ok: false, error: guard.error };

  const parsed = projectStagesSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error).error };

  const saved = await setProjectStages(guard.context.supabase, guard.context.organizationId, parsed.data.id, parsed.data.stageIds);
  if (!saved.ok) return { ok: false, error: saved.error };

  await revalidateDomain(guard.context.organizationId, [cacheTags.tasks, cacheTags.projects, cacheTags.shell], ["/tarefas", "/projetos"]);
  return { ok: true };
}

/**
 * A imagem que entra no meio da descrição (2026-09-22). Devolve o endereço assinado para o navegador mandar
 * o arquivo direto ao Storage e, junto, o endereço público que vai ficar dentro do documento.
 */
export async function createTaskImageUploadAction(input: unknown): Promise<{ ok: true; path: string; token: string; url: string } | { ok: false; error: string }> {
  const guard = await guardAction("task-image-upload");
  if (!guard.ok) return { ok: false, error: guard.error };

  const parsed = taskImageUploadSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Envie a imagem em PNG, JPG, WEBP ou AVIF." };

  const prepared = await createTaskImageUpload(guard.context.supabase, guard.context.organizationId, parsed.data);
  if (!prepared.ok) return { ok: false, error: prepared.error };

  return { ok: true, ...prepared.data };
}

/**
 * A descrição da tarefa, salva sozinha enquanto a pessoa escreve (2026-09-22). É a única escrita da ficha
 * que não passa pelo formulário inteiro: o texto é longo, ninguém quer apertar salvar a cada parágrafo, e o
 * resto dos campos não está em mãos aqui.
 */
export async function saveTaskDescriptionAction(input: unknown): Promise<TaskResult> {
  const guard = await guardAction("task-description");
  if (!guard.ok) return { ok: false, error: guard.error };

  const parsed = saveTaskDescriptionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error).error };

  const saved = await saveTaskDescription(guard.context.supabase, guard.context.organizationId, parsed.data.id, parsed.data.description);
  if (!saved.ok) return { ok: false, error: saved.error };

  await revalidateDomain(guard.context.organizationId, [cacheTags.tasks], ["/tarefas"]);
  return { ok: true };
}

/**
 * Cria a tarefa já aberta (2026-09-22, a pedido): o "+" do quadro não abre mais um formulário à parte, ele
 * põe a tarefa no lugar escolhido e abre a ficha dela, que é onde tudo se preenche. A tarefa nasce com o
 * nome padrão, e quem não trocar o nome fica com ele.
 */
export async function createTaskAction(input: unknown): Promise<TaskSaveResult> {
  const guard = await guardAction("task-create");
  if (!guard.ok) return { ok: false, error: guard.error };

  const parsed = createTaskSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Escolha a etapa em que a tarefa nasce." };

  const created = await createTask(guard.context.supabase, guard.context.organizationId, parsed.data);
  if (!created.ok) return { ok: false, error: created.error };

  await revalidateDomain(guard.context.organizationId, [cacheTags.tasks], ["/tarefas"]);
  return { ok: true, id: created.data.id };
}

/**
 * As etapas da equipe arrumadas de uma vez (2026-09-22), no desenho do funil de vendas: a lista inteira na
 * ordem, o que é novo sem id, e o destino das tarefas de cada etapa que sai. Uma janela, uma gravação.
 */
export async function configureTaskStagesAction(input: unknown): Promise<TaskResult> {
  const guard = await guardAction("task-stages-configure");
  if (!guard.ok) return { ok: false, error: guard.error };

  const parsed = configureStagesSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error).error };

  const saved = await configureTaskStages(guard.context.supabase, guard.context.organizationId, parsed.data);
  if (!saved.ok) return { ok: false, error: saved.error };

  await revalidateDomain(guard.context.organizationId, [cacheTags.tasks, cacheTags.projects, cacheTags.shell], ["/tarefas", "/projetos"]);
  return { ok: true };
}
