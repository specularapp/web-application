import { nodeCatalog } from "./catalog";
import type { AutomationEdge, AutomationNode, AutomationStatus, NodeConfig, NodeKind } from "./summary";

/**
 * As automações padrão da casa (2026-09-15, a pedido: "enviar mensagem para um usuário no e-mail, cobrança
 * recorrente no e-mail por determinados dias etc."): cada uma é um fluxo pronto, com o texto dos e-mails já
 * escrito com as variáveis do evento. Elas nascem instaladas na conta, algumas ativas, e também são a
 * galeria de "Nova automação", para a pessoa duplicar e mexer. Um modelo novo entra aqui e vale nos dois
 * lugares.
 */

export type AutomationTemplate = {
  id: string;
  name: string;
  description: string;
  /** Como nasce instalada: as de cobrança e contrato ativas, o resumo semanal como rascunho. */
  status: AutomationStatus;
  nodes: AutomationNode[];
  edges: AutomationEdge[];
};

/* A grade do quadro: uma coluna a cada 400 e uma linha a cada 320, para os cards (que trazem os campos dentro)
   abrirem arrumados e os ramos da condição não se cobrirem. */
const COLUMN = 400;
const ROW = 320;

const node = (id: string, kind: NodeKind, column: number, row: number, config: NodeConfig = {}): AutomationNode => ({
  id,
  kind,
  x: column * COLUMN,
  y: row * ROW,
  config: { ...nodeCatalog[kind].defaults, ...config },
});

const edge = (from: string, to: string, branch: "yes" | "no" | null = null): AutomationEdge => ({ id: `${from}-${to}${branch ? `-${branch}` : ""}`, from, to, branch });

const email = (subject: string, body: string[], to: "client" | "team" = "client"): NodeConfig => ({ to, email: "", subject, body: body.join("\n") });

