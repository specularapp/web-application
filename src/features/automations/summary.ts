/**
 * O modelo das automações (2026-09-15, a pedido, sobre as referências n8n e Make do usuário): uma automação
 * é um **fluxo** de nós ligados por arestas, com um gatilho no começo, lógica no meio (esperar, condição) e
 * ações nas pontas (e-mail, aviso à equipe, webhook). O fluxo é dado, e não código: quem o lê é o motor
 * (`engine.ts`), no servidor, e quem o desenha é o editor, no navegador, sobre o mesmo JSON.
 */

export type AutomationStatus = "active" | "paused" | "draft";

export type NodeCategory = "trigger" | "logic" | "action";

export type TriggerKind = "client_created" | "quote_approved" | "contract_sent" | "contract_signed" | "invoice_due" | "invoice_overdue" | "payment_received" | "schedule" | "manual";

export type LogicKind = "wait" | "condition";

export type ActionKind = "send_email" | "notify_team" | "webhook";

export type NodeKind = `trigger.${TriggerKind}` | `logic.${LogicKind}` | `action.${ActionKind}`;

/** O que a pessoa preencheu no nó, chave por chave, no formato que o zod fecha. */
export type NodeConfig = Record<string, string | number | boolean>;

export type AutomationNode = {
  id: string;
  kind: NodeKind;
  /** O nome que a pessoa deu ao passo; sem ele vale o nome do catálogo. */
  title?: string;
  /** A posição no quadro, em unidades do quadro. */
  x: number;
  y: number;
  config: NodeConfig;
};

/** Uma ligação: de uma saída (`branch` só na condição: sim ou não) para a entrada de outro nó. */
export type AutomationEdge = {
  id: string;
  from: string;
  to: string;
  branch: "yes" | "no" | null;
};

export type RunStepStatus = "done" | "skipped" | "failed" | "waiting";

export type RunStep = {
  nodeId: string;
  kind: NodeKind;
  label: string;
  status: RunStepStatus;
  detail: string;
};

export type RunMode = "event" | "test";

export type RunStatus = "ok" | "failed" | "waiting";

export type AutomationRun = {
  id: string;
  /** ISO com hora. */
  at: string;
  mode: RunMode;
  /** O que disparou, em palavras ("Contrato assinado", "Teste manual"). */
  trigger: string;
  status: RunStatus;
  steps: RunStep[];
};

export type Automation = {
  id: string;
  name: string;
  description: string;
  status: AutomationStatus;
  /** O modelo de que nasceu, para a galeria saber o que já está instalado. */
  templateId: string | null;
  nodes: AutomationNode[];
  edges: AutomationEdge[];
  /** As últimas execuções, da mais nova para a mais velha. */
  runs: AutomationRun[];
  runCount: number;
  lastRunAt: string | null;
  createdAt: string;
  updatedAt: string;
};
