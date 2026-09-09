import type { QuoteStatus } from "@/features/quotes/summary";

/** Produto é coisa entregue; serviço é trabalho feito. É o que separa preço por unidade de preço por projeto ou hora. */
export type CatalogKind = "product" | "service";

/** Como o preço é cobrado: por projeto fechado, por hora, por mês ou por unidade entregue. */
export type CatalogUnit = "project" | "hour" | "month" | "unit";

/** Matiz da paleta do sistema que tinge a arte gerada, o azulejo dela e a etiqueta de preço. */
export type CatalogHue = "red" | "orange" | "yellow" | "green" | "mint" | "teal" | "cyan" | "blue" | "indigo" | "purple" | "pink" | "brown";

/** Um orçamento em que o item entrou, como aparece na ficha dele. */
export type CatalogQuote = {
  id: string;
  /** Identificador curto, no padrão de `lib/utils/reference.ts`: "ORC-2026-0042". */
  number: string;
  title: string;
  /** Para quem foi: a empresa ou a pessoa. */
  client: string;
  /** Em centavos. */
  amount: number;
  status: QuoteStatus;
  /** Quando foi criado, no formato `yyyy-MM-dd`. */
  date: string;
};

/**
 * Estoque de um produto: quanto há para entregar, quanto cabe quando está cheio (a tabela mostra "48/100") e
 * a partir de quanto a equipe quer ser avisada. Produto sem estoque é produto sob demanda ou sem limite, como
 * hospedagem: o campo fica de fora e a ficha diz isso.
 */
export type CatalogStock = { quantity: number; capacity: number; minimum: number };

export type CatalogItem = {
  id: string;
  /** Identificador curto que a pessoa vê, no padrão de `lib/utils/reference.ts`: "CAT-2026-0007". */
  reference: string;
  name: string;
  /** O que é, em uma ou duas frases: o cartão corta em duas linhas, a ficha mostra inteiro. */
  description: string;
  kind: CatalogKind;
  /** Agrupamento livre, como "Aplicação web" ou "Identidade visual". */
  category: string;
  /** Em centavos. */
  price: number;
  unit: CatalogUnit;
  /** Prazo típico de entrega em dias, só para serviço: de `min` a `max`. */
  duration?: { min: number; max: number };
  /** Só para produto com quantidade controlada; ver `CatalogStock`. */
  stock?: CatalogStock;
  /** Foto do produto ou capa do serviço; sem ela o cartão desenha a arte gerada em `artwork.ts`. */
  imageUrl: string | null;
  hue: CatalogHue;
  active: boolean;
  /** Quando entrou no catálogo, no formato `yyyy-MM-dd`. */
  createdAt: string;
  /** Quem cadastrou, pelo nome: a tabela mostra a bolinha e o nome. */
  createdBy: string;
  /** Última mudança na ficha, no formato `yyyy-MM-dd`. */
  updatedAt: string;
  /** Custo direto estimado, em centavos; nulo quando a equipe não mede. É o que dá a margem. */
  cost: number | null;
  /** Desconto máximo que a equipe dá sem aprovação, em pontos percentuais inteiros. */
  maxDiscount: number;
  /** Rodadas de revisão inclusas, só para serviço. */
  revisions?: number;
  /** Dias de garantia ou suporte inclusos depois da entrega; nulo quando não se aplica. */
  supportDays: number | null;
  /** O que a entrega inclui, um item por linha: é o que vai para o orçamento como escopo. */
  deliverables: string[];
  /** O que a equipe precisa receber do cliente para começar. */
  requirements: string[];
  /** Etiquetas livres: tecnologia, público, forma de venda. */
  tags: string[];
  /** Anotações da equipe, em texto corrido. */
  notes?: string;
  /** Os números de venda, em centavos onde é dinheiro. */
  stats: {
    /** Em quantos orçamentos o item entrou. */
    quotes: number;
    /** Quantos desses foram aprovados. */
    approved: number;
    /** Quanto o item já faturou nos aprovados. */
    billed: number;
    /** Quando entrou num orçamento pela última vez; nulo se nunca entrou. */
    lastQuotedAt: string | null;
  };
  /** Do mais recente para o mais antigo, só os últimos. */
  quotes: CatalogQuote[];
};
