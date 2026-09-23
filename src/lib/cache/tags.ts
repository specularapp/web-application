/**
 * As tags do cache, num lugar só. Cada domínio tem a sua, e a escrita de um domínio derruba a leitura de
 * quem depende dele: salvar um cliente muda o cartão do cliente, o seletor do orçamento e o índice da casa,
 * então `clients` derruba os três.
 *
 * Sem este mapa, cada action escolheria a sua lista e a primeira dependência nova ficaria com cache velho
 * numa tela e novo na outra.
 */
export const cacheTags = {
  clients: "clients",
  catalog: "catalog",
  projects: "projects",
  tasks: "tasks",
  crm: "crm",
  quotes: "quotes",
  contracts: "contracts",
  finance: "finance",
  automations: "automations",
  forms: "forms",
  feedbacks: "feedbacks",
  approvals: "approvals",
  time: "time",
  organization: "organization",
  /** O menu: contagem por projeto e por funil, avisos e notificações. */
  shell: "shell",
  /** O índice da casa, que lê de sete domínios. */
  records: "records",
} as const;

export type DomainTag = (typeof cacheTags)[keyof typeof cacheTags];

/** O que cai quando um domínio é escrito, incluindo ele mesmo. */
const fallout: Record<DomainTag, DomainTag[]> = {
  clients: ["clients", "records", "quotes", "projects", "crm", "contracts", "finance"],
  catalog: ["catalog", "records", "quotes"],
  projects: ["projects", "records", "shell", "tasks", "contracts"],
  tasks: ["tasks", "records", "shell", "projects"],
  crm: ["crm", "shell"],
  quotes: ["quotes", "records", "catalog", "clients", "contracts", "finance"],
  contracts: ["contracts", "records", "clients"],
  finance: ["finance", "shell", "clients"],
  automations: ["automations"],
  forms: ["forms", "clients", "records"],
  feedbacks: ["feedbacks", "projects"],
  approvals: ["approvals", "projects", "tasks"],
  time: ["time"],
  organization: ["organization", "shell", "records"],
  shell: ["shell"],
  records: ["records"],
};

/** As tags a derrubar quando estes domínios mudam, sem repetição. */
export function tagsToDrop(...changed: DomainTag[]): DomainTag[] {
  return [...new Set(changed.flatMap((tag) => fallout[tag]))];
}
