import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getIssuer } from "@/features/organizations/service";
import { createAdminClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import { nodeCatalog } from "./catalog";
import { emptyContext, runAutomation, sampleContext, teamOf, type RunContext, type Runner, type SampleClient } from "./engine";
import type { SaveAutomationInput } from "./schemas";
import type { Automation, AutomationEdge, AutomationNode, AutomationRun, AutomationStatus, RunStep, TriggerKind } from "./summary";
import { findAutomationTemplate, orderedNodes, triggerOf } from "./templates";

/**
 * A regra das automações contra o banco. O fluxo é dado, e não código: nós e arestas vivem em `jsonb`, e
 * quem os lê é o motor. O relógio que dispara agendamento e vencimento de cobrança entra depois (Inngest,
 * mapeado em `libs.md`); hoje o que dispara são os eventos da própria aplicação e o teste manual.
 */
export type AutomationsClient = SupabaseClient<Database>;

export type ServiceResult<T> = { ok: true; data: T } | { ok: false; error: string };
export type SaveResult = { ok: true; automation: Automation } | { ok: false; error: string };
export type TestResult = { ok: true; automation: Automation; run: AutomationRun } | { ok: false; error: string };

/** Quantas execuções a tela mostra por automação. */
const RUN_HISTORY = 20;

const columns = `
  id, name, description, status, template_id, nodes, edges, run_count, last_run_at, created_at, updated_at,
  automation_runs(id, at, mode, trigger_label, status, steps)
`;

type RunRow = {
  id: string;
  at: string;
  mode: "event" | "test";
  trigger_label: string;
  status: "ok" | "failed" | "waiting";
  steps: RunStep[];
};

type Row = {
  id: string;
  name: string;
  description: string;
  status: AutomationStatus;
  template_id: string | null;
  nodes: AutomationNode[];
  edges: AutomationEdge[];
  run_count: number;
  last_run_at: string | null;
  created_at: string;
  updated_at: string;
  automation_runs: RunRow[];
};

function toAutomation(row: Row): Automation {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    status: row.status,
    templateId: row.template_id,
    nodes: row.nodes ?? [],
    edges: row.edges ?? [],
    runs: [...(row.automation_runs ?? [])]
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, RUN_HISTORY)
      .map((run) => ({ id: run.id, at: run.at, mode: run.mode, trigger: run.trigger_label, status: run.status, steps: run.steps ?? [] })),
    runCount: row.run_count,
    lastRunAt: row.last_run_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listAutomations(client: AutomationsClient, organizationId: string): Promise<Automation[]> {
  const { data } = await client
    .from("automations")
    .select(columns)
    .eq("organization_id", organizationId)
    .order("updated_at", { ascending: false })
    .limit(200);

  return ((data ?? []) as unknown as Row[]).map(toAutomation);
}

export async function getAutomation(
  client: AutomationsClient,
  organizationId: string,
  id: string,
): Promise<Automation | null> {
  const { data } = await client.from("automations").select(columns).eq("organization_id", organizationId).eq("id", id).maybeSingle();
  return data ? toAutomation(data as unknown as Row) : null;
}

/** Um fluxo roda quando tem gatilho e pelo menos uma ação ligada a ele. */
export function complete(automation: Pick<Automation, "nodes" | "edges">) {
  const trigger = triggerOf(automation.nodes);
  if (!trigger) return false;
  return orderedNodes(automation.nodes, automation.edges).some((node) => nodeCatalog[node.kind].category === "action");
}

/** Nasce de um modelo, pausada e pronta para ativar, ou do zero, como rascunho vazio. */
export async function createAutomation(
  client: AutomationsClient,
  organizationId: string,
  userId: string,
  input: { templateId: string | null },
): Promise<ServiceResult<Automation>> {
  const template = input.templateId ? findAutomationTemplate(input.templateId) : null;

  const { data, error } = await client
    .from("automations")
    .insert({
      organization_id: organizationId,
      created_by: userId,
      name: template ? template.name : "Nova automação",
      description: template ? template.description : "",
      status: template ? "paused" : "draft",
      template_id: template?.id ?? null,
      nodes: template ? template.nodes : [],
      edges: template ? template.edges : [],
    })
    .select("id")
    .single();

  if (error || !data) return { ok: false, error: error?.message || "Não foi possível criar a automação." };

  const created = await getAutomation(client, organizationId, data.id);
  return created ? { ok: true, data: created } : { ok: false, error: "Não foi possível criar a automação." };
}

export async function saveAutomation(
  client: AutomationsClient,
  organizationId: string,
  input: SaveAutomationInput,
): Promise<SaveResult> {
  const current = await getAutomation(client, organizationId, input.id);
  if (!current) return { ok: false, error: "Essa automação não existe mais." };

  const nodes = input.nodes.map((node) => ({ ...node, config: { ...nodeCatalog[node.kind].defaults, ...node.config } }));
  // Uma ativa que perdeu o gatilho ou as ações não tem como rodar: volta a pausada em vez de falhar calada.
  const status = current.status === "active" && !complete({ nodes, edges: input.edges }) ? "paused" : current.status;

  const { error } = await client
    .from("automations")
    .update({ name: input.name, description: input.description, nodes, edges: input.edges, status })
    .eq("id", input.id)
    .eq("organization_id", organizationId);

  if (error) return { ok: false, error: error.message };

  const saved = await getAutomation(client, organizationId, input.id);
  return saved ? { ok: true, automation: saved } : { ok: false, error: "Não foi possível salvar a automação." };
}

export async function setAutomationStatus(
  client: AutomationsClient,
  organizationId: string,
  id: string,
  status: Extract<AutomationStatus, "active" | "paused">,
): Promise<SaveResult> {
  const current = await getAutomation(client, organizationId, id);
  if (!current) return { ok: false, error: "Essa automação não existe mais." };
  if (status === "active" && !complete(current)) {
    return { ok: false, error: "Adicione um gatilho e pelo menos uma ação ligada a ele antes de ativar." };
  }

  const { error } = await client.from("automations").update({ status }).eq("id", id).eq("organization_id", organizationId);
  if (error) return { ok: false, error: error.message };

  const saved = await getAutomation(client, organizationId, id);
  return saved ? { ok: true, automation: saved } : { ok: false, error: "Não foi possível mudar a situação." };
}

export async function duplicateAutomation(
  client: AutomationsClient,
  organizationId: string,
  userId: string,
  id: string,
): Promise<ServiceResult<Automation>> {
  const source = await getAutomation(client, organizationId, id);
  if (!source) return { ok: false, error: "Essa automação não existe mais." };

  const { data, error } = await client
    .from("automations")
    .insert({
      organization_id: organizationId,
      created_by: userId,
      name: `${source.name} (cópia)`,
      description: source.description,
      status: complete(source) ? "paused" : "draft",
      template_id: source.templateId,
      nodes: source.nodes,
      edges: source.edges,
    })
    .select("id")
    .single();

  if (error || !data) return { ok: false, error: error?.message || "Não foi possível duplicar." };

  const copy = await getAutomation(client, organizationId, data.id);
  return copy ? { ok: true, data: copy } : { ok: false, error: "Não foi possível duplicar." };
}

export async function deleteAutomation(
  client: AutomationsClient,
  organizationId: string,
  id: string,
): Promise<ServiceResult<undefined>> {
  const { error } = await client.from("automations").delete().eq("organization_id", organizationId).eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: undefined };
}

