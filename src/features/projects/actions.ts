"use server";

import { firstIssue, guardAction, revalidateDomain } from "@/features/organizations/context";
import { cacheTags } from "@/lib/cache/tags";
import { folderIdSchema, moveProjectSchema, projectFormSchema, projectIdSchema, saveFolderSchema } from "./schemas";
import { deleteProject, deleteProjectFolder, getProjectDetails, moveProject, saveProject, saveProjectFolder } from "./service";
import type { ProjectDetails } from "./summary";

export type ProjectSaveResult = { ok: true; id: string } | { ok: false; error: string; field?: string };
export type ProjectDeleteResult = { ok: true } | { ok: false; error: string };
export type FolderSaveResult = { ok: true; id: string } | { ok: false; error: string; field?: string };
export type FolderResult = { ok: true } | { ok: false; error: string };

/**
 * A ficha completa de um projeto, buscada quando a janela abre. É buscada, e não mandada junto da listagem,
 * porque a ficha tem equipe, tarefas, orçamentos e atividade, e doze delas por página encheriam a carga com
 * o que a grade nem desenha.
 */
export async function loadProjectAction(id: string): Promise<ProjectDetails | null> {
  const guard = await guardAction("project-load");
  if (!guard.ok) return null;

  return getProjectDetails(guard.context.supabase, guard.context.organizationId, id);
}

/**
 * Salva a ficha, criando ou editando: é o mesmo formulário e a mesma regra. O campo com problema volta pelo
 * caminho dele, para o formulário acender o campo certo. Cliente de outra organização é recusado pelo
 * gatilho do banco, e a mensagem diz isso em vez de deixar passar o erro do driver.
 */
export async function saveProjectAction(input: unknown): Promise<ProjectSaveResult> {
  const guard = await guardAction("project-save");
  if (!guard.ok) return { ok: false, error: guard.error };

  const parsed = projectFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) };

  const saved = await saveProject(guard.context.supabase, guard.context.organizationId, parsed.data);
  if (!saved.ok) {
    if (saved.error.includes("client_id")) return { ok: false, error: "Esse cliente não está mais na base.", field: "clientId" };
    return { ok: false, error: saved.error };
  }

  await revalidateDomain(guard.context.organizationId, [cacheTags.projects], ["/projetos", "/tarefas"]);
  return { ok: true, id: saved.data.id };
}

export async function deleteProjectAction(input: unknown): Promise<ProjectDeleteResult> {
  const guard = await guardAction("project-delete");
  if (!guard.ok) return { ok: false, error: guard.error };

  const parsed = projectIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Projeto inválido." };

  const removed = await deleteProject(guard.context.supabase, guard.context.organizationId, parsed.data);
  if (!removed.ok) return { ok: false, error: removed.error };

  await revalidateDomain(guard.context.organizationId, [cacheTags.projects], ["/projetos", "/tarefas"]);
  return { ok: true };
}

/**
 * As pastas de projeto. Elas já existiam no banco e já eram lidas pelo menu, que mostra a mesma árvore; o
 * que faltava era poder mexer nelas (2026-09-16, a pedido).
 *
 * As três derrubam o cache de projetos, que já leva a concha junto na cascata de tags: a árvore da barra
 * lateral sai da mesma base, e sem isso a pasta nova só apareceria quando o cache vencesse.
 */
export async function saveFolderAction(input: unknown): Promise<FolderSaveResult> {
  const guard = await guardAction("project-folder-save");
  if (!guard.ok) return { ok: false, error: guard.error };

  const parsed = saveFolderSchema.safeParse(input);
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) };

  const saved = await saveProjectFolder(guard.context.supabase, guard.context.organizationId, parsed.data);
  if (!saved.ok) return { ok: false, error: saved.error };

  await revalidateDomain(guard.context.organizationId, [cacheTags.projects], ["/projetos"]);
  return { ok: true, id: saved.data.id };
}

/** Apaga a pasta. Os projetos dentro dela voltam para a raiz, porque o vínculo é `set null` no banco. */
export async function deleteFolderAction(input: unknown): Promise<FolderResult> {
  const guard = await guardAction("project-folder-delete");
  if (!guard.ok) return { ok: false, error: guard.error };

  const parsed = folderIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Escolha a pasta." };

  const removed = await deleteProjectFolder(guard.context.supabase, guard.context.organizationId, parsed.data);
  if (!removed.ok) return { ok: false, error: removed.error };

  await revalidateDomain(guard.context.organizationId, [cacheTags.projects], ["/projetos"]);
  return { ok: true };
}

/** Move o projeto para uma pasta, ou para a raiz quando ela é nula. */
export async function moveProjectAction(input: unknown): Promise<FolderResult> {
  const guard = await guardAction("project-move");
  if (!guard.ok) return { ok: false, error: guard.error };

  const parsed = moveProjectSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Escolha o projeto e a pasta." };

  const moved = await moveProject(guard.context.supabase, guard.context.organizationId, parsed.data);
  if (!moved.ok) return { ok: false, error: moved.error };

  await revalidateDomain(guard.context.organizationId, [cacheTags.projects], ["/projetos"]);
  return { ok: true };
}
