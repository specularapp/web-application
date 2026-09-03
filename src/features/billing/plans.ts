export type BillingCycle = "monthly" | "yearly";

export type PlanId = "free" | "pro" | "alliance";

export type Plan = {
  id: PlanId;
  name: string;
  description: string;
  /** Centavos por mês, já com o desconto do ciclo anual aplicado no próprio valor. */
  price: Record<BillingCycle, number>;
  features: { label: string; note?: string }[];
  popular?: boolean;
};

/** Rótulo curto do plano, para chip e etiqueta, onde o nome comercial inteiro não cabe. */
export const planBadges: Record<PlanId, string> = { free: "Grátis", pro: "Pro", alliance: "Alliance" };

export const YEARLY_DISCOUNT = 33;

// Quantos meses cada ciclo cobra de uma vez. O catálogo guarda o preço por mês porque é assim que a
// tabela de planos mostra; o Stripe cobra o período inteiro, então a conversão vive num lugar só.
export const cycleMonths: Record<BillingCycle, number> = { monthly: 1, yearly: 12 };

export const plans: Plan[] = [
  {
    id: "free",
    name: "Gratuito",
    description: "Ideal para organizar os primeiros freelas e conhecer a plataforma.",
    price: { monthly: 0, yearly: 0 },
    features: [
      { label: "Acesso para 1 usuário" },
      { label: "Até 3 projetos ativos" },
      { label: "Gestão financeira básica" },
      { label: "Orçamentos em PDF padrão" },
      { label: "Portfólio com marca d'água" },
    ],
  },
  {
    id: "pro",
    name: "Specular Pro",
    description: "O sistema operacional completo para o freelancer full-time.",
    price: { monthly: 9700, yearly: 6500 },
    popular: true,
    features: [
      { label: "Acesso para 1 usuário" },
      { label: "Projetos e clientes ilimitados" },
      { label: "Gestão financeira avançada" },
      { label: "Orçamentos e contratos prontos" },
      { label: "Portfólio com domínio próprio" },
    ],
  },
  {
    id: "alliance",
    name: "Specular Alliance",
    description: "Colaboração, escala e white-label para agências e estúdios.",
    price: { monthly: 24900, yearly: 16700 },
    features: [
      { label: "3 membros inclusos", note: "+R$49 cada" },
      { label: "Projetos e clientes em equipe" },
      { label: "Divisão de comissões e custos" },
      { label: "Gestão de contratos em lote" },
      { label: "Portfólio único da agência" },
    ],
  },
];

// Preço fechado não mostra centavo: "R$97" lê melhor que "R$97,00" numa tabela de planos. Preço com
// centavo mostra os dois dígitos, senão R$97,50 sairia como "R$97,5".
const round = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const exact = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function formatPrice(cents: number) {
  const value = cents / 100;
  return Number.isInteger(value) ? round.format(value) : exact.format(value);
}

export function planById(id: PlanId) {
  return plans.find((plan) => plan.id === id);
}

/** Valor que o Stripe cobra por período: o preço por mês multiplicado pelos meses do ciclo. */
export function chargeCents(id: PlanId, cycle: BillingCycle) {
  const plan = planById(id);
  return plan ? plan.price[cycle] * cycleMonths[cycle] : 0;
}

// Um formatador por moeda, guardado porque construir Intl.NumberFormat é caro e a lista de faturas
// repete a mesma moeda linha após linha.
const money = new Map<string, Intl.NumberFormat>();

/** Valor completo, com centavo, para resumo de cobrança e lista de faturas. */
export function formatMoney(cents: number, currency = "BRL") {
  const code = currency.toUpperCase();
  let formatter = money.get(code);

  if (!formatter) {
    formatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: code, minimumFractionDigits: 2 });
    money.set(code, formatter);
  }

  return formatter.format(cents / 100);
}
