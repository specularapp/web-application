import type { Icon } from "@phosphor-icons/react";
import {
  ArrowsSplitIcon,
  BellRingingIcon,
  CalendarCheckIcon,
  ClockCountdownIcon,
  CurrencyCircleDollarIcon,
  EnvelopeSimpleIcon,
  HandTapIcon,
  HourglassMediumIcon,
  ReceiptIcon,
  SignatureIcon,
  UserPlusIcon,
  WarningCircleIcon,
  WebhooksLogoIcon,
  PaperPlaneTiltIcon,
} from "@phosphor-icons/react/ssr";
import type { NodeCategory, NodeConfig, NodeKind } from "./summary";

/**
 * O catálogo dos nós: o que cada um é, como se desenha (glifo, categoria), o que a pessoa preenche (os
 * campos do painel) e como ele se resume numa linha embaixo do nome. É a fonte única para a paleta do
 * editor, o painel de configuração, o cartão da lista, o motor e o zod, então um nó novo entra aqui e vale
 * em todo lugar.
 */

export type FieldOption = { value: string; label: string };

export type FieldSpec = {
  key: string;
  label: string;
  type: "text" | "email" | "url" | "textarea" | "number" | "select" | "time" | "boolean";
  placeholder?: string;
  options?: FieldOption[];
  min?: number;
  max?: number;
  /** Só aparece quando outro campo tem este valor: o e-mail avulso só com "Outro endereço". */
  when?: { key: string; equals: string };
  /** A caixa de texto aceita as variáveis do fluxo, e o painel oferece o leque para inseri-las. */
  variables?: boolean;
};

export type NodeSpec = {
  kind: NodeKind;
  category: NodeCategory;
  label: string;
  description: string;
  icon: Icon;
  fields: FieldSpec[];
  defaults: NodeConfig;
  /** A linha embaixo do nome no quadro e no cartão, com o que foi preenchido. */
  summary: (config: NodeConfig) => string;
  /** As saídas: uma, ou as duas da condição. */
  outputs: readonly ("next" | "yes" | "no")[];
};

export const categories: Record<NodeCategory, { label: string; single: string; hue: string; description: string }> = {
  trigger: { label: "Gatilhos", single: "Gatilho", hue: "var(--sys-green)", description: "O que dá início ao fluxo" },
  logic: { label: "Lógica", single: "Lógica", hue: "var(--sys-orange)", description: "Esperar e decidir o caminho" },
  action: { label: "Ações", single: "Ação", hue: "var(--sys-blue)", description: "O que a automação faz" },
};

/** As variáveis que entram no texto dos e-mails e das condições, resolvidas pelo motor com os dados do evento. */
export const variables: { token: string; label: string; group: string }[] = [
  { token: "{{cliente.nome}}", label: "Nome do cliente", group: "Cliente" },
  { token: "{{cliente.primeiro_nome}}", label: "Primeiro nome do cliente", group: "Cliente" },
  { token: "{{cliente.email}}", label: "E-mail do cliente", group: "Cliente" },
  { token: "{{cliente.empresa}}", label: "Empresa do cliente", group: "Cliente" },
  { token: "{{cobranca.numero}}", label: "Número da cobrança", group: "Cobrança" },
  { token: "{{cobranca.valor}}", label: "Valor da cobrança", group: "Cobrança" },
  { token: "{{cobranca.vencimento}}", label: "Vencimento da cobrança", group: "Cobrança" },
  { token: "{{cobranca.link}}", label: "Link de pagamento", group: "Cobrança" },
  { token: "{{contrato.titulo}}", label: "Título do contrato", group: "Contrato" },
  { token: "{{contrato.numero}}", label: "Número do contrato", group: "Contrato" },
  { token: "{{contrato.link}}", label: "Link do contrato", group: "Contrato" },
  { token: "{{orcamento.numero}}", label: "Número do orçamento", group: "Orçamento" },
  { token: "{{orcamento.valor}}", label: "Valor do orçamento", group: "Orçamento" },
  { token: "{{equipe.nome}}", label: "Nome da equipe", group: "Equipe" },
  { token: "{{hoje}}", label: "Data de hoje", group: "Geral" },
];