export const automationTemplates: AutomationTemplate[] = [
  {
    id: "welcome",
    name: "Boas-vindas ao cliente",
    description: "Um e-mail de boas-vindas assim que o cliente entra na base, dizendo como o trabalho vai andar.",
    status: "active",
    nodes: [
      node("trigger", "trigger.client_created", 0, 0),
      node("email", "action.send_email", 1, 0, email("Bem-vindo à {{equipe.nome}}, {{cliente.primeiro_nome}}", ["Olá, {{cliente.primeiro_nome}}. É um prazer ter a {{cliente.empresa}} com a gente.", "A partir de agora tudo o que for do nosso trabalho juntos, orçamentos, contratos e cobranças, chega por aqui, com link para você acompanhar.", "Qualquer dúvida, é só responder este e-mail."])),
    ],
    edges: [edge("trigger", "email")],
  },
  {
    id: "invoice-reminder",
    name: "Lembrete de cobrança",
    description: "Três dias antes do vencimento, o cliente recebe o lembrete com o valor e o link de pagamento.",
    status: "active",
    nodes: [
      node("trigger", "trigger.invoice_due", 0, 0, { days: 3 }),
      node("email", "action.send_email", 1, 0, email("Sua cobrança {{cobranca.numero}} vence em {{cobranca.vencimento}}", ["Olá, {{cliente.primeiro_nome}}. A cobrança {{cobranca.numero}}, de {{cobranca.valor}}, vence em {{cobranca.vencimento}}.", "Para pagar, use o link abaixo. Se já pagou, pode ignorar este lembrete.", "{{cobranca.link}}"])),
    ],
    edges: [edge("trigger", "email")],
  },
  {
    id: "invoice-overdue",
    name: "Cobrança em atraso",
    description: "Um dia depois do vencimento avisa o cliente; cinco dias depois, se seguir em aberto, avisa de novo e chama a equipe.",
    status: "active",
    nodes: [
      node("trigger", "trigger.invoice_overdue", 0, 0, { days: 1 }),
      node("first", "action.send_email", 1, 0, email("Cobrança {{cobranca.numero}} em atraso", ["Olá, {{cliente.primeiro_nome}}. A cobrança {{cobranca.numero}}, de {{cobranca.valor}}, venceu em {{cobranca.vencimento}} e ainda não identificamos o pagamento.", "Você pode pagar pelo link abaixo. Se o pagamento já foi feito, desconsidere esta mensagem.", "{{cobranca.link}}"])),
      node("wait", "logic.wait", 2, 0, { amount: 5, unit: "days" }),
      node("check", "logic.condition", 3, 0, { field: "cobranca.situacao", operator: "not_equals", value: "paga" }),
      node("second", "action.send_email", 4, -0.5, email("Segundo aviso: cobrança {{cobranca.numero}} segue em aberto", ["Olá, {{cliente.primeiro_nome}}. A cobrança {{cobranca.numero}}, de {{cobranca.valor}}, segue em aberto desde {{cobranca.vencimento}}.", "Pedimos a regularização pelo link abaixo. Se houver algum problema com o pagamento, responda este e-mail para a gente resolver juntos.", "{{cobranca.link}}"])),
      node("team", "action.notify_team", 5, -0.5, { message: "A cobrança {{cobranca.numero}} de {{cliente.nome}} ({{cobranca.valor}}) segue em atraso depois de dois avisos. Vale um contato direto." }),
    ],
    edges: [edge("trigger", "first"), edge("first", "wait"), edge("wait", "check"), edge("check", "second", "yes"), edge("second", "team")],
  },
  {
    id: "contract-reminder",
    name: "Contrato aguardando assinatura",
    description: "Três dias depois do envio, se o contrato ainda não foi assinado, o cliente recebe um lembrete com o link.",
    status: "active",
    nodes: [
      node("trigger", "trigger.contract_sent", 0, 0),
      node("wait", "logic.wait", 1, 0, { amount: 3, unit: "days" }),
      node("check", "logic.condition", 2, 0, { field: "contrato.situacao", operator: "not_equals", value: "assinado" }),
      node("email", "action.send_email", 3, -0.5, email("Lembrete: o contrato {{contrato.numero}} aguarda sua assinatura", ["Olá, {{cliente.primeiro_nome}}. O contrato {{contrato.titulo}} ainda aguarda a sua assinatura.", "Abra pelo link abaixo, leia com calma e assine ao final da página. Leva menos de um minuto.", "{{contrato.link}}"])),
    ],
    edges: [edge("trigger", "wait"), edge("wait", "check"), edge("check", "email", "yes")],
  },
  {
    id: "contract-signed",
    name: "Contrato assinado",
    description: "Assim que todas as partes assinam, o cliente recebe o agradecimento e a equipe fica sabendo.",
    status: "active",
    nodes: [
      node("trigger", "trigger.contract_signed", 0, 0),
      node("email", "action.send_email", 1, -0.5, email("Contrato {{contrato.numero}} assinado. Vamos começar", ["Olá, {{cliente.primeiro_nome}}. O contrato {{contrato.titulo}} foi assinado por todas as partes.", "A cópia assinada fica disponível no link abaixo. A partir de agora começamos o trabalho pelo que está no escopo.", "{{contrato.link}}"])),
      node("team", "action.notify_team", 1, 0.5, { message: "{{cliente.nome}} assinou o contrato {{contrato.titulo}} ({{contrato.numero}}). Hora de abrir o projeto." }),
    ],
    edges: [edge("trigger", "email"), edge("trigger", "team")],
  },
  {
    id: "quote-approved",
    name: "Orçamento aprovado",
    description: "Quando o cliente aprova um orçamento, a equipe é avisada e o cliente recebe os próximos passos.",
    status: "active",
    nodes: [
      node("trigger", "trigger.quote_approved", 0, 0),
      node("team", "action.notify_team", 1, -0.5, { message: "{{cliente.nome}} aprovou o orçamento {{orcamento.numero}} ({{orcamento.valor}}). Gere o contrato." }),
      node("email", "action.send_email", 1, 0.5, email("Orçamento {{orcamento.numero}} aprovado. Próximos passos", ["Olá, {{cliente.primeiro_nome}}. Recebemos a aprovação do orçamento {{orcamento.numero}}, no valor de {{orcamento.valor}}.", "Em seguida enviamos o contrato para assinatura e, com ele assinado, começamos o trabalho."])),
    ],
    edges: [edge("trigger", "team"), edge("trigger", "email")],
  },
  {
    id: "payment-receipt",
    name: "Recibo de pagamento",
    description: "Ao receber um pagamento, o cliente ganha o recibo por e-mail na hora.",
    status: "paused",
    nodes: [
      node("trigger", "trigger.payment_received", 0, 0),
      node("email", "action.send_email", 1, 0, email("Recebemos seu pagamento da cobrança {{cobranca.numero}}", ["Olá, {{cliente.primeiro_nome}}. Confirmamos o pagamento de {{cobranca.valor}} referente à cobrança {{cobranca.numero}}.", "Obrigado pela confiança. Este e-mail vale como recibo."])),
    ],
    edges: [edge("trigger", "email")],
  },
  {
    id: "weekly-summary",
    name: "Resumo semanal para a equipe",
    description: "Toda segunda às 8h a equipe recebe um lembrete para revisar cobranças e contratos em aberto.",
    status: "draft",
    nodes: [
      node("trigger", "trigger.schedule", 0, 0, { every: "week", weekday: "1", time: "08:00" }),
      node("team", "action.notify_team", 1, 0, { message: "Começo de semana: revise as cobranças em aberto, os contratos aguardando assinatura e os orçamentos sem resposta." }),
    ],
    edges: [edge("trigger", "team")],
  },
];

export const findAutomationTemplate = (id: string) => automationTemplates.find((template) => template.id === id) ?? null;

/** O nó do gatilho de um fluxo, ou nada num fluxo que ainda não tem começo. */
export const triggerOf = (nodes: AutomationNode[]) => nodes.find((entry) => nodeCatalog[entry.kind].category === "trigger") ?? null;

/**
 * A ordem em que os nós aparecem no cartão e no resumo: do gatilho para a frente, seguindo as ligações, e o
 * que ficou solto no fim. É a ordem de leitura, e não a do quadro.
 */
export function orderedNodes(nodes: AutomationNode[], edges: AutomationEdge[]) {
  const byId = new Map(nodes.map((entry) => [entry.id, entry]));
  const seen = new Set<string>();
  const ordered: AutomationNode[] = [];
  const visit = (id: string) => {
    if (seen.has(id)) return;
    const entry = byId.get(id);
    if (!entry) return;
    seen.add(id);
    ordered.push(entry);
    edges.filter((link) => link.from === id).forEach((link) => visit(link.to));
  };
  const trigger = triggerOf(nodes);
  if (trigger) visit(trigger.id);
  nodes.forEach((entry) => visit(entry.id));
  return ordered;
}
