import type { Icon } from "@phosphor-icons/react";
import {
  AddressBookIcon,
  ArrowCircleDownIcon,
  ArrowCircleUpIcon,
  ArrowsDownUpIcon,
  ArrowsLeftRightIcon,
  BankIcon,
  BriefcaseIcon,
  ChartBarIcon,
  ChartLineUpIcon,
  ClipboardTextIcon,
  CodeIcon,
  ChatCircleTextIcon,
  CheckSquareOffsetIcon,
  ChatsCircleIcon,
  CreditCardIcon,
  CurrencyCircleDollarIcon,
  EnvelopeSimpleIcon,
  FileTextIcon,
  FlowArrowIcon,
  FunnelIcon,
  GaugeIcon,
  GearSixIcon,
  GlobeIcon,
  HeadsetIcon,
  IdentificationCardIcon,
  ListChecksIcon,
  MegaphoneIcon,
  PaperPlaneTiltIcon,
  ReceiptIcon,
  ShieldCheckIcon,
  SparkleIcon,
  SquaresFourIcon,
  StorefrontIcon,
  TrayIcon,
  TrophyIcon,
  TruckIcon,
  UserCircleIcon,
  UserIcon,
  UsersThreeIcon,
  WebhooksLogoIcon,
  WhatsappLogoIcon,
} from "@phosphor-icons/react";
import type { Route } from "next";
import { tasksRoleAllows } from "@/features/organizations/tasks-role";

/** `locked`: página à vista no menu, com cadeado, mas que ainda não abre nem aparece na busca. */
export type NavLink = { label: string; href: Route; icon: Icon; locked?: boolean };

/** Entrada que abre para baixo, no próprio lugar, com as páginas dela penduradas no fio. O matiz é
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
  /** Pasta à vista no menu, com cadeado, mas que ainda não abre: as páginas dela ficam fora da busca. */
  locked?: boolean;
};

export type NavEntry = NavLink | NavFolder;

export type NavGroup = { title: string; icon: Icon; hue: string; entries: NavEntry[] };

export function isFolder(entry: NavEntry): entry is NavFolder {
  return "items" in entry;
}

const under = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);

/**
 * A página em vigor é a própria rota ou qualquer coisa abaixo dela: `/clientes/abc` é `/clientes`. Menos quando
 * outra página do menu é mais específica (2026-10-27, com as contas bancárias): `/financeiro/contas` é a página
 * das contas, e a visão geral em `/financeiro` não pode acender junto.
 */
export function isCurrent(pathname: string, href: string) {
  if (!under(pathname, href)) return false;
  if (pathname === href) return true;
  return !navHrefs().some((other) => other.length > href.length && other.startsWith(`${href}/`) && under(pathname, other));
}

const navHrefs = () => navGroups.flatMap((group) => group.entries.flatMap((entry) => (isFolder(entry) ? entry.items.map((item) => item.href as string) : [entry.href as string])));

