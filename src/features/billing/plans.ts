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

export const YEARLY_DISCOUNT = 33;

export const plans: Plan[] = [
  {
    id: "free",
    name: "Gratuito",
    description: "Ideal para organizar os primeiros freelas e conhecer a plataforma.",
    price: { monthly: 0, yearly: 0 },
    features: [
      { label: "Acesso individual para 1 usuário" },
      { label: "Até 3 projetos ativos" },
      { label: "Gestão financeira básica" },
      { label: "Orçamentos em PDF padrão" },
      { label: "Portfólio público com marca d'água" },
    ],
  },
  {
    id: "pro",
    name: "Specular Pro",
    description: "O sistema operacional completo para o freelancer full-time.",
    price: { monthly: 9700, yearly: 6500 },
    popular: true,
    features: [
      { label: "Acesso individual para 1 usuário" },
      { label: "Projetos e clientes ilimitados" },
      { label: "Gestão financeira avançada" },
      { label: "Orçamentos e contratos automáticos" },
      { label: "Portfólio dinâmico com domínio próprio" },
    ],
  },
  {
    id: "alliance",
    name: "Specular Alliance",
    description: "Colaboração, escala e white-label para agências e estúdios.",
    price: { monthly: 24900, yearly: 16700 },
    features: [
      { label: "Até 3 membros inclusos", note: "R$49 por novo membro" },
      { label: "Projetos e clientes em equipe" },
      { label: "Divisão de comissões e custos" },
      { label: "Gestão de contratos em lote" },
      { label: "Portfólio unificado da agência" },
    ],
  },
];

// Preço fechado não mostra centavo: "R$97" lê melhor que "R$97,00" numa tabela de planos.
const formatter = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });

export function formatPrice(cents: number) {
  return formatter.format(cents / 100);
}