/**
 * A execução é registro do que o motor fez, e nenhuma tabela de cobrança ou de execução aceita escrita pela
 * sessão: quem grava é o servidor, pela chave secreta, na função que também acerta o contador.
 */
async function record(automationId: string, run: AutomationRun) {
  await createAdminClient().rpc("record_automation_run", {
    p_automation_id: automationId,
    p_mode: run.mode,
    p_trigger_label: run.trigger,
    p_status: run.status,
    p_steps: run.steps,
  });
}

/** Quem está testando, e com quem o teste conversa: a equipe em vigor e o primeiro cadastro da base. */
async function runnerOf(client: AutomationsClient, organizationId: string, userId: string) {
  const [{ data: profile }, issuer, { data: contact }] = await Promise.all([
    client.from("profiles").select("full_name, email").eq("id", userId).maybeSingle(),
    getIssuer(client, organizationId),
    client.from("clients").select("name, email, company").eq("organization_id", organizationId).order("created_at").limit(1).maybeSingle(),
  ]);

  const runner: Runner = { name: profile?.full_name || profile?.email || "Equipe", email: profile?.email ?? "" };
  const sample: SampleClient = {
    name: contact?.name ?? "Cliente de teste",
    email: contact?.email ?? runner.email,
    company: contact?.company ?? contact?.name ?? "Cliente de teste",
  };

  return { runner, team: teamOf(issuer, runner), sample };
}

/** Roda o fluxo agora, em teste: dados da conta, esperas puladas e os e-mails para quem testa. */
export async function testAutomation(
  client: AutomationsClient,
  organizationId: string,
  userId: string,
  id: string,
): Promise<TestResult> {
  const automation = await getAutomation(client, organizationId, id);
  if (!automation) return { ok: false, error: "Essa automação não existe mais." };

  const { runner, team, sample } = await runnerOf(client, organizationId, userId);
  const run = await runAutomation(automation, {
    mode: "test",
    trigger: "Teste manual",
    context: sampleContext(team, sample),
    runner,
  });

  await record(id, run);

  const refreshed = await getAutomation(client, organizationId, id);
  return { ok: true, automation: refreshed ?? automation, run };
}

/**
 * Um evento da aplicação aconteceu (o contrato foi enviado, foi assinado): toda automação ativa que começa
 * por esse gatilho roda com os dados do evento. Quem chama não espera pelo resultado nem quebra se ele
 * falhar; o registro fica na execução.
 *
 * Roda com a chave secreta de propósito: o evento pode nascer de uma página pública, em que não há sessão
 * nenhuma, como a assinatura de um contrato pelo link do cliente.
 */
export async function dispatchAutomationEvent(
  organizationId: string,
  kind: TriggerKind,
  data: Partial<Omit<RunContext, "equipe" | "hoje">>,
) {
  if (!organizationId) return 0;

  const admin = createAdminClient();
  const [issuer, automations] = await Promise.all([
    getIssuer(admin, organizationId),
    listAutomations(admin, organizationId),
  ]);

  const runner: Runner = { name: issuer.name, email: issuer.email ?? "" };
  const context: RunContext = { ...emptyContext(teamOf(issuer, runner)), ...data };
  const targets = automations.filter(
    (automation) => automation.status === "active" && triggerOf(automation.nodes)?.kind === `trigger.${kind}`,
  );

  await Promise.all(
    targets.map(async (automation) => {
      try {
        const run = await runAutomation(automation, {
          mode: "event",
          trigger: nodeCatalog[`trigger.${kind}`].label,
          context,
          runner,
        });
        await record(automation.id, run);
      } catch (error) {
        console.error(`automação ${automation.id} falhou:`, error);
      }
    }),
  );

  return targets.length;
}