/** Um degrau da rota que o topo mostra: o nome e o glifo com que o menu o desenha. */
export type NavCrumb = { label: string; icon: Icon };

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
    const crumb: NavCrumb = { label: group.title, icon: group.icon };

    for (const entry of group.entries) {
      if (isFolder(entry)) {
        for (const item of entry.items) {
          if (isCurrent(pathname, item.href)) {
            found.push({ group: crumb, folder: { label: entry.label, icon: entry.icon }, page: item });
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
      /* O WhatsApp solto, logo abaixo do Painel (2026-10-26, a pedido): é onde se trabalha o dia inteiro, e
         dentro da pasta de clientes ficava a dois cliques. */
      { label: "WhatsApp", href: "/whatsapp", icon: WhatsappLogoIcon, locked: true },
      {
        label: "Tarefas",
        icon: ListChecksIcon,
        hue: "var(--sys-cyan)",
        tree: "tarefas",
        items: [{ label: "Todas as tarefas", href: "/tarefas", icon: ListChecksIcon }],
      },
      {
        label: "Projetos",
        locked: true,
        icon: BriefcaseIcon,
        hue: "var(--sys-indigo)",
        items: [
          { label: "Todos os projetos", href: "/projetos", icon: BriefcaseIcon },
          { label: "Aprovações", href: "/aprovacoes", icon: CheckSquareOffsetIcon },
        ],
      },
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
      {
        label: "Comercial",
        icon: ReceiptIcon,
        hue: "var(--sys-orange)",
        items: [
          { label: "Orçamentos", href: "/orcamentos", icon: ReceiptIcon },
          { label: "Contratos", href: "/contratos", icon: FileTextIcon },
          { label: "Produtos e serviços", href: "/catalogo", icon: StorefrontIcon },
        ],
      },
    ],
  },
  {
    title: "Relacionamento",
    icon: AddressBookIcon,
    hue: "var(--sys-teal)",
    entries: [
      {
        label: "Clientes",
        icon: AddressBookIcon,
        hue: "var(--sys-teal)",
        items: [
          { label: "Clientes", href: "/clientes", icon: AddressBookIcon },
          { label: "Fornecedores", href: "/fornecedores", icon: TruckIcon },
          { label: "Formulários", href: "/formularios", icon: ClipboardTextIcon, locked: true },
        ],
      },
      {
        label: "Marketing",
        locked: true,
        icon: MegaphoneIcon,
        hue: "var(--sys-purple)",
        items: [
          { label: "E-mail marketing", href: "/marketing/email", icon: EnvelopeSimpleIcon },
          { label: "Fluxos", href: "/marketing/fluxos", icon: ChatsCircleIcon },
        ],
      },
      {
        label: "Satisfação",
        locked: true,
        icon: GaugeIcon,
        hue: "var(--sys-yellow)",
        items: [
          { label: "Resultados do NPS", href: "/nps/resultados", icon: ChartBarIcon },
          { label: "Pesquisas", href: "/nps/pesquisas", icon: ClipboardTextIcon },
          { label: "Disparos", href: "/nps/disparos", icon: PaperPlaneTiltIcon },
          { label: "Respostas", href: "/nps/respostas", icon: TrayIcon },
          { label: "Tratativas", href: "/nps/tratativas", icon: HeadsetIcon },
          { label: "Feedbacks", href: "/feedbacks", icon: ChatCircleTextIcon },
        ],
      },
    ],
  },
  {
    title: "Gestão",
    icon: CurrencyCircleDollarIcon,
    hue: "var(--sys-green)",
    entries: [
      /* Liberado em 2026-10-27, a pedido: "libere o financeiro, vamos começar a trabalhar nele". */
      {
        label: "Financeiro",
        icon: CurrencyCircleDollarIcon,
        hue: "var(--sys-green)",
        items: [
          { label: "Fluxo de caixa", href: "/financeiro", icon: ChartLineUpIcon },
          { label: "Contas a receber", href: "/financeiro/a-receber", icon: ArrowCircleDownIcon },
          { label: "Contas a pagar", href: "/financeiro/a-pagar", icon: ArrowCircleUpIcon },
          { label: "Movimentações", href: "/financeiro/movimentacoes", icon: ArrowsDownUpIcon },
          { label: "Cobranças", href: "/cobrancas", icon: CreditCardIcon },
          { label: "Despesas", href: "/despesas", icon: ReceiptIcon },
          { label: "Contas bancárias", href: "/financeiro/contas", icon: BankIcon },
          { label: "Transferências", href: "/financeiro/transferencias", icon: ArrowsLeftRightIcon },
        ],
      },
      {
        label: "Automação e IA",
        locked: true,
        icon: FlowArrowIcon,
        hue: "var(--sys-indigo)",
        items: [
          { label: "Automações", href: "/automacoes", icon: FlowArrowIcon },
          { label: "Inteligência artificial", href: "/ia", icon: SparkleIcon },
        ],
      },
    ],
  },
  {
    title: "Presença e equipe",
    icon: UserIcon,
    hue: "var(--sys-pink)",
    entries: [
      {
        label: "Perfil profissional",
        locked: true,
        icon: UserIcon,
        hue: "var(--sys-pink)",
        items: [
          { label: "Portfólio", href: "/portfolio", icon: GlobeIcon },
          { label: "Currículo", href: "/curriculo", icon: IdentificationCardIcon },
        ],
      },
      {
        label: "Equipe",
        icon: UsersThreeIcon,
        hue: "var(--sys-mint)",
        locked: true,
        items: [
          { label: "Membros", href: "/configuracoes/equipe", icon: UsersThreeIcon },
          { label: "Conquistas", href: "/conquistas", icon: TrophyIcon },
        ],
      },
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
          { label: "Webhooks", href: "/configuracoes/integracoes/webhooks", icon: WebhooksLogoIcon },
          { label: "API", href: "/configuracoes/integracoes/api", icon: CodeIcon },
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
        ? entry.locked
          ? []
          : entry.items.filter((item) => !item.locked).map((item) => ({ ...item, section: entry.label, hue: entry.hue }))
        : entry.locked
          ? []
          : [{ ...entry, section: group.title, hue: group.hue }],
    ),
  );
}

/** Atalhos em pílula na busca: o punhado de páginas que se abre todo dia, com rótulo próprio,
 *  porque dentro da pasta elas se chamam "Acompanhar" ou "Visão geral". Cada uma tem matiz fixo,
 *  para a pessoa achar pela cor antes de ler. */
export const navHighlights: NavHighlight[] = [
  { label: "Tarefas", href: "/tarefas", icon: ListChecksIcon, hue: "var(--sys-cyan)" },
  { label: "Oportunidades", href: "/crm", icon: FunnelIcon, hue: "var(--sys-cyan)" },
  { label: "Clientes", href: "/clientes", icon: AddressBookIcon, hue: "var(--sys-teal)" },
  { label: "Orçamentos", href: "/orcamentos", icon: ReceiptIcon, hue: "var(--sys-orange)" },
  { label: "Contratos", href: "/contratos", icon: FileTextIcon, hue: "var(--sys-purple)" },
];

/**
 * O menu do cargo só de tarefas (2026-10-28): a pasta Tarefas, com a árvore do que foi liberado, e as
 * configurações da própria conta. O resto do produto nem aparece, porque o servidor devolveria a pessoa às tarefas.
 */
export function tasksRoleNav(): NavGroup[] {
  return navGroups
    .map((group) => ({
      ...group,
      entries: group.entries.flatMap((entry): NavEntry[] => {
        if (!isFolder(entry)) return tasksRoleAllows(entry.href) ? [entry] : [];
        if (entry.tree === "tarefas") return [entry];
        const items = entry.items.filter((item) => tasksRoleAllows(item.href));
        return items.length > 0 && !entry.tree ? [{ ...entry, items }] : [];
      }),
    }))
    .filter((group) => group.entries.length > 0);
}
