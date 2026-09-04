import type { Route } from "next";

/** Nome do ícone da sugestão. Vira componente só no cliente, em `suggestionIcons`, porque o Phosphor
 *  cria contexto React ao carregar e este módulo também é lido pelo servidor. */
export type SuggestionIcon =
  | "receipt"
  | "users"
  | "globe"
  | "shield"
  | "images"
  | "plugs"
  | "flow"
  | "buildings"
  | "trophy"
  | "bell"
  | "briefcase"
  | "crown";

/**
 * Uma sugestão do mural: o que o menu mostra no cartão do rodapé. `eyebrow` é a categoria curta,
 * `title` é a chamada, e `href` é tipado por rota, então sugestão para tela inventada nem compila.
 */
export type Suggestion = {
  id: string;
  icon: SuggestionIcon;
  eyebrow: string;
  title: string;
  description: string;
  action: string;
  href: Route;
  /** Só entra no sorteio enquanto há o que vender: teste em andamento ou plano gratuito em vigor. */
  plan?: boolean;
};

// Mural de sugestões do sistema, um por carga e escolhido ao acaso: ação, função, atalho ou plano, cada
// um apontando para uma tela real. A mesma frase todo dia vira papel de parede e a pessoa para de ler.
export const suggestions: Suggestion[] = [
  {
    id: "orcamento",
    icon: "receipt",
    eyebrow: "Ação",
    title: "Orçamento em minutos",
    description: "Itens e condições numa tela, aprovação pelo link.",
    action: "Criar orçamento",
    href: "/orcamentos/novo",
  },
  {
    id: "equipe",
    icon: "users",
    eyebrow: "Ação",
    title: "Equipe no time",
    description: "Convite por e-mail, com o papel de cada pessoa.",
    action: "Convidar",
    href: "/configuracoes/equipe",
  },
  {
    id: "dominio",
    icon: "globe",
    eyebrow: "Função",
    title: "Domínio próprio",
    description: "Portfólio no endereço da sua marca.",
    action: "Configurar",
    href: "/configuracoes/dominio",
  },
  {
    id: "seguranca",
    icon: "shield",
    eyebrow: "Segurança",
    title: "Autenticador",
    description: "Um código a mais no login, e a senha sozinha não entra.",
    action: "Ativar",
    href: "/configuracoes/seguranca",
  },
  {
    id: "portfolio",
    icon: "images",
    eyebrow: "Função",
    title: "Portfólio público",
    description: "Projetos entregues em vitrine, com o seu nome.",
    action: "Abrir",
    href: "/portfolio",
  },
  {
    id: "integracoes",
    icon: "plugs",
    eyebrow: "Função",
    title: "Integrações",
    description: "Pagamento, agenda e e-mail dentro do fluxo.",
    action: "Ver",
    href: "/configuracoes/integracoes",
  },
  {
    id: "automacoes",
    icon: "flow",
    eyebrow: "Atalho",
    title: "Cobrança automática",
    description: "Lembra quem atrasou e arquiva o que foi pago.",
    action: "Criar",
    href: "/automacoes",
  },
  {
    id: "funil",
    icon: "buildings",
    eyebrow: "Função",
    title: "Funil de vendas",
    description: "Cada contato numa etapa, do oi ao contrato.",
    action: "Abrir",
    href: "/crm",
  },
  {
    id: "conquistas",
    icon: "trophy",
    eyebrow: "Novo",
    title: "Conquistas",
    description: "Meta batida vira marca no perfil.",
    action: "Ver",
    href: "/conquistas",
  },
  {
    id: "notificacoes",
    icon: "bell",
    eyebrow: "Ajuste",
    title: "Avisos",
    description: "O que chega por e-mail e o que fica no sino.",
    action: "Ajustar",
    href: "/configuracoes/notificacoes",
  },
  {
    id: "contratos",
    icon: "briefcase",
    eyebrow: "Ação",
    title: "Contrato pronto",
    description: "Modelo revisado, campos vindos do orçamento.",
    action: "Criar",
    href: "/contratos/novo",
  },
  {
    id: "plano-projetos",
    icon: "crown",
    eyebrow: "Plano",
    title: "Projetos sem teto",
    description: "No gratuito param em três.",
    action: "Conhecer o Pro",
    href: "/configuracoes/plano",
    plan: true,
  },
  {
    id: "plano-marca",
    icon: "crown",
    eyebrow: "Plano",
    title: "PDF sem marca d'água",
    description: "Orçamento e contrato com o seu logotipo.",
    action: "Ver o Pro",
    href: "/configuracoes/plano",
    plan: true,
  },
  {
    id: "plano-financeiro",
    icon: "crown",
    eyebrow: "Plano",
    title: "Financeiro completo",
    description: "Caixa, recebíveis e margem por projeto.",
    action: "Assinar o Pro",
    href: "/configuracoes/plano",
    plan: true,
  },
];

export function findSuggestion(id: string | undefined) {
  return suggestions.find((suggestion) => suggestion.id === id);
}

/** Sorteio no servidor, a cada carga. Sugestão de plano só entra enquanto há o que vender. */
export function pickSuggestion(selling: boolean) {
  const pool = suggestions.filter((suggestion) => selling || !suggestion.plan);
  return pool[Math.floor(Math.random() * pool.length)] ?? pool[0];
}
