import type {
  Flow,
  FlowActionKind,
  FlowChannel,
  FlowEdge,
  FlowOperator,
  FlowStarterId,
  FlowStatus,
  FlowStep,
  FlowStepData,
  FlowStepKind,
  FlowTriggerKind,
} from "./types";

export type FlowStepGroup = "start" | "content" | "ai" | "logic";

export type FlowStepSpec = { label: string; description: string; group: FlowStepGroup; hue: string };

export const flowChannels: Record<FlowChannel, { label: string; hue: string }> = {
  instagram: { label: "Instagram", hue: "var(--sys-pink)" },
  whatsapp: { label: "WhatsApp", hue: "var(--color-whatsapp)" },
  email: { label: "E-mail", hue: "var(--sys-indigo)" },
};

export const flowSteps: Record<FlowStepKind, FlowStepSpec> = {
  trigger: { label: "Gatilho", description: "O que faz o contato entrar no fluxo.", group: "start", hue: "var(--sys-green)" },
  message: { label: "Mensagem", description: "Balões, botões e espera de resposta.", group: "content", hue: "var(--sys-blue)" },
  input: { label: "Coletar dado", description: "Pergunta e guarda e-mail, telefone ou texto.", group: "content", hue: "var(--sys-cyan)" },
  ai: { label: "Assistente de IA", description: "Conduz a conversa até um objetivo.", group: "ai", hue: "var(--sys-purple)" },
  actions: { label: "Ações", description: "Etiqueta, oportunidade, responsável, aviso.", group: "logic", hue: "var(--sys-yellow)" },
  condition: { label: "Condição", description: "Segue por Sim ou Não conforme as regras.", group: "logic", hue: "var(--sys-teal)" },
  randomizer: { label: "Teste A/B", description: "Divide quem passa em variantes.", group: "logic", hue: "var(--sys-indigo)" },
  delay: { label: "Espera", description: "Aguarda um tempo ou até um horário.", group: "logic", hue: "var(--sys-orange)" },
  jump: { label: "Ir para outro fluxo", description: "Passa o contato para outro fluxo.", group: "logic", hue: "var(--sys-brown)" },
};

export const flowGroupLabels: Record<FlowStepGroup, string> = {
  start: "Começo",
  content: "Conteúdo",
  ai: "IA",
  logic: "Lógica",
};

export const flowTriggers: Record<FlowTriggerKind, { label: string; placeholder: string; channel: FlowChannel | null }> = {
  "ig-comment": { label: "Comentário no Instagram", placeholder: "Palavra no comentário, como ORÇAMENTO", channel: "instagram" },
  "ig-dm-keyword": { label: "Palavra-chave no direct", placeholder: "SITE, PREÇO, PORTFÓLIO", channel: "instagram" },
  "ig-story-reply": { label: "Resposta ao story", placeholder: "Qualquer resposta ou uma palavra", channel: "instagram" },
  "ig-story-mention": { label: "Menção no story", placeholder: "Quando marcarem o perfil", channel: "instagram" },
  "ig-ad": { label: "Anúncio que leva ao direct", placeholder: "Nome da campanha", channel: "instagram" },
  "ig-link": { label: "Link que abre o direct", placeholder: "ref=bio, ref=site", channel: "instagram" },
  "wa-keyword": { label: "Mensagem com palavra-chave", placeholder: "orçamento, site, loja", channel: "whatsapp" },
  "site-form": { label: "Formulário do site", placeholder: "Nome do formulário", channel: null },
  "tag-added": { label: "Etiqueta adicionada", placeholder: "lead-quente", channel: null },
};

export const flowActions: Record<FlowActionKind, { label: string; placeholder: string }> = {
  "add-tag": { label: "Adicionar etiqueta", placeholder: "lead-quente" },
  "remove-tag": { label: "Remover etiqueta", placeholder: "frio" },
  "create-opportunity": { label: "Criar oportunidade no funil", placeholder: "Funil comercial, Novo contato" },
  assign: { label: "Atribuir conversa", placeholder: "Nome de quem atende" },
  "set-field": { label: "Definir campo do contato", placeholder: "interesse = site" },
  "notify-team": { label: "Avisar a equipe", placeholder: "Lead quente no direct" },
};

export const flowOperators: Record<FlowOperator, string> = {
  is: "é",
  "is-not": "não é",
  contains: "contém",
  "has-tag": "tem a etiqueta",
};

export const flowConditionFields = ["Segue o perfil", "Etiqueta", "Serviço de interesse", "Orçamento estimado", "Já é cliente", "Cidade"];

export const flowVariables = [
  { key: "primeiro_nome", label: "Primeiro nome" },
  { key: "empresa", label: "Empresa" },
  { key: "servico", label: "Serviço de interesse" },
  { key: "link_portfolio", label: "Link do portfólio" },
  { key: "link_agenda", label: "Link da agenda" },
];

