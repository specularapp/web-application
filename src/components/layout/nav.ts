import type { Icon } from "@phosphor-icons/react";
import {
  AddressBookIcon,
  BellIcon,
  BriefcaseIcon,
  ClipboardTextIcon,
  ChatCircleTextIcon,
  CheckSquareOffsetIcon,
  CreditCardIcon,
  CurrencyCircleDollarIcon,
  FileTextIcon,
  FlowArrowIcon,
  FunnelIcon,
  GearSixIcon,
  GlobeIcon,
  IdentificationCardIcon,
  ListChecksIcon,
  PlugsConnectedIcon,
  ReceiptIcon,
  ShieldCheckIcon,
  SparkleIcon,
  SquaresFourIcon,
  StorefrontIcon,
  TrophyIcon,
  UserCircleIcon,
  UserIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react";
import type { Route } from "next";

export type NavLink = { label: string; href: Route; icon: Icon };

/** Entrada que abre no lugar da lista, com as páginas dela dentro e um voltar no topo. O matiz é
 *  a cor com que a busca marca as páginas que moram aqui. */
export type NavFolder = {
  label: string;
  icon: Icon;
  hue: string;
  items: NavLink[];
  /**
   * A pasta abre também a árvore de um domínio abaixo das páginas fixas, e não só elas (2026-09-10, quando
   * Tarefas virou grupo): pasta, projeto e funil vêm do banco e têm endereço próprio, então não caberiam em
   * `items`, que é a lista fixa de rotas do menu. O menu pede o desenho a quem sabe montá-la, e a árvore
   * chega por prop, como as notificações e o aviso. Tarefas e funil de vendas usam a mesma peça.
   */
  tree?: "tarefas" | "funis";
};

export type NavEntry = NavLink | NavFolder;

export type NavGroup = { title: string; icon: Icon; hue: string; entries: NavEntry[] };

export function isFolder(entry: NavEntry): entry is NavFolder {
  return "items" in entry;
}

/** A página em vigor é a própria rota ou qualquer coisa abaixo dela: `/clientes/abc` é `/clientes`. */
export function isCurrent(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Um degrau da rota que o topo mostra. Só o nome: a rota é contexto, e glifo ali só fazia barulho. */
export type NavCrumb = { label: string };

/** Onde a página mora no menu: a rota até ela à esquerda do topo e o nome dela no meio. */
export type NavLocation = {
  /** O grupo do menu onde a página mora. */
  group: NavCrumb;
  /** A pasta, quando a página mora numa; a rota solta não tem. */
  folder?: NavCrumb;
  page: NavLink;
};

/**
 * Acha no menu onde a rota está, para o topo da página dizer a mesma coisa que o menu diz. Sai daqui, e
 * não de um mapa novo, porque `navGroups` já é a fonte única das rotas: página que nasce no menu ganha o
 * topo de graça, e página que não está lá não inventa um nome.
 *
 * Entre duas rotas que casam, ganha a mais específica: `/orcamentos/novo` é "Gerar orçamento", e não
 * "Acompanhar", que também casaria por prefixo.
 */
export function navLocation(pathname: string): NavLocation | null {
  const found: NavLocation[] = [];

  for (const group of navGroups) {
    const crumb: NavCrumb = { label: group.title };

    for (const entry of group.entries) {
      if (isFolder(entry)) {
        for (const item of entry.items) {
          if (isCurrent(pathname, item.href)) {
            found.push({ group: crumb, folder: { label: entry.label }, page: item });
          }
        }
      } else if (isCurrent(pathname, entry.href)) {
        found.push({ group: crumb, page: entry });
      }
    }
  }

  return found.sort((a, b) => b.page.href.length - a.page.href.length)[0] ?? null;
}

/** Página do menu já achatada, com o nome de onde ela mora, para a busca mostrar o contexto. */
export type NavResult = NavLink & { section: string; hue: string };

/** Atalho da busca: o matiz é o mesmo modelo do Badge, um token de cor que a pílula tinge sozinha. */
export type NavHighlight = NavLink & { hue: string };

// Só rota que existe entra aqui: `href` é tipado por rota e link para página inventada nem compila.
// Calendário e relatório da referência ficam de fora até as páginas nascerem.
export const navGroups: NavGroup[] = [
  {
    title: "Trabalho",
    icon: SquaresFourIcon,
    hue: "var(--sys-blue)",
    entries: [
      { label: "Painel", href: "/dashboard", icon: SquaresFourIcon },
      {
        label: "Tarefas",
        icon: ListChecksIcon,
        hue: "var(--sys-cyan)",
        tree: "tarefas",
        items: [{ label: "Todas as tarefas", href: "/tarefas", icon: ListChecksIcon }],
      },
      { label: "Projetos", href: "/projetos", icon: BriefcaseIcon },
      { label: "Aprovações", href: "/aprovacoes", icon: CheckSquareOffsetIcon },
      { label: "Feedbacks", href: "/feedbacks", icon: ChatCircleTextIcon },
    ],
  },
  {
    title: "Vendas",
    icon: FunnelIcon,
    hue: "var(--sys-orange)",
    entries: [
      {
        label: "Funil de vendas",
        icon: FunnelIcon,
        hue: "var(--sys-teal)",
        tree: "funis",
        items: [{ label: "Todas as oportunidades", href: "/crm", icon: FunnelIcon }],
      },
      { label: "Clientes e fornecedores", href: "/clientes", icon: AddressBookIcon },
      { label: "Formulários", href: "/formularios", icon: ClipboardTextIcon },
      { label: "Produtos e serviços", href: "/catalogo", icon: StorefrontIcon },
      { label: "Orçamentos", href: "/orcamentos", icon: ReceiptIcon },
      { label: "Contratos", href: "/contratos", icon: FileTextIcon },
    ],
  },
  {
    title: "Gestão",
    icon: CurrencyCircleDollarIcon,
    hue: "var(--sys-green)",
    entries: [
      {
        label: "Financeiro",
        icon: CurrencyCircleDollarIcon,
        hue: "var(--sys-green)",
        items: [
          { label: "Visão geral", href: "/financeiro", icon: CurrencyCircleDollarIcon },
          { label: "Cobranças", href: "/cobrancas", icon: CreditCardIcon },
          { label: "Despesas", href: "/despesas", icon: ReceiptIcon },
        ],
      },
      { label: "Automações", href: "/automacoes", icon: FlowArrowIcon },
      { label: "Inteligência artificial", href: "/ia", icon: SparkleIcon },
    ],
  },
  {
    title: "Presença e equipe",
    icon: UserIcon,
    hue: "var(--sys-pink)",
    entries: [
      {
        label: "Perfil profissional",
        icon: UserIcon,
        hue: "var(--sys-pink)",
        items: [
          { label: "Portfólio", href: "/portfolio", icon: GlobeIcon },
          { label: "Currículo", href: "/curriculo", icon: IdentificationCardIcon },
        ],
      },
      { label: "Equipe", href: "/configuracoes/equipe", icon: UsersThreeIcon },
      { label: "Conquistas", href: "/conquistas", icon: TrophyIcon },
    ],
  },
  {
    title: "Configurações",
    icon: GearSixIcon,
    hue: "var(--sys-gray)",
    entries: [
      {
        label: "Configurações",
        icon: GearSixIcon,
        hue: "var(--sys-gray)",
        items: [
          { label: "Conta", href: "/configuracoes", icon: UserCircleIcon },
          { label: "Domínio", href: "/configuracoes/dominio", icon: GlobeIcon },
          { label: "Integrações", href: "/configuracoes/integracoes", icon: PlugsConnectedIcon },
          { label: "Notificações", href: "/configuracoes/notificacoes", icon: BellIcon },
          { label: "Plano e assinatura", href: "/configuracoes/plano", icon: CreditCardIcon },
          { label: "Segurança", href: "/configuracoes/seguranca", icon: ShieldCheckIcon },
        ],
      },
    ],
  },
];

// Pasta some no achatado: quem procura digita o nome da página, e não o da gaveta onde ela mora. O
// nome da gaveta vira contexto na segunda linha, senão "Acompanhar" e "Visão geral" não dizem nada
// fora do menu.
export function navLinks(): NavResult[] {
  return navGroups.flatMap((group) =>
    group.entries.flatMap((entry) =>
      isFolder(entry)
        ? entry.items.map((item) => ({ ...item, section: entry.label, hue: entry.hue }))
        : [{ ...entry, section: group.title, hue: group.hue }],
    ),
  );
}

/** Atalhos em pílula na busca: o punhado de páginas que se abre todo dia, com rótulo próprio,
 *  porque dentro da pasta elas se chamam "Acompanhar" ou "Visão geral". Cada uma tem matiz fixo,
 *  para a pessoa achar pela cor antes de ler. */
export const navHighlights: NavHighlight[] = [
  { label: "Tarefas", href: "/tarefas", icon: ListChecksIcon, hue: "var(--sys-cyan)" },
  { label: "Projetos", href: "/projetos", icon: BriefcaseIcon, hue: "var(--sys-indigo)" },
  { label: "Aprovações", href: "/aprovacoes", icon: CheckSquareOffsetIcon, hue: "var(--sys-purple)" },
  { label: "Oportunidades", href: "/crm", icon: FunnelIcon, hue: "var(--sys-cyan)" },
  { label: "Clientes e fornecedores", href: "/clientes", icon: AddressBookIcon, hue: "var(--sys-teal)" },
  { label: "Formulários", href: "/formularios", icon: ClipboardTextIcon, hue: "var(--sys-indigo)" },
  { label: "Orçamentos", href: "/orcamentos", icon: ReceiptIcon, hue: "var(--sys-orange)" },
  { label: "Contratos", href: "/contratos", icon: FileTextIcon, hue: "var(--sys-purple)" },
  { label: "Financeiro", href: "/financeiro", icon: CurrencyCircleDollarIcon, hue: "var(--sys-green)" },
];
