/**
 * O que a API aceita de uma chave e o que um webhook pode assinar (2026-10-29, a pedido: "integração deixe completo
 * tudo igual temos na Le Ange"). Fica num módulo sem servidor porque a tela monta os formulários e a documentação
 * daqui, e o servidor confere a chave e despacha os eventos pela mesma lista: escopo ou evento que não está aqui
 * não existe em lugar nenhum.
 */

export const API_KEY_PREFIX = "spk_live_";
export const MAX_API_KEYS = 20;
export const MAX_WEBHOOKS = 10;
export const DEFAULT_RATE_LIMIT = 60;

export type ApiEndpoint = { method: "GET" | "POST" | "PATCH" | "DELETE"; path: string; description: string };

export const apiScopes = [
  {
    id: "clientes:ler",
    label: "Clientes: consultar",
    description: "Lista e ficha de clientes",
    endpoints: [
      { method: "GET", path: "/clientes", description: "Lista paginada, com busca e filtros" },
      { method: "GET", path: "/clientes/{id}", description: "Ficha de um cliente" },
    ],
  },
  {
    id: "clientes:escrever",
    label: "Clientes: criar e editar",
    description: "Cadastra ou atualiza um cliente",
    endpoints: [{ method: "POST", path: "/clientes", description: "Cria o cliente, ou edita quando o corpo traz o id" }],
  },
  {
    id: "crm:ler",
    label: "Funil de vendas: consultar",
    description: "Oportunidades, funis e etapas",
    endpoints: [{ method: "GET", path: "/crm", description: "Oportunidades e a árvore de pastas e funis" }],
  },
  {
    id: "orcamentos:ler",
    label: "Orçamentos: consultar",
    description: "Lista de orçamentos",
    endpoints: [{ method: "GET", path: "/orcamentos", description: "Lista paginada, com busca e situação" }],
  },
  {
    id: "contratos:ler",
    label: "Contratos: consultar",
    description: "Lista de contratos",
    endpoints: [{ method: "GET", path: "/contratos", description: "Lista paginada, com busca e situação" }],
  },
  {
    id: "projetos:ler",
    label: "Projetos: consultar",
    description: "Lista de projetos",
    endpoints: [{ method: "GET", path: "/projetos", description: "Lista paginada, com busca e situação" }],
  },
  {
    id: "tarefas:ler",
    label: "Tarefas: consultar",
    description: "Lista de tarefas",
    endpoints: [{ method: "GET", path: "/tarefas", description: "Tarefas com os filtros da lista" }],
  },
  {
    id: "cobrancas:ler",
    label: "Cobranças: consultar",
    description: "Cobranças a receber",
    endpoints: [{ method: "GET", path: "/cobrancas", description: "Cobranças de entrada, com parcelas" }],
  },
  {
    id: "financeiro:ler",
    label: "Financeiro: consultar",
    description: "Visão geral do financeiro",
    endpoints: [{ method: "GET", path: "/financeiro?periodo=mes", description: "Entradas, saídas e saldos do período" }],
  },
  {
    id: "webhooks:ler",
    label: "Webhooks: consultar",
    description: "Destinos e entregas",
    endpoints: [
      { method: "GET", path: "/integracoes/webhooks", description: "Webhooks da equipe" },
      { method: "GET", path: "/integracoes/webhooks/{id}/entregas", description: "As últimas entregas de um webhook" },
    ],
  },
  {
    id: "webhooks:gerenciar",
    label: "Webhooks: gerenciar",
    description: "Cadastrar, testar, reenviar e girar segredo",
    endpoints: [
      { method: "POST", path: "/integracoes/webhooks", description: "Cadastra um webhook e devolve o segredo" },
      { method: "PATCH", path: "/integracoes/webhooks/{id}", description: "Edita endereço, eventos e situação" },
      { method: "DELETE", path: "/integracoes/webhooks/{id}", description: "Apaga o webhook e as entregas dele" },
      { method: "POST", path: "/integracoes/webhooks/{id}/testar", description: "Envia o evento de teste" },
      { method: "POST", path: "/integracoes/webhooks/{id}/segredo", description: "Gira o segredo de assinatura" },
      { method: "POST", path: "/integracoes/entregas/{id}/reenviar", description: "Reenvia uma entrega" },
    ],
  },
] as const satisfies readonly { id: string; label: string; description: string; endpoints: readonly ApiEndpoint[] }[];