export const variableLabel = (key: string) => flowVariables.find((item) => item.key === key)?.label ?? key;

export const flowInputFields = { email: "E-mail", telefone: "Telefone", texto: "Texto livre" } as const;

export const flowDelayUnits = { minutos: "minutos", horas: "horas", dias: "dias" } as const;

export const flowStatuses: Record<FlowStatus, { label: string; tone: "success" | "warning" | "neutral" }> = {
  live: { label: "No ar", tone: "success" },
  paused: { label: "Pausado", tone: "warning" },
  draft: { label: "Rascunho", tone: "neutral" },
};

export type FlowPortTone = "reply" | "noreply" | "yes" | "no" | "button";

export type FlowPort = { id: string; label: string; tone?: FlowPortTone };

/** As saídas de um passo, na ordem em que aparecem no cartão. */
export function portsOf(data: FlowStepData): FlowPort[] {
  switch (data.kind) {
    case "message": {
      const ports: FlowPort[] = data.message.buttons.map((button) => ({ id: `btn:${button.id}`, label: button.label || "Botão", tone: "button" }));
      if (data.message.waitReply) ports.push({ id: "reply", label: "Se responder", tone: "reply" }, { id: "noreply", label: "Se não responder", tone: "noreply" });
      ports.push({ id: "next", label: "Próximo passo" });
      return ports;
    }
    case "condition":
      return [
        { id: "yes", label: "Sim", tone: "yes" },
        { id: "no", label: "Não", tone: "no" },
      ];
    case "randomizer":
      return data.variants.map((variant) => ({ id: `var:${variant.id}`, label: `Variante ${variant.label}, ${variant.weight}%` }));
    case "ai":
      return [
        { id: "done", label: "Objetivo concluído", tone: "yes" },
        { id: "handoff", label: "Pediu atendimento humano", tone: "no" },
      ];
    case "input":
      return [
        { id: "reply", label: "Respondeu", tone: "reply" },
        { id: "noreply", label: "Não respondeu", tone: "noreply" },
      ];
    case "jump":
      return [];
    case "trigger":
      return [{ id: "next", label: "Então" }];
    default:
      return [{ id: "next", label: "Próximo passo" }];
  }
}

export const newFlowId = () => Math.random().toString(36).slice(2, 9);

/** Um passo novo do tipo pedido, com o conteúdo inicial que faz sentido para ele. */
export function newFlowStep(kind: FlowStepKind, at: { x: number; y: number }, count: number, channel: FlowChannel = "instagram"): FlowStep {
  const data: FlowStepData = (() => {
    switch (kind) {
      case "trigger":
        return { kind, triggers: [] };
      case "message":
        return { kind, message: { channel, texts: ["Oi, {{primeiro_nome}}!"], buttons: [], waitReply: false, ...(channel === "email" ? { subject: "Uma novidade do estúdio" } : {}) } };
      case "input":
        return { kind, question: "Qual o seu melhor e-mail para eu te mandar a proposta?", field: "email", saveAs: "email", retry: "Esse e-mail parece incompleto. Pode conferir?" };
      case "ai":
        return { kind, goal: "Entender o projeto e marcar uma conversa", handoff: "Pedir para falar com uma pessoa" };
      case "actions":
        return { kind, actions: [{ id: newFlowId(), kind: "add-tag", value: "" }] };
      case "condition":
        return { kind, match: "all", rules: [{ id: newFlowId(), field: "Segue o perfil", operator: "is", value: "Sim" }] };
      case "randomizer":
        return {
          kind,
          variants: [
            { id: newFlowId(), label: "A", weight: 50 },
            { id: newFlowId(), label: "B", weight: 50 },
          ],
        };
      case "delay":
        return { kind, delay: { mode: "for", amount: 1, unit: "horas" } };
      case "jump":
        return { kind, flowId: "" };
    }
  })();
  const title = kind === "message" ? `Mensagem ${count}` : kind === "condition" ? "Segue o perfil?" : flowSteps[kind].label;
  return { id: `s-${newFlowId()}`, title, x: Math.round(at.x), y: Math.round(at.y), data };
}

