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
    title: "Gere o primeiro orçamento",
    description: "Itens, condições e assinatura numa tela só; o cliente recebe um link e aprova por ele.",
    action: "Novo orçamento",
    href: "/orcamentos/novo",
  },
  {
    id: "equipe",
    icon: "users",
    eyebrow: "Ação",
    title: "Chame quem trabalha com você",
    description: "Convide por e-mail e escolha o papel de cada pessoa antes de ela entrar.",
    action: "Convidar pessoas",
    href: "/configuracoes/equipe",
  },
  {
    id: "dominio",
    icon: "globe",
    eyebrow: "Função",
    title: "Portfólio no seu endereço",
    description: "Aponte o domínio da sua marca e o portfólio passa a atender por ele.",
    action: "Configurar domínio",
    href: "/configuracoes/dominio",
  },
  {
    id: "seguranca",
    icon: "shield",
    eyebrow: "Segurança",
    title: "Ative o autenticador",
    description: "Um código a mais no login, e ninguém entra na sua conta só com a senha.",
    action: "Proteger a conta",
    href: "/configuracoes/seguranca",
  },
  {
    id: "portfolio",
    icon: "images",
    eyebrow: "Função",
    title: "Monte o seu portfólio",
    description: "Projetos entregues viram vitrine pública, com o seu nome e sem passar por outro site.",
    action: "Abrir o portfólio",
    href: "/portfolio",
  },
  {
    id: "integracoes",
    icon: "plugs",
    eyebrow: "Função",
    title: "Conecte as ferramentas",
    description: "Integrações trazem pagamento, agenda e e-mail para dentro do fluxo, sem copiar nada à mão.",
    action: "Ver integrações",
    href: "/configuracoes/integracoes",
  },
  {
    id: "automacoes",
    icon: "flow",
    eyebrow: "Atalho",
    title: "Deixe a cobrança avisar sozinha",
    description: "Uma automação lembra quem atrasou e arquiva o que foi pago, enquanto você entrega.",
    action: "Criar automação",
    href: "/automacoes",
  },
  {
    id: "funil",
    icon: "buildings",
    eyebrow: "Função",
    title: "Organize o funil de vendas",
    description: "Cada contato numa etapa, do primeiro oi ao contrato fechado, para nada esfriar no meio.",
    action: "Abrir o funil",
    href: "/crm",
  },
  {
    id: "conquistas",
    icon: "trophy",
    eyebrow: "Novo",
    title: "Suas conquistas contam",
    description: "Cada meta batida vira marca no perfil, e o histórico mostra o quanto você avançou.",
    action: "Ver conquistas",
    href: "/conquistas",
  },
  {
    id: "notificacoes",
    icon: "bell",
    eyebrow: "Ajuste",
    title: "Escolha o que te avisa",
    description: "Decida o que chega por e-mail e o que fica só no sino, por tipo de aviso.",
    action: "Ajustar avisos",
    href: "/configuracoes/notificacoes",
  },
  {
    id: "contratos",
    icon: "briefcase",
    eyebrow: "Ação",
    title: "Feche com contrato",
    description: "Modelo revisado, campos preenchidos pelo orçamento e assinatura pelo próprio link.",
    action: "Novo contrato",
    href: "/contratos/novo",
  },
  {
    id: "plano-projetos",
    icon: "crown",
    eyebrow: "Plano",
    title: "Projetos e clientes sem teto",
    description: "No gratuito param em três. No Pro, você cadastra quantos o trabalho pedir.",
    action: "Conhecer o Pro",
    href: "/configuracoes/plano",
    plan: true,
  },
  {
    id: "plano-marca",
    icon: "crown",
    eyebrow: "Plano",
    title: "PDF com a sua marca",
    description: "Orçamento e contrato saem com o seu logotipo, e não com o nosso.",
    action: "Tirar a marca d'água",
    href: "/configuracoes/plano",
    plan: true,
  },
  {
    id: "plano-financeiro",
    icon: "crown",
    eyebrow: "Plano",
    title: "Financeiro completo",
    description: "Fluxo de caixa, recebíveis e margem por projeto na mesma tela.",
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
