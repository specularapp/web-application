import type { QuoteStatus } from "@/features/quotes/summary";

/** Um orçamento ligado ao cliente, como aparece na ficha dele. */
export type ClientQuote = {
  id: string;
  /** Identificador curto, no padrão de `lib/utils/reference.ts`: "ORC-2026-0042". */
  number: string;
  title: string;
  /** Em centavos. */
  amount: number;
  status: QuoteStatus;
  /** Quando foi criado, no formato `yyyy-MM-dd`. */
  date: string;
};

export type ClientProjectStatus = "ongoing" | "done" | "paused";

/** Um projeto do cliente, como aparece na ficha dele. */
export type ClientProject = {
  id: string;
  reference: string;
  name: string;
  status: ClientProjectStatus;
  /** De 0 a 100. */
  progress: number;
};

export type Client = {
  id: string;
  /** Identificador curto que a pessoa vê, no padrão de `lib/utils/reference.ts`: "CLI-2026-0026". */
  reference: string;
  name: string;
  email: string | null;
  /** Só dígitos, com DDD, como vai para o banco: quem mostra aplica a máscara. */
  phone: string | null;
  avatarUrl: string | null;
  /** Quando entrou no sistema, no formato `yyyy-MM-dd`. */
  createdAt: string;
  /** Empresa ou negócio da pessoa, quando há. */
  company?: string;
  /** O que ela faz, em poucas palavras: "Design de interiores". */
  role?: string;
  city?: string;
  /** Endereço do site, com protocolo. */
  website?: string;
  /** Anotações da equipe sobre o cliente, em texto corrido. */
  about?: string;
  /** Etiquetas livres: serviços contratados, segmento, origem. */
  tags: string[];
  active: boolean;
  favorite: boolean;
  /** Os números da relação, em centavos onde é dinheiro. */
  stats: { quotes: number; projects: number; billed: number; open: number };
  /** Do mais recente para o mais antigo. */
  quotes: ClientQuote[];
  projects: ClientProject[];
};

/** O que o bloco de clientes do painel mostra: o total e os mais novos, do último a entrar para trás. */
export type ClientsSummary = {
  total: number;
  clients: Client[];
};
