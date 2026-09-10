import type { Icon } from "@phosphor-icons/react";
import {
  AddressBookIcon,
  BriefcaseIcon,
  BuildingsIcon,
  CurrencyCircleDollarIcon,
  FlowArrowIcon,
  GearSixIcon,
  ReceiptIcon,
  SparkleIcon,
  SquaresFourIcon,
  TagIcon,
  TrophyIcon,
  UserIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react";
import type { Route } from "next";

export type NavLink = { label: string; href: Route; icon: Icon };

/** Entrada que abre no lugar da lista, com as páginas dela dentro e um voltar no topo. O matiz é
 *  a cor com que a busca marca as páginas que moram aqui. */
export type NavFolder = { label: string; icon: Icon; hue: string; items: NavLink[] };

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
// Tarefas, calendário e relatório da referência ficam de fora até as páginas nascerem.
export const navGroups: NavGroup[] = [
  {
    title: "Área de trabalho",
    icon: SquaresFourIcon,
    hue: "var(--sys-blue)",
    entries: [
      { label: "Espaço de trabalho", href: "/dashboard", icon: SquaresFourIcon },
      /* Clientes e Produtos e serviços são páginas soltas, e não filhas de pasta (pedido de 2026-09-08): são
         as duas bases que a pessoa abre o dia inteiro, e um degrau a mais para chegar nelas só atrasava. */
      { label: "Clientes", href: "/clientes", icon: AddressBookIcon },
      { label: "Funil de vendas", href: "/crm", icon: BuildingsIcon },
      { label: "Produtos e serviços", href: "/catalogo", icon: TagIcon },
      /* Orçar e acompanhar são a mesma tela (2026-09-09): a lista em tabela, com o editor abrindo por cima. A
         pasta com "Acompanhar" e "Gerar orçamento" saiu. */
      { label: "Orçamentos", href: "/orcamentos", icon: ReceiptIcon },
      {
        label: "Financeiro",
        icon: CurrencyCircleDollarIcon,
        hue: "var(--sys-green)",
        items: [
          { label: "Visão geral", href: "/financeiro", icon: CurrencyCircleDollarIcon },
          { label: "Cobranças", href: "/cobrancas", icon: CurrencyCircleDollarIcon },
        ],
      },
      {
        label: "Projetos",
        icon: BriefcaseIcon,
        hue: "var(--sys-indigo)",
        items: [
          { label: "Todos os projetos", href: "/projetos", icon: BriefcaseIcon },
          { label: "Contratos", href: "/contratos", icon: BriefcaseIcon },
          { label: "Novo contrato", href: "/contratos/novo", icon: BriefcaseIcon },
        ],
      },
      { label: "Automação", href: "/automacoes", icon: FlowArrowIcon },
    ],
  },
  {
    title: "Organização",
    icon: UsersThreeIcon,
    hue: "var(--sys-brown)",
    entries: [
      {
        label: "Perfil profissional",
        icon: UserIcon,
        hue: "var(--sys-pink)",
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
    icon: GearSixIcon,
    hue: "var(--sys-purple)",
    entries: [
      { label: "Inteligência artificial", href: "/ia", icon: SparkleIcon },
      { label: "Conquistas", href: "/conquistas", icon: TrophyIcon },
      {
        label: "Configurações",
        icon: GearSixIcon,
        hue: "var(--sys-gray)",
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
  { label: "Orçamentos", href: "/orcamentos", icon: ReceiptIcon, hue: "var(--sys-orange)" },
  { label: "Projetos", href: "/projetos", icon: BriefcaseIcon, hue: "var(--sys-indigo)" },
  { label: "Clientes", href: "/clientes", icon: AddressBookIcon, hue: "var(--sys-teal)" },
  { label: "Financeiro", href: "/financeiro", icon: CurrencyCircleDollarIcon, hue: "var(--sys-green)" },
  { label: "Contratos", href: "/contratos", icon: BriefcaseIcon, hue: "var(--sys-purple)" },
  { label: "Equipe", href: "/configuracoes/equipe", icon: UsersThreeIcon, hue: "var(--sys-pink)" },
];
