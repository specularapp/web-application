"use server";

import { firstIssue, guardAction, revalidateDomain } from "@/features/organizations/context";
import { cacheTags } from "@/lib/cache/tags";
import {
  folderIdSchema,
  moveProjectSchema,
  projectFormSchema,
  projectIdSchema,
  projectPublicSchema,
  projectAppearanceSchema,
  projectStatusSchema,
  saveFolderSchema,
} from "./schemas";
import {
  deleteProject,
  deleteProjectFolder,
  getProjectDetails,
  moveProject,
  saveProject,
  saveProjectFolder,
  setProjectPublic,
  setProjectAppearance,
  setProjectStatus,
} from "./service";
import type { ProjectDetails } from "./summary";
import { enableProjectTracking } from "./tracking";
import { siteConfig } from "@/lib/metadata";
import { ensureClientFeedback } from "@/features/feedbacks/service";
import { feedbackUrl } from "@/features/feedbacks/share";

export type ProjectSaveResult = { ok: true; id: string } | { ok: false; error: string; field?: string };
export type ProjectDeleteResult = { ok: true } | { ok: false; error: string };
export type FolderSaveResult = { ok: true; id: string } | { ok: false; error: string; field?: string };
export type FolderResult = { ok: true } | { ok: false; error: string };
export type ProjectStatusResult = { ok: true; feedbackUrl?: string } | { ok: false; error: string };

/** Ativa ou renova por 180 dias o endereço que o cliente usa para acompanhar o projeto. */
export async function projectTrackingLinkAction(input: unknown) {
  const guard = await guardAction("project-tracking-link");
  if (!guard.ok) return { ok: false as const, error: guard.error };
  const parsed = projectIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Projeto inválido." };
  const result = await enableProjectTracking(guard.context.supabase, guard.context.organizationId, parsed.data);
  if (!result.ok) return result;
  await revalidateDomain(guard.context.organizationId, [cacheTags.projects], ["/projetos"]);
  return { ok: true as const, url: `${siteConfig.url}/acompanhar/${result.token}`, expiresAt: result.expiresAt };
}

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

/**
 * A situação pelo leque: pausar, retomar, concluir. Derruba `projects`, que leva tarefas e concha na
 * cascata: o projeto concluído sai da árvore do menu, e o quadro dele passa a mostrar isso.
 */
export async function setProjectStatusAction(input: unknown): Promise<ProjectStatusResult> {
  const guard = await guardAction("project-status");
  if (!guard.ok) return { ok: false, error: guard.error };

  const parsed = projectStatusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Situação inválida." };

  let publicFeedbackUrl: string | undefined;
  if (parsed.data.status === "done") {
    const feedback = await ensureClientFeedback(guard.context.supabase, guard.context.organizationId, guard.context.user.id, {
      projectId: parsed.data.id,
      title: "Como foi trabalhar conosco?",
      prompt: "Sua avaliação nos ajuda a melhorar as próximas entregas.",
    }, { updateExisting: false });
    if (!feedback.ok) return { ok: false, error: `Não foi possível preparar a avaliação: ${feedback.error}` };
    publicFeedbackUrl = feedbackUrl(feedback.data.feedback.shareToken);
  }

  const saved = await setProjectStatus(guard.context.supabase, guard.context.organizationId, parsed.data.id, parsed.data.status);
  if (!saved.ok) return { ok: false, error: saved.error };

  await revalidateDomain(
    guard.context.organizationId,
    parsed.data.status === "done" ? [cacheTags.projects, cacheTags.feedbacks] : [cacheTags.projects],
    parsed.data.status === "done" ? ["/projetos", "/tarefas", "/feedbacks"] : ["/projetos", "/tarefas"],
  );
  return { ok: true, feedbackUrl: publicFeedbackUrl };
}

/**
 * A cara do projeto: a cor e o glifo dele (2026-09-21, a pedido de "mudar a cor da página"). É escrita
 * própria, e não a ficha inteira, porque quem troca a cor está no quadro de tarefas ou no menu, sem o
 * formulário do projeto em mãos, e mandar o resto em branco apagaria o que não foi editado.
 *
 * A cor não é enfeite: ela pinta o azulejo do projeto no menu, a contagem ao lado dele, a marca gerada
 * quando não há logo e a capa do cartão na lista. Trocar aqui muda o projeto em toda a casa.
 */
export async function setProjectAppearanceAction(input: unknown): Promise<FolderResult> {
  const guard = await guardAction("project-appearance");
  if (!guard.ok) return { ok: false, error: guard.error };

  const parsed = projectAppearanceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error).error };

  const saved = await setProjectAppearance(guard.context.supabase, guard.context.organizationId, parsed.data);
  if (!saved.ok) return { ok: false, error: saved.error };

  await revalidateDomain(guard.context.organizationId, [cacheTags.projects], ["/projetos", "/tarefas"]);
  return { ok: true };
}

/** Entra ou sai da vitrine pública. Derruba `projects`, que leva a lista e o portfólio junto. */
export async function setProjectPublicAction(input: unknown): Promise<FolderResult> {
  const guard = await guardAction("project-public");
  if (!guard.ok) return { ok: false, error: guard.error };

  const parsed = projectPublicSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Projeto inválido." };

  const saved = await setProjectPublic(guard.context.supabase, guard.context.organizationId, parsed.data.id, parsed.data.isPublic);
  if (!saved.ok) return { ok: false, error: saved.error };

  await revalidateDomain(guard.context.organizationId, [cacheTags.projects], ["/projetos", "/portfolio"]);
  return { ok: true };
}
