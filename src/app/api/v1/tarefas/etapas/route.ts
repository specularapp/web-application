/**
 * As etapas de tarefa para o aplicativo (2026-09-22). Elas passaram a ser linha de tabela da equipe em
 * 2026-09-21, e nasceram só com Server Action: sem esta rota o aplicativo não tem como descobrir o id de uma
 * etapa, e sem o id ele não cria tarefa, porque `stageId` é obrigatório. A regra da casa é que toda regra
 * sirva web e mobile, e era esta a metade que faltava.
 *
 * Mesma regra da web, pelo mesmo `service.ts`. Com `projeto` na busca, a resposta são as colunas daquele
 * quadro, na ordem dele; sem ele, é o catálogo da equipe.
 */
import { configureStagesSchema } from "@/features/tasks/schemas";
import { configureTaskStages, listProjectStages, listTaskStages } from "@/features/tasks/service";
import { authorizeDomain, fromMutation, readPayload } from "@/lib/api/domain";
import { invalidPayload } from "@/lib/api/v1";
import { z } from "zod";

const projectParam = z.uuid();

export async function GET(request: Request) {
  const auth = await authorizeDomain(request, "task-stages-read");
  if ("response" in auth) return auth.response;

  const projectId = new URL(request.url).searchParams.get("projeto");
  if (projectId === null) {
    return Response.json({ stages: await listTaskStages(auth.session.supabase, auth.session.organizationId) });
  }

  const parsed = projectParam.safeParse(projectId);
  if (!parsed.success) return invalidPayload();

  /* Projeto que ainda não escolheu colunas cai no catálogo da equipe, que é o que o quadro dele desenha:
     `getTasksBoardData` monta as colunas a partir de `listTaskStages` e usa a escolha do projeto só para
     limitar o que a janela da tarefa oferece. Sem esta volta, o aplicativo receberia lista vazia num projeto
     recém criado e não teria como criar a primeira tarefa (2026-09-22, achado pela sonda de aplicação). */
  const chosen = await listProjectStages(auth.session.supabase, auth.session.organizationId, parsed.data);
  const stages = chosen.length > 0 ? chosen : await listTaskStages(auth.session.supabase, auth.session.organizationId);

  return Response.json({ stages });
}

export async function PUT(request: Request) {
  const auth = await authorizeDomain(request, "task-stages-write");
  if ("response" in auth) return auth.response;

  const body = await readPayload(request, configureStagesSchema);
  if ("response" in body) return body.response;

  return fromMutation(
    await configureTaskStages(auth.session.supabase, auth.session.organizationId, body.data),
    auth.session.organizationId,
    ["tasks"],
  );
}