/** Os campos do evento que uma condição pode olhar, com o rótulo que a pessoa lê. */
export const conditionFields: FieldOption[] = [
  { value: "contrato.situacao", label: "Situação do contrato" },
  { value: "cobranca.situacao", label: "Situação da cobrança" },
  { value: "cobranca.valor_centavos", label: "Valor da cobrança (em centavos)" },
  { value: "orcamento.valor_centavos", label: "Valor do orçamento (em centavos)" },
  { value: "cliente.empresa", label: "Empresa do cliente" },
  { value: "cliente.email", label: "E-mail do cliente" },
];

export const conditionOperators: FieldOption[] = [
  { value: "equals", label: "é igual a" },
  { value: "not_equals", label: "é diferente de" },
  { value: "contains", label: "contém" },
  { value: "gt", label: "é maior que" },
  { value: "lt", label: "é menor que" },
  { value: "empty", label: "está vazio" },
  { value: "not_empty", label: "está preenchido" },
];

const weekdays: FieldOption[] = [
  { value: "1", label: "Segunda-feira" },
  { value: "2", label: "Terça-feira" },
  { value: "3", label: "Quarta-feira" },
  { value: "4", label: "Quinta-feira" },
  { value: "5", label: "Sexta-feira" },
  { value: "6", label: "Sábado" },
  { value: "0", label: "Domingo" },
];

const recipientOptions: FieldOption[] = [
  { value: "client", label: "O cliente do evento" },
  { value: "team", label: "A equipe" },
  { value: "custom", label: "Outro endereço" },
];

const text = (value: unknown, fallback = "") => (typeof value === "string" && value.trim() ? value.trim() : fallback);
const num = (value: unknown, fallback: number) => (typeof value === "number" && Number.isFinite(value) ? value : fallback);
const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

const labelOf = (options: FieldOption[], value: unknown) => options.find((option) => option.value === value)?.label;

const emailFields: FieldSpec[] = [
  { key: "to", label: "Para quem", type: "select", options: recipientOptions },
  { key: "email", label: "E-mail", type: "email", placeholder: "nome@empresa.com", when: { key: "to", equals: "custom" } },
  { key: "subject", label: "Assunto", type: "text", placeholder: "Assunto do e-mail", variables: true },
  { key: "body", label: "Mensagem", type: "textarea", placeholder: "Escreva a mensagem. Cada linha vira um parágrafo.", variables: true },
];

const emailSummary = (config: NodeConfig) => {
  const subject = text(config.subject);
  const to = config.to === "custom" ? text(config.email, "outro endereço") : config.to === "team" ? "a equipe" : "o cliente";
  return subject ? `Para ${to}: "${subject}"` : `Para ${to}, sem assunto`;
};

