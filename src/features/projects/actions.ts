"use server";

import { previewProjectDetails } from "./details-preview";
import { projectFormSchema } from "./schemas";
import { upsertProject } from "./store";
import type { ProjectDetails } from "./summary";

const INVALID = "Confira os dados informados.";

export type ProjectSaveResult = { ok: true; id: string } | { ok: false; error: string; field?: string };

/**
 * A ficha completa de um projeto, buscada quando a janela abre.
 *
 * É buscada, e não mandada junto da listagem, de propósito: a ficha tem equipe, tarefas, orçamentos e
 * atividade, e doze delas por página encheriam a carga com o que a grade nem desenha. O cartão carrega só o
 * que mostra, e o resto chega quando alguém pede, no contrato da ficha do cliente.
 *
 * Hoje lê do store em memória, montado sobre as prévias, porque **o domínio não existe no banco**. Quando a
 * tabela nascer, o corpo vira uma consulta com a RLS valendo e a assinatura continua a mesma; a mesma leitura
 * ganha um `service.ts` e um Route Handler em `api/v1` para o aplicativo, no contrato que `organizations` já
 * segue.
 */
export async function loadProjectAction(id: string): Promise<ProjectDetails | null> {
  return previewProjectDetails(id);
}

/**
 * Salva a ficha, criando ou editando: é o mesmo formulário e a mesma regra. A entrada é validada aqui com
 * zod mesmo já validada na tela, porque é assim que toda entrada de usuário chega ao servidor; o campo com
 * problema volta pelo caminho dele, para o formulário acender o campo certo.
 *
 * A gravação vai para o store em memória (2026-09-13), então criar e editar funcionam de ponta a ponta na
 * tela: a lista refeita pelo servidor já traz o projeto novo. Quando a tabela nascer, a escrita vai para
 * `service.ts`, com a RLS valendo, exposta por esta action e por um Route Handler em `api/v1`.
 */
export async function saveProjectAction(input: unknown): Promise<ProjectSaveResult> {
  const parsed = projectFormSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue?.path.join(".");
    return { ok: false, error: issue?.message ?? INVALID, field: field || undefined };
  }

  const saved = upsertProject(parsed.data);
  if (!saved) return { ok: false, error: "Esse cliente não está mais na base.", field: "clientId" };

  return { ok: true, id: saved.id };
}
