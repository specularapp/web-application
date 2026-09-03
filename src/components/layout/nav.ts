import type { Icon } from "@phosphor-icons/react";
import {
  BriefcaseIcon,
  BuildingsIcon,
  CurrencyCircleDollarIcon,
  FlowArrowIcon,
  GearSixIcon,
  ReceiptIcon,
  SparkleIcon,
  SquaresFourIcon,
  TrophyIcon,
  UserIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react";
import type { Route } from "next";

export type NavLink = { label: string; href: Route; icon: Icon };

/** Entrada que abre no lugar da lista, com as páginas dela dentro e um voltar no topo. */
export type NavFolder = { label: string; icon: Icon; items: NavLink[] };

export type NavEntry = NavLink | NavFolder;

export type NavGroup = { title: string; entries: NavEntry[] };

export function isFolder(entry: NavEntry): entry is NavFolder {
  return "items" in entry;
}

// Só rota que existe entra aqui: `href` é tipado por rota e link para página inventada nem compila.
// Tarefas, calendário e relatório da referência ficam de fora até as páginas nascerem.
export const navGroups: NavGroup[] = [
  {
    title: "Área de trabalho",
    entries: [
      { label: "Espaço de trabalho", href: "/dashboard", icon: SquaresFourIcon },
      {
        label: "Orçamento",
        icon: ReceiptIcon,
        items: [
          { label: "Acompanhar", href: "/orcamentos", icon: ReceiptIcon },
          { label: "Gerar orçamento", href: "/orcamentos/novo", icon: ReceiptIcon },
        ],
      },
      {
        label: "Financeiro",
        icon: CurrencyCircleDollarIcon,
        items: [
          { label: "Visão geral", href: "/financeiro", icon: CurrencyCircleDollarIcon },
          { label: "Cobranças", href: "/cobrancas", icon: CurrencyCircleDollarIcon },
        ],
      },
      {
        label: "Projetos",
        icon: BriefcaseIcon,
        items: [
          { label: "Todos os projetos", href: "/projetos", icon: BriefcaseIcon },
          { label: "Contratos", href: "/contratos", icon: BriefcaseIcon },
          { label: "Novo contrato", href: "/contratos/novo", icon: BriefcaseIcon },
        ],
      },
      {
        label: "Clientes",
        icon: BuildingsIcon,
        items: [
          { label: "Funil de vendas", href: "/crm", icon: BuildingsIcon },
          { label: "Base de clientes", href: "/clientes", icon: BuildingsIcon },
        ],
      },
      { label: "Automação", href: "/automacoes", icon: FlowArrowIcon },
    ],
  },
  {
    title: "Organização",
    entries: [
      {
        label: "Perfil profissional",
        icon: UserIcon,
        items: [
          { label: "Portfólio", href: "/portfolio", icon: UserIcon },
          { label: "Currículo", href: "/curriculo", icon: UserIcon },
        ],
      },
      { label: "Equipe", href: "/configuracoes/equipe", icon: UsersThreeIcon },
    ],
  },
  {
    title: "Gestão",
    entries: [
      { label: "Inteligência artificial", href: "/ia", icon: SparkleIcon },
      { label: "Conquistas", href: "/conquistas", icon: TrophyIcon },
      {
        label: "Configurações",
        icon: GearSixIcon,
        items: [
          { label: "Geral", href: "/configuracoes", icon: GearSixIcon },
          { label: "Domínio", href: "/configuracoes/dominio", icon: GearSixIcon },
          { label: "Integrações", href: "/configuracoes/integracoes", icon: GearSixIcon },
          { label: "Notificações", href: "/configuracoes/notificacoes", icon: GearSixIcon },
          { label: "Plano", href: "/configuracoes/plano", icon: GearSixIcon },
          { label: "Segurança", href: "/configuracoes/seguranca", icon: GearSixIcon },
        ],
      },
    ],
  },
];
