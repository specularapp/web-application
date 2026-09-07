import type { Icon } from "@phosphor-icons/react";
import {
  BriefcaseIcon,
  BuildingsIcon,
  CurrencyCircleDollarIcon,
  ListChecksIcon,
  ReceiptIcon,
  TargetIcon,
  TrophyIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react/ssr";
import type { Route } from "next";

export type DashboardBlockId = "projects" | "achievements" | "finance" | "clients" | "tasks" | "team" | "challenge" | "quote";

export type DashboardBlock = {
  id: DashboardBlockId;
  title: string;
  /** Do pacote `ssr`: a grade é Server Component, e a entrada padrão do Phosphor cria contexto ao carregar. */
  icon: Icon;
  /** Atalho do cabeçalho, tipado por rota: bloco sem tela fica sem atalho. */
  action?: { label: string; href: Route };
  /** Sem o cartão padrão: o conteúdo desenha a própria caixa, sem cabeçalho nem fio. */
  bare?: boolean;
  /** Ocupa duas linhas da grade: os blocos com lista. */
  tall?: boolean;
};

/** Os oito blocos do painel, na ordem de leitura padrão; a pessoa reordena e esconde pelo ajuste do
 *  painel, guardado em cookie. O ícone é o mesmo da rota no menu, para o bloco e a tela que ele abre
 *  falarem a mesma língua. */
export const dashboardBlocks: DashboardBlock[] = [
  { id: "achievements", title: "Conquistas", icon: TrophyIcon, bare: true },
  { id: "projects", title: "Projetos", icon: BriefcaseIcon, action: { label: "Ver todos", href: "/projetos" } },
  { id: "finance", title: "Financeiro", icon: CurrencyCircleDollarIcon, action: { label: "Ver tudo", href: "/financeiro" }, tall: true },
  { id: "clients", title: "Clientes", icon: BuildingsIcon, action: { label: "Ver todos", href: "/clientes" }, tall: true },
  { id: "tasks", title: "Tarefas", icon: ListChecksIcon, action: { label: "Ver todas", href: "/tarefas" }, tall: true },
  { id: "team", title: "Sua equipe", icon: UsersThreeIcon, action: { label: "Gerenciar", href: "/configuracoes/equipe" } },
  { id: "challenge", title: "Desafio diário", icon: TargetIcon },
  { id: "quote", title: "Último orçamento", icon: ReceiptIcon, action: { label: "Ver todos", href: "/orcamentos" }, tall: true },
];