export const flowStarters: Record<FlowStarterId, { label: string; description: string; trigger: FlowTriggerKind | null; value: string; text: string; replies: string[] }> = {
  "ig-comment": {
    label: "Comentou no post, recebe no direct",
    description: "Quem comentar a palavra no post recebe o link no direct, com resposta pública no comentário.",
    trigger: "ig-comment",
    value: "PORTFÓLIO",
    text: "Oi, {{primeiro_nome}}! Aqui está o portfólio completo que você pediu: {{link_portfolio}}",
    replies: ["Te mandei no direct!", "Olha o seu direct"],
  },
  "ig-dm": {
    label: "Palavra-chave no direct",
    description: "Responde na hora quando alguém escreve uma palavra como SITE ou PREÇO.",
    trigger: "ig-dm-keyword",
    value: "SITE",
    text: "Oi, {{primeiro_nome}}! Que bom que você quer um site novo. Me conta rapidinho sobre o seu negócio?",
    replies: [],
  },
  "ig-story": {
    label: "Resposta ao story",
    description: "Agradece quem respondeu o story e puxa a conversa para um orçamento.",
    trigger: "ig-story-reply",
    value: "",
    text: "Valeu por responder o story, {{primeiro_nome}}! Quer que eu te mostre como foi esse projeto por dentro?",
    replies: [],
  },
  "wa-keyword": {
    label: "Palavra-chave no WhatsApp",
    description: "Atende quem chega pelo WhatsApp com a palavra do anúncio ou do site.",
    trigger: "wa-keyword",
    value: "orçamento",
    text: "Olá, {{primeiro_nome}}! Aqui é do estúdio. Para montar o seu orçamento, qual serviço você procura?",
    replies: [],
  },
  "site-form": {
    label: "Lead do formulário do site",
    description: "Dá as boas-vindas a quem preencheu o formulário e agenda a primeira conversa.",
    trigger: "site-form",
    value: "Contato do site",
    text: "Oi, {{primeiro_nome}}! Recebi o seu contato pelo site. Quer escolher um horário para conversarmos? {{link_agenda}}",
    replies: [],
  },
  reactivation: {
    label: "Reativar cliente antigo",
    description: "Volta a falar com quem não fecha projeto há meses, quando recebe a etiqueta.",
    trigger: "tag-added",
    value: "inativo-6-meses",
    text: "Oi, {{primeiro_nome}}! Faz tempo que não conversamos. Como está o site da {{empresa}}?",
    replies: [],
  },
  blank: {
    label: "Começar do zero",
    description: "Só o gatilho, para montar passo a passo.",
    trigger: null,
    value: "",
    text: "",
    replies: [],
  },
};

/** O fluxo que nasce de um modelo: o gatilho e, quando há texto, a primeira mensagem já ligada a ele. */
export function flowFromStarter(starter: FlowStarterId): Flow {
  const preset = flowStarters[starter];
  const channel: FlowChannel = preset.trigger ? (flowTriggers[preset.trigger].channel ?? "instagram") : "instagram";
  const trigger: FlowStep = {
    id: "trigger",
    title: "Quando",
    x: 80,
    y: 120,
    data: { kind: "trigger", triggers: preset.trigger ? [{ id: "entry", kind: preset.trigger, value: preset.value, publicReplies: [...preset.replies] }] : [] },
  };
  const message: FlowStep = { id: "message", title: "Mensagem 1", x: 480, y: 120, data: { kind: "message", message: { channel, texts: [preset.text], buttons: [], waitReply: false } } };
  const withMessage = Boolean(preset.text);
  return {
    id: "novo",
    name: starter === "blank" ? "Novo fluxo" : preset.label,
    folder: "Geral",
    status: "draft",
    steps: withMessage ? [trigger, message] : [trigger],
    edges: withMessage ? [{ id: "trigger-next-message", from: "trigger", port: "next", to: "message" }] : [],
    stats: {},
    entered: 0,
    completed: 0,
    updatedAt: "2026-10-25T12:00:00.000Z",
    publishedAt: null,
    createdBy: "Marina Costa",
  };
}

export const isFlowStarter = (value: string | undefined): value is FlowStarterId => Boolean(value && value in flowStarters);

/** O resumo da lista: por onde o fluxo fala, o que o dispara e quantas mensagens saíram e foram clicadas. */
export function summarizeFlow(flow: Flow) {
  const channels = new Set<FlowChannel>();
  const triggers: FlowTriggerKind[] = [];
  for (const step of flow.steps) {
    if (step.data.kind === "message") channels.add(step.data.message.channel);
    if (step.data.kind === "trigger")
      for (const trigger of step.data.triggers) {
        triggers.push(trigger.kind);
        const channel = flowTriggers[trigger.kind].channel;
        if (channel) channels.add(channel);
      }
  }
  const messages = flow.steps.filter((step) => step.data.kind === "message").map((step) => flow.stats[step.id]);
  const sent = messages.reduce((sum, stats) => sum + (stats?.sent ?? 0), 0);
  const clicked = messages.reduce((sum, stats) => sum + (stats?.clicked ?? 0), 0);
  return { channels: [...channels], triggers, sent, clicked, stepCount: flow.steps.length };
}

/** O primeiro passo depois de uma saída, seguindo a ligação. */
export const followEdge = (edges: FlowEdge[], from: string, port: string) => edges.find((edge) => edge.from === from && edge.port === port)?.to;
