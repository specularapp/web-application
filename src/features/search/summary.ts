import type { BadgeTone } from "@/components/ui/badge";
import { slugify } from "@/lib/utils/slug";

/**
 * A busca da casa (2026-10-26, no desenho da busca da Le Ange): um termo procura nos registros de todos os
 * domínios que a equipe pode ver, e cada grupo volta já cortado, com o total e o endereço do quadro filtrado.
 *
 * O modelo mora fora do `service.ts` porque a paleta é componente de cliente e só precisa dos tipos e da
 * ordem dos grupos: importar o serviço levaria as consultas inteiras para o navegador.
 */
export const searchGroupKeys = [
  "clients",
  "suppliers",
  "opportunities",
  "quotes",
  "contracts",
  "charges",
  "expenses",
  "projects",
  "tasks",
  "catalog",
  "forms",
  "approvals",
  "automations",
  "team",
] as const;

export type SearchGroupKey = (typeof searchGroupKeys)[number];

export const searchGroupLabels: Record<SearchGroupKey, string> = {
  clients: "Clientes",
  suppliers: "Fornecedores",
  opportunities: "Oportunidades",
  quotes: "Orçamentos",
  contracts: "Contratos",
  charges: "Cobranças",
  expenses: "Despesas",
  projects: "Projetos",
  tasks: "Tarefas",
  catalog: "Produtos e serviços",
  forms: "Formulários",
  approvals: "Aprovações",
  automations: "Automações",
  team: "Equipe",
};

/** Uma linha do resultado: o nome, a linha de apoio, onde o registro abre e a situação dele, quando tem. */
export type SearchHit = {
  id: string;
  title: string;
  detail: string;
  href: string;
  status?: { label: string; tone: BadgeTone };
};

/** `all` é o quadro do domínio já filtrado pelo termo; nulo onde o quadro não lê a busca pelo endereço. */
export type SearchGroup = {
  key: SearchGroupKey;
  label: string;
  total: number;
  hits: SearchHit[];
  all: string | null;
};

/** Abaixo disso a busca fica só nas páginas: duas letras já cortam a base, uma devolveria tudo. */
export const SEARCH_MIN_LENGTH = 2;

/** O mesmo teto da busca de cada quadro, que descarta o termo inteiro quando ele passa disso. */
export const SEARCH_MAX_LENGTH = 80;

/**
 * Se o termo já vale uma ida ao banco: duas letras ou números, sem contar pontuação. "!!" passaria no
 * tamanho e, sem nada para comparar, a busca dos quadros que filtram na memória devolveria a base inteira.
 */
export function searchable(term: string) {
  const trimmed = term.trim();
  return trimmed.length <= SEARCH_MAX_LENGTH && slugify(trimmed, SEARCH_MAX_LENGTH).replace(/-/g, "").length >= SEARCH_MIN_LENGTH;
}
