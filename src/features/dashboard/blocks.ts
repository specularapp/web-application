import type { Icon } from "@phosphor-icons/react";
import {
  BriefcaseIcon,
  BuildingsIcon,
  CurrencyCircleDollarIcon,
  ListChecksIcon,
  ReceiptIcon,
  TrophyIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react/ssr";
import type { Route } from "next";

export type DashboardBlockId = "projects" | "achievements" | "finance" | "clients" | "tasks" | "team" | "quote";

export type DashboardBlock = {
  id: DashboardBlockId;
  title: string;
  /** Do pacote `ssr`: a grade é Server Component, e a entrada padrão do Phosphor cria contexto ao carregar. */
  icon: Icon;
  /** Atalho do cabeçalho, tipado por rota: bloco sem tela pronta fica sem atalho. */
  action?: { label: string; href: Route };
};

/** Os sete blocos do painel, na ordem de leitura. O id é a área da grade em `dashboard-grid.module.css`,
 *  e o ícone é o mesmo da rota no menu, para o bloco e a tela que ele abre falarem a mesma língua. */
export const dashboardBlocks: DashboardBlock[] = [
  { id: "projects", title: "Projetos", icon: BriefcaseIcon, action: { label: "Ver todos", href: "/projetos" } },
  { id: "achievements", title: "Conquistas", icon: TrophyIcon, action: { label: "Ver todas", href: "/conquistas" } },
  { id: "finance", title: "Financeiro", icon: CurrencyCircleDollarIcon, action: { label: "Ver tudo", href: "/financeiro" } },
  { id: "clients", title: "Clientes", icon: BuildingsIcon, action: { label: "Ver todos", href: "/clientes" } },
  { id: "tasks", title: "Tarefas", icon: ListChecksIcon },
  { id: "team", title: "Sua equipe", icon: UsersThreeIcon, action: { label: "Gerenciar", href: "/configuracoes/equipe" } },
  { id: "quote", title: "Último orçamento", icon: ReceiptIcon, action: { label: "Ver todos", href: "/orcamentos" } },
];