export type ApiScope = (typeof apiScopes)[number]["id"];

export const apiScopeIds = apiScopes.map((scope) => scope.id) as [ApiScope, ...ApiScope[]];

export const scopeLabel = (id: string) => apiScopes.find((scope) => scope.id === id)?.label ?? id;

/** Os eventos que um webhook assina: só os que a casa de fato dispara. O de teste não se assina, só se envia. */
export const webhookEvents = [
  { id: "cliente.criado", label: "Cliente criado", description: "Um cliente novo entrou na base." },
  { id: "orcamento.aprovado", label: "Orçamento aprovado", description: "O cliente aprovou o orçamento pelo link." },
  { id: "orcamento.recusado", label: "Orçamento recusado", description: "O cliente recusou o orçamento pelo link." },
  { id: "contrato.enviado", label: "Contrato enviado", description: "O contrato saiu para as partes assinarem." },
  { id: "contrato.assinado", label: "Contrato assinado", description: "A última parte assinou o contrato." },
  { id: "pagamento.recebido", label: "Pagamento recebido", description: "Uma cobrança ou parcela foi marcada como paga." },
] as const;

export type WebhookEvent = (typeof webhookEvents)[number]["id"] | "teste";

export const webhookEventIds = webhookEvents.map((event) => event.id) as [Exclude<WebhookEvent, "teste">, ...Exclude<WebhookEvent, "teste">[]];

export const eventLabel = (id: string) => (id === "teste" ? "Teste" : (webhookEvents.find((event) => event.id === id)?.label ?? id));

export type ApiKeyStatus = "active" | "paused" | "expired" | "revoked";

export const apiKeyStatusLabel: Record<ApiKeyStatus, string> = { active: "Ativa", paused: "Pausada", expired: "Expirada", revoked: "Revogada" };

export function apiKeyStatus(key: { revokedAt: string | null; expiresAt: string | null; enabled: boolean }, now = Date.now()): ApiKeyStatus {
  if (key.revokedAt) return "revoked";
  if (key.expiresAt && Date.parse(key.expiresAt) <= now) return "expired";
  return key.enabled ? "active" : "paused";
}

/** O que a porta de entrada responde a uma chave recusada, em palavras, para o registro de chamadas. */
export const accessCodeLabel: Record<string, string> = {
  chave_invalida: "Chave inválida",
  chave_revogada: "Chave revogada",
  chave_expirada: "Chave expirada",
  chave_pausada: "Chave pausada",
  chave_sem_dono: "Quem criou saiu da equipe",
  ip_nao_permitido: "IP não permitido",
  escopo_ausente: "Sem permissão",
  rota_sem_chave: "Rota só por sessão",
  limite_excedido: "Limite por minuto",
};

export type ApiKeyView = {
  id: string;
  name: string;
  description: string;
  prefix: string;
  scopes: ApiScope[];
  enabled: boolean;
  expiresAt: string | null;
  rateLimit: number;
  allowedIps: string[];
  lastUsedAt: string | null;
  lastUsedIp: string | null;
  rotatedAt: string | null;
  revokedAt: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ApiRequestView = {
  id: number;
  keyId: string;
  method: string;
  path: string;
  status: number;
  code: string | null;
  scope: string | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
};

export type DeliveryStatus = "pending" | "delivered" | "failed";

export type WebhookDeliveryView = {
  id: string;
  endpointId: string;
  eventId: string;
  event: string;
  payload: unknown;
  status: DeliveryStatus;
  attempts: number;
  responseStatus: number | null;
  responseExcerpt: string | null;
  durationMs: number | null;
  error: string | null;
  redeliveryOf: string | null;
  createdAt: string;
  deliveredAt: string | null;
};

export type WebhookView = {
  id: string;
  description: string;
  url: string;
  events: Exclude<WebhookEvent, "teste">[];
  active: boolean;
  secretVersion: number;
  secretRotatedAt: string | null;
  createdAt: string;
  updatedAt: string;
  lastDelivery: WebhookDeliveryView | null;
};

/** O nome que a linha mostra: a descrição, ou o host do endereço quando não há descrição. */
export function webhookName(webhook: Pick<WebhookView, "description" | "url">) {
  if (webhook.description) return webhook.description;
  try {
    return new URL(webhook.url).host;
  } catch {
    return webhook.url;
  }
}