export const nodeCatalog: Record<NodeKind, NodeSpec> = {
  "trigger.client_created": {
    kind: "trigger.client_created",
    category: "trigger",
    label: "Cliente cadastrado",
    description: "Quando um cliente novo entra na base",
    icon: UserPlusIcon,
    fields: [],
    defaults: {},
    summary: () => "Ao cadastrar um cliente",
    outputs: ["next"],
  },
  "trigger.quote_approved": {
    kind: "trigger.quote_approved",
    category: "trigger",
    label: "Orçamento aprovado",
    description: "Quando o cliente aprova um orçamento pelo link",
    icon: ReceiptIcon,
    fields: [],
    defaults: {},
    summary: () => "Ao aprovar um orçamento",
    outputs: ["next"],
  },
  "trigger.contract_sent": {
    kind: "trigger.contract_sent",
    category: "trigger",
    label: "Contrato enviado",
    description: "Quando um contrato sai para assinatura",
    icon: PaperPlaneTiltIcon,
    fields: [],
    defaults: {},
    summary: () => "Ao enviar um contrato",
    outputs: ["next"],
  },
  "trigger.contract_signed": {
    kind: "trigger.contract_signed",
    category: "trigger",
    label: "Contrato assinado",
    description: "Quando todas as partes assinam",
    icon: SignatureIcon,
    fields: [],
    defaults: {},
    summary: () => "Ao assinar um contrato",
    outputs: ["next"],
  },
  "trigger.invoice_due": {
    kind: "trigger.invoice_due",
    category: "trigger",
    label: "Cobrança perto de vencer",
    description: "Alguns dias antes do vencimento de uma cobrança em aberto",
    icon: CalendarCheckIcon,
    fields: [{ key: "days", label: "Dias antes do vencimento", type: "number", min: 0, max: 60 }],
    defaults: { days: 3 },
    summary: (config) => {
      const days = num(config.days, 3);
      return days === 0 ? "No dia do vencimento" : `${plural(days, "dia", "dias")} antes do vencimento`;
    },
    outputs: ["next"],
  },
  "trigger.invoice_overdue": {
    kind: "trigger.invoice_overdue",
    category: "trigger",
    label: "Cobrança vencida",
    description: "Alguns dias depois do vencimento, ainda sem pagamento",
    icon: WarningCircleIcon,
    fields: [{ key: "days", label: "Dias depois do vencimento", type: "number", min: 1, max: 90 }],
    defaults: { days: 1 },
    summary: (config) => `${plural(num(config.days, 1), "dia", "dias")} depois do vencimento`,
    outputs: ["next"],
  },
  "trigger.payment_received": {
    kind: "trigger.payment_received",
    category: "trigger",
    label: "Pagamento recebido",
    description: "Quando uma cobrança é paga",
    icon: CurrencyCircleDollarIcon,
    fields: [],
    defaults: {},
    summary: () => "Ao receber um pagamento",
    outputs: ["next"],
  },
  "trigger.schedule": {
    kind: "trigger.schedule",
    category: "trigger",
    label: "Agendamento",
    description: "Todo dia, toda semana ou todo mês, num horário",
    icon: ClockCountdownIcon,
    fields: [
      {
        key: "every",
        label: "Repete",
        type: "select",
        options: [
          { value: "day", label: "Todo dia" },
          { value: "week", label: "Toda semana" },
          { value: "month", label: "Todo mês" },
        ],
      },
      { key: "weekday", label: "Dia da semana", type: "select", options: weekdays, when: { key: "every", equals: "week" } },
      { key: "day", label: "Dia do mês", type: "number", min: 1, max: 28, when: { key: "every", equals: "month" } },
      { key: "time", label: "Horário", type: "time" },
    ],
    defaults: { every: "week", weekday: "1", day: 1, time: "08:00" },
    summary: (config) => {
      const time = text(config.time, "08:00");
      if (config.every === "day") return `Todo dia às ${time}`;
      if (config.every === "month") return `Todo dia ${num(config.day, 1)} às ${time}`;
      return `${labelOf(weekdays, String(config.weekday ?? "1")) ?? "Segunda-feira"} às ${time}`;
    },
    outputs: ["next"],
  },
  "trigger.manual": {
    kind: "trigger.manual",
    category: "trigger",
    label: "Disparo manual",
    description: "Só roda quando alguém pede, pelo botão",
    icon: HandTapIcon,
    fields: [],
    defaults: {},
    summary: () => "Quando alguém pedir",
    outputs: ["next"],
  },
  "logic.wait": {
    kind: "logic.wait",
    category: "logic",
    label: "Esperar",
    description: "Segura o fluxo por um tempo antes de seguir",
    icon: HourglassMediumIcon,
    fields: [
      { key: "amount", label: "Quanto tempo", type: "number", min: 1, max: 365 },
      {
        key: "unit",
        label: "Unidade",
        type: "select",
        options: [
          { value: "hours", label: "Horas" },
          { value: "days", label: "Dias" },
        ],
      },
    ],
    defaults: { amount: 3, unit: "days" },
    summary: (config) => {
      const amount = num(config.amount, 3);
      return config.unit === "hours" ? plural(amount, "hora", "horas") : plural(amount, "dia", "dias");
    },
    outputs: ["next"],
  },
  "logic.condition": {
    kind: "logic.condition",
    category: "logic",
    label: "Condição",
    description: "Segue por Sim ou por Não conforme um dado do evento",
    icon: ArrowsSplitIcon,
    fields: [
      { key: "field", label: "Olhar para", type: "select", options: conditionFields },
      { key: "operator", label: "Que", type: "select", options: conditionOperators },
      { key: "value", label: "Valor", type: "text", placeholder: "O valor de comparação", variables: true },
    ],
    defaults: { field: "contrato.situacao", operator: "not_equals", value: "assinado" },
    summary: (config) => {
      const field = labelOf(conditionFields, config.field) ?? "Campo";
      const operator = labelOf(conditionOperators, config.operator) ?? "é igual a";
      const needsValue = config.operator !== "empty" && config.operator !== "not_empty";
      return `${field} ${operator}${needsValue ? ` "${text(config.value, "vazio")}"` : ""}`;
    },
    outputs: ["yes", "no"],
  },
  "action.send_email": {
    kind: "action.send_email",
    category: "action",
    label: "Enviar e-mail",
    description: "Um e-mail no desenho da casa, com as variáveis do evento",
    icon: EnvelopeSimpleIcon,
    fields: emailFields,
    defaults: { to: "client", email: "", subject: "", body: "" },
    summary: emailSummary,
    outputs: ["next"],
  },
  "action.notify_team": {
    kind: "action.notify_team",
    category: "action",
    label: "Avisar a equipe",
    description: "Um aviso curto por e-mail para quem cuida da conta",
    icon: BellRingingIcon,
    fields: [{ key: "message", label: "Aviso", type: "textarea", placeholder: "O que a equipe precisa saber", variables: true }],
    defaults: { message: "" },
    summary: (config) => text(config.message, "Sem mensagem").split("\n")[0]!.slice(0, 80),
    outputs: ["next"],
  },
  "action.webhook": {
    kind: "action.webhook",
    category: "action",
    label: "Chamar webhook",
    description: "Manda os dados do evento para um endereço externo (n8n, Make, Zapier)",
    icon: WebhooksLogoIcon,
    fields: [
      { key: "url", label: "Endereço", type: "url", placeholder: "https://" },
      {
        key: "method",
        label: "Método",
        type: "select",
        options: [
          { value: "POST", label: "POST" },
          { value: "PUT", label: "PUT" },
        ],
      },
    ],
    defaults: { url: "", method: "POST" },
    summary: (config) => {
      const url = text(config.url);
      if (!url) return "Sem endereço";
      try {
        return `${text(config.method, "POST")} ${new URL(url).host}`;
      } catch {
        return url.slice(0, 60);
      }
    },
    outputs: ["next"],
  },
};

export const nodeKinds = Object.keys(nodeCatalog) as NodeKind[];

/** As configurações que todo passo tem, na aba Configurações da janela do passo: o motor lê as duas primeiras. */
export const settingsFields: FieldSpec[] = [
  { key: "continueOnFail", label: "Continuar se falhar", type: "boolean" },
  { key: "retries", label: "Tentar de novo", type: "number", min: 0, max: 3 },
  { key: "notes", label: "Notas", type: "textarea", placeholder: "Anotações sobre este passo, para a equipe" },
];

export const nodesOf = (category: NodeCategory) => nodeKinds.filter((kind) => nodeCatalog[kind].category === category).map((kind) => nodeCatalog[kind]);

export const isTrigger = (kind: NodeKind) => nodeCatalog[kind].category === "trigger";

/** O nome do gatilho em palavras, para o registro da execução ("Contrato assinado"). */
export const triggerLabel = (kind: NodeKind) => nodeCatalog[kind].label;

/** O nome de um passo: o que a pessoa deu, ou o do catálogo. */
export const nodeTitle = (node: { kind: NodeKind; title?: string }) => node.title?.trim() || nodeCatalog[node.kind].label;
