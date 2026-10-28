"use client";

import { CrmAppearanceDialog, type CrmAppearance } from "@/features/crm/components/crm-appearance-dialog";

import {
  CheckIcon,
  CaretDownIcon,
  CaretLeftIcon,
  CaretRightIcon,
  FilePlusIcon,
  FolderPlusIcon,
  FunnelIcon,
  KanbanIcon,
  LockSimpleIcon,
  ListIcon,
  MagnifyingGlassIcon,
  CircleHalfIcon,
  PlusIcon,
  SignOutIcon,
  XIcon,
} from "@phosphor-icons/react";
import type { Route } from "next";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
  Fragment,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Avatar, AvatarGroup } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, type DropdownSection } from "@/components/ui/dropdown-menu";
import { IconButton } from "@/components/ui/icon-button";
import { Kbd } from "@/components/ui/kbd";
import { NameDialog } from "@/components/ui/name-dialog";
import { useToast } from "@/components/providers/toast-provider";
import { saveCrmFolderAction, saveFunnelAction } from "@/features/crm/actions";
import { saveBoardAction, saveFolderAction } from "@/features/projects/actions";
import { TextLink } from "@/components/ui/link";
import { Text } from "@/components/ui/text";
import { VisuallyHidden } from "@/components/ui/visually-hidden";
import { useCommandKey } from "@/hooks/use-command-key";
import { isTopLayer, useLayer } from "@/hooks/use-layer";
import { usePresence } from "@/hooks/use-presence";
import { MOBILE_QUERY, useMediaQuery } from "@/hooks/use-media-query";
import { useOpenedOnce } from "@/hooks/use-opened-once";
import { rounded } from "@/lib/corners";
import { AccountMenu, ThemePicker, accountLinks } from "../account-menu";
import { useFloatingActions } from "../floating-actions";
import { alertKindLabels, type SidebarAlert } from "../alerts";
import { AiTrigger } from "@/features/ai/components/ai-trigger";
import { markNotificationsReadAction } from "@/features/organizations/actions";
import { Notifications, type AppNotification } from "../notifications";
import { pathToFunnel, type CrmTreeItem } from "@/features/crm/tree";
import { pathToItem, type TaskTreeItem } from "@/features/tasks/tree";
import { isCurrent, isFolder, navGroups, type NavFolder, type NavLink } from "../nav";
import { TeamSwitcher, type SwitcherTeam } from "../team-switcher";
import { NavTree, fromCrmTree, fromTaskTree } from "./nav-tree";
import styles from "./sidebar.module.css";

/* A busca entra por importação dinâmica, montada só na primeira abertura (varredura de peso de 2026-09-21):
   ela desce em toda página da aplicação por morar na moldura, e quase ninguém a abre na primeira visita. */
const CommandPalette = dynamic(() => import("../command-palette").then((module) => module.CommandPalette));

export type SidebarTeam = {
  name: string;
  logoUrl: string | null;
  plan: string;
};

export type SidebarUser = {
  name: string;
  email: string | null;
  role: string;
  avatarUrl: string | null;
};

export type SidebarProps = {
  team: SidebarTeam;
  user: SidebarUser;
  /** Times em que a pessoa entra, para a troca no topo. O atual vem separado porque pode não existir. */
  teams: SwitcherTeam[];
  currentTeamId: string | null;
  notifications: AppNotification[];
  /** O aviso mais urgente, escolhido no servidor: reunião, entrega, cobrança ou tarefa. Sem aviso, sem cartão. */
  alert?: SidebarAlert;
  /** A arquitetura das tarefas, com as contagens resolvidas: é o que a pasta Tarefas abre no lugar da lista. */
  tasks: TaskTreeItem[];
  /** A arquitetura do funil de vendas, na mesma forma: é o que a pasta Funil de vendas abre. */
  funnels: CrmTreeItem[];
  /**
   * O projeto em vigor na árvore. Normalmente sai do endereço (`/tarefas/<slug>`) e não precisa ser passado;
   * é a prévia de front que informa, porque ela mora em outro endereço e o menu não teria como saber. Mesma
   * razão do `demo` da tela do painel.
   */
  taskRoute?: string;
  /** O funil em vigor, pela mesma razão do `taskRoute`. */
  funnelRoute?: string;
};

/* Quantas bolinhas o aviso mostra antes de resumir o resto em "+N". */
const ALERT_FACES = 3;

// Quem rola muda com a moldura: no desktop é o próprio nav, na tela cheia é a tela, acima dele na
// árvore. Subir a partir do nav até o primeiro ancestral que rola serve às duas sem cada uma saber
// da outra.
function scrollRegion(node: HTMLElement | null) {
  let current: HTMLElement | null = node;
  while (current) {
    const { overflowY } = getComputedStyle(current);
    if (overflowY === "auto" || overflowY === "scroll") return current;
    current = current.parentElement;
  }
  return null;
}

function folderIsCurrent(pathname: string, folder: NavFolder) {
  return folder.items.some((item) => isCurrent(pathname, item.href));
}

const folders = navGroups.flatMap((group) => group.entries.filter(isFolder));

/** O tempo do deslize da pasta, o mesmo `--duration-slow` do CSS: é quando a altura dela já é a final. */
const FOLDER_SLIDE_MS = 320;

/** Como o galho se pinta: no caminho até a página ativa, a própria página ativa, ou neutro. */
type BranchTone = "path" | "active" | undefined;

/**
 * O galho que liga a página de dentro à pasta, no padrão do app-le-ange (2026-10-25, a pedido): o tronco desce
 * do ícone da pasta e, na altura da linha, dobra em ângulo reto até encostar nela. No último galho o tronco para
 * na dobra. As linhas são bordas, com a espessura e a cor das divisórias do menu, e a página ativa muda só a cor
 * do caminho até ela. Como a cor da borda é translúcida, nenhum pedaço passa por cima de outro.
 */
function Branch({ last = false, tone, children }: { last?: boolean; tone?: BranchTone; children: ReactNode }) {
  const descends = last || tone === "active";
  return (
    <div className={styles.branch}>
      {!last && <span className={styles.trunk} data-tone={tone === "path" ? "path" : undefined} data-below={tone === "active" || undefined} aria-hidden="true" />}
      <span className={styles.elbow} data-tone={tone === "active" ? "active" : undefined} data-descends={descends || undefined} aria-hidden="true" />
      {children}
    </div>
  );
}

/* O que nasce na raiz da árvore, pelo "+" do cabeçalho da pasta (2026-09-17, tudo funcionando): projeto novo
   vai para a página dele, que tem a ficha inteira; funil e pasta pedem só um nome, na janela de nome da casa.
   O nome do primeiro item segue a árvore da pasta, senão a pasta do funil ofereceria "Novo projeto". */
type Creating = "folder" | "funnel" | "board";

const createSections = (tree: "tarefas" | "funis", onCreate: (kind: Creating) => void): DropdownSection[] => [
  {
    id: "create",
    items: [
      tree === "funis"
        ? { id: "funnel", label: "Novo funil", icon: FunnelIcon, onSelect: () => onCreate("funnel") }
        : { id: "board", label: "Nova página", icon: FilePlusIcon, onSelect: () => onCreate("board") },
      ...(tree === "tarefas" ? [{ id: "project", label: "Novo projeto", icon: KanbanIcon, href: "/projetos/novo" as Route }] : []),
      { id: "folder", label: "Nova pasta", icon: FolderPlusIcon, onSelect: () => onCreate("folder") },
    ],
  },
];

function Row({ item, active, onNavigate }: { item: NavLink; active: boolean; onNavigate?: () => void }) {
  if (item.locked) {
    return (
      <button type="button" className={styles.row} data-locked="" aria-disabled="true" {...rounded("md")}>
        <item.icon aria-hidden="true" />
        <span className={styles.label}>{item.label}</span>
        <LockSimpleIcon aria-label="Bloqueado" className={styles.chevron} />
      </button>
    );
  }
  return (
    <Link
      href={item.href}
      className={styles.row}
      data-active={active || undefined}
      onClick={onNavigate}
      {...rounded("md")}
    >
      <item.icon aria-hidden="true" />
      <span className={styles.label}>{item.label}</span>
    </Link>
  );
}

type PanelProps = SidebarProps & {
  variant: "desktop" | "mobile";
  onSearch?: () => void;
  onNotificationsChange?: (items: AppNotification[]) => void;
  /** Chamado ao escolher uma página: na tela cheia do celular, fecha o menu. */
  onNavigate?: () => void;
};

// Pasta abre para baixo, no próprio lugar, como no app-le-ange (2026-10-25, a pedido): as páginas de dentro
// entram logo abaixo dela, recuadas e ligadas pelo fio, e o resto do menu continua à vista. Antes a pasta
// trocava a lista inteira por uma camada com voltar.
export function SidebarPanel({
  team,
  user,
  teams,
  currentTeamId,
  notifications,
  alert,
  tasks,
  funnels,
  taskRoute,
  funnelRoute,
  variant,
  onSearch,
  onNotificationsChange,
  onNavigate,
}: PanelProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { toast } = useToast();
  const commandKey = useCommandKey();
  const navRef = useRef<HTMLElement>(null);
  /* Uma pasta aberta por vez: abrir uma fecha a outra. Nasce aberta a da página em vigor, e navegar para
     dentro de outra pasta passa a abrir aquela. */
  const [expanded, setExpanded] = useState<string | null>(() => folders.find((entry) => folderIsCurrent(pathname, entry))?.label ?? null);
  const [seenPath, setSeenPath] = useState(pathname);
  if (seenPath !== pathname) {
    setSeenPath(pathname);
    const current = folders.find((entry) => folderIsCurrent(pathname, entry));
    if (current && expanded !== current.label) setExpanded(current.label);
  }
  const folder = folders.find((entry) => entry.label === expanded) ?? null;
  /* O que está sendo criado na raiz pelo "+" da pasta: uma pasta ou um funil, cada um com a sua janela. */
  const [creating, setCreating] = useState<Creating | null>(null);

  /* Cada escrita derruba o cache do domínio, que leva a concha junto; refazer a rota traz a árvore nova. */
  const createFolder = async (name: string) => {
    const result = folder?.tree === "funis" ? await saveCrmFolderAction({ name, parentId: null }) : await saveFolderAction({ name, parentId: null });
    if (!result.ok) return result.error;
    toast({ title: "Pasta criada", description: `${name} já está na árvore.`, tone: "success" });
    return undefined;
  };

  /* A página nasce só com o nome e abre na hora: o projeto é atrelado depois, pelo chevron da linha. */
  const createBoard = async (name: string) => {
    const result = await saveBoardAction({ name, folderId: null });
    if (!result.ok) return result.error;
    toast({ title: "Página criada", description: `${name} já está na árvore.`, tone: "success" });
    router.push(`/tarefas/${result.slug}` as Route);
    onNavigate?.();
    return undefined;
  };

  const createFunnel = async (value: CrmAppearance) => {
    const result = await saveFunnelAction({ ...value, folderId: null });
    if (!result.ok) return result.error;
    toast({ title: "Funil criado", description: "Ele nasceu com as etapas padrão. Arrume pelo chevron da linha.", tone: "success" });
    router.push(`/crm/${result.slug}` as Route);
    return undefined;
  };
  // O projeto aberto sai do endereço (`/tarefas/<slug>`): é ele que marca a linha da árvore, e o caminho de
  // pastas até ele é o galho que a árvore abre ao aparecer.
  const currentProject = taskRoute ?? (pathname.startsWith("/tarefas/") ? pathname.split("/")[2] : undefined);
  const openBranch = currentProject ? pathToItem(tasks, currentProject) : [];
  // O funil aberto sai do endereço (`/crm/<slug>`), na mesma conta do projeto.
  const currentFunnel = funnelRoute ?? (pathname.startsWith("/crm/") ? pathname.split("/")[2] : undefined);
  const funnelBranch = currentFunnel ? pathToFunnel(funnels, currentFunnel) : [];

  const toggleFolder = (entry: NavFolder) => setExpanded((current) => (current === entry.label ? null : entry.label));

  /* A pasta que abre rola para aparecer inteira: cabendo, ela toda fica à vista; maior que o menu, o nome dela
     vai para o alto. Espera a abertura assentar, que agora desliza: medir no começo pegaria a altura zero. */
  useEffect(() => {
    if (!expanded) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const settle = window.setTimeout(() => {
      const region = scrollRegion(navRef.current);
      const opened = navRef.current?.querySelector<HTMLElement>(`[data-folder="${CSS.escape(expanded)}"]`);
      if (!region || !opened) return;
      const box = region.getBoundingClientRect();
      const item = opened.getBoundingClientRect();
      const gap = 8;
      const delta =
        item.height > box.height - gap * 2
          ? item.top - box.top - gap
          : item.bottom > box.bottom
            ? item.bottom - box.bottom + gap
            : item.top < box.top
              ? item.top - box.top - gap
              : 0;
      if (Math.abs(delta) > 1) region.scrollBy({ top: delta, behavior: reduced ? "auto" : "smooth" });
    }, reduced ? 0 : FOLDER_SLIDE_MS);
    return () => window.clearTimeout(settle);
  }, [expanded]);
  const [alertVisible, setAlertVisible] = useState(true);
  const mobile = variant === "mobile";

  // O aviso muda de lugar por moldura: no desktop entra acima do perfil, no celular segue por último,
  // depois das ações da conta. Posição por árvore, para a leitura seguir a tela. Quem está envolvido vira
  // bolinhas com o resto em "+N", e no lugar delas, quando não há ninguém, a etiqueta do tipo; o título e a
  // linha de apoio dizem o que e quando, e o atalho leva a quem resolve. O X dispensa até a próxima carga.
  const faces = alert?.people.slice(0, ALERT_FACES) ?? [];
  const extraFaces = alert ? alert.people.length - faces.length : 0;
  const external = alert?.action.href.startsWith("http");
  const planCard = alert && alertVisible && (
    <section className={styles.promo} {...rounded("lg")} aria-label={`${alertKindLabels[alert.kind]}: ${alert.title}`}>
      {/* Um dos dois, nunca os dois (2026-09-20, a pedido): quem está envolvido, quando há alguém, e a
          etiqueta do tipo quando não há. Os rostos dizem de quem é o aviso melhor que a palavra, e a
          palavra só é necessária quando não há rosto para dizê-la. Lado a lado, os dois competiam pela
          mesma linha e ainda empurravam o X. */}
      <div className={styles.promoHead}>
        {faces.length > 0 ? (
          <span className={styles.promoPeople} data-single={faces.length === 1 && extraFaces === 0 ? "" : undefined}>
            <AvatarGroup>
              {faces.map((person) => (
                <Avatar key={person.name} name={person.name} src={person.avatarUrl ?? undefined} size="xs" />
              ))}
            </AvatarGroup>
            {extraFaces > 0 && (
              <Text as="span" variant="caption1" tone="secondary">
                +{extraFaces}
              </Text>
            )}
          </span>
        ) : (
          <Badge tone={alert.kind === "invoice" ? "green" : alert.kind === "delivery" ? "indigo" : "blue"} variant="soft" size="sm">
            {alertKindLabels[alert.kind]}
          </Badge>
        )}
        <IconButton label="Dispensar aviso" variant="ghost" size="sm" className={styles.promoClose} onClick={() => setAlertVisible(false)}>
          <XIcon />
        </IconButton>
      </div>

      <div className={styles.promoPlan}>
        <Text variant={mobile ? "callout" : "subheadline"} weight="semibold" className={styles.promoTitle}>
          {alert.title}
        </Text>
        <div className={styles.promoFacts}>
          <Text variant={mobile ? "footnote" : "caption1"} tone="secondary">{alert.detail}</Text>
          {alert.context && <Text variant={mobile ? "footnote" : "caption1"} tone="secondary">{alert.context}</Text>}
          {alert.value && <Text variant={mobile ? "footnote" : "caption1"} weight="semibold">{alert.value}</Text>}
        </div>
      </div>

      <div className={styles.promoFoot}>
        <TextLink
          href={alert.action.href as Route}
          tone="inherit"
          underline="always"
          className={styles.promoAction}
          {...(external && { target: "_blank", rel: "noreferrer" })}
        >
          {alert.action.label}
          <CaretRightIcon aria-hidden="true" weight="bold" />
        </TextLink>
        {Boolean(alert.remaining) && (
          <Text as="span" variant="caption1" tone="secondary" className={styles.promoRemaining}>
            +{alert.remaining} {alert.remaining === 1 ? "lembrete" : "lembretes"}
          </Text>
        )}
      </div>
    </section>
  );
  return (
    <div className={styles.panel}>
      <header className={styles.top}>
        <Avatar
          name={team.name}
          src={team.logoUrl ?? undefined}
          size={mobile ? "sm" : "xs"}
          shape="rounded"
        />
        <Text
          variant={mobile ? "callout" : "subheadline"}
          weight="medium"
          truncate
          className={styles.teamName}
        >
          {team.name}
        </Text>
        <Badge
          tone="neutral"
          variant="soft"
          size={mobile ? "md" : "sm"}
          className={styles.teamPlan}
        >
          {team.plan}
        </Badge>
        <TeamSwitcher
          teams={teams}
          currentId={currentTeamId}
          owner={{
            name: user.name,
            email: user.email,
            avatarUrl: user.avatarUrl,
          }}
          size={mobile ? "md" : "sm"}
        />
      </header>

      <button
        type="button"
        className={styles.find}
        onClick={onSearch}
        {...rounded("md")}
      >
        <MagnifyingGlassIcon aria-hidden="true" />
        <span className={styles.findLabel}>Buscar</span>
        <span className={styles.findKeys}>
          <Kbd>{commandKey.length > 1 ? `${commandKey} F` : `${commandKey}F`}</Kbd>
        </span>
      </button>

      <nav ref={navRef} className={styles.nav} aria-label="Navegação principal">
        {navGroups.map((group, index) => (
          // O título do grupo saiu da tela e virou nome do grupo para leitor de tela: quem separa
          // um do outro agora é a linha, que sangra até a borda do menu.
          <Fragment key={group.title}>
            {index > 0 && <span className={styles.divider} />}
            <div className={styles.group} role="group" aria-label={group.title}>
              {group.entries.map((entry) => {
                if (!isFolder(entry)) {
                  return <Row key={entry.href} item={entry} active={isCurrent(pathname, entry.href)} onNavigate={onNavigate} />;
                }
                const open = !entry.locked && expanded === entry.label;
                /* Qual galho leva à página ativa: uma das páginas fixas ou, na pasta que abre árvore, a própria
                   árvore quando o projeto ou o funil aberto está nela. */
                const pages = entry.tree ? [] : entry.items;
                const treeActive = (entry.tree === "funis" && Boolean(currentFunnel)) || (entry.tree === "tarefas" && Boolean(currentProject));
                const activeIndex = entry.tree ? (treeActive ? 0 : -1) : pages.findIndex((item) => isCurrent(pathname, item.href));
                const subId = `menu-${entry.label.toLowerCase().replace(/\s+/g, "-")}`;
                return (
                  <div key={entry.label} className={styles.folder} data-folder={entry.label}>
                    <div className={styles.folderHead}>
                      {entry.locked ? (
                        <button type="button" className={styles.row} data-locked="" aria-disabled="true" {...rounded("md")}>
                          <entry.icon aria-hidden="true" />
                          <span className={styles.label}>{entry.label}</span>
                          <LockSimpleIcon aria-label="Bloqueado" className={styles.chevron} />
                        </button>
                      ) : (
                      <button
                        type="button"
                        className={styles.row}
                        data-active={(folderIsCurrent(pathname, entry) && !open) || undefined}
                        data-parent={folderIsCurrent(pathname, entry) || undefined}
                        aria-expanded={open}
                        aria-controls={subId}
                        onClick={() => toggleFolder(entry)}
                        {...rounded("md")}
                      >
                        <entry.icon aria-hidden="true" />
                        <span className={styles.label}>{entry.label}</span>
                        <CaretDownIcon aria-hidden="true" className={styles.chevron} data-open={open || undefined} />
                      </button>
                      )}
                      {open && entry.tree && (
                        <DropdownMenu
                          label={`Criar em ${entry.label}`}
                          triggerLabel={entry.tree === "funis" ? "Criar pasta ou funil" : "Criar página, projeto ou pasta"}
                          sections={createSections(entry.tree, setCreating)}
                          icon={<PlusIcon />}
                          size="sm"
                        />
                      )}
                    </div>
                    {/* Sempre montada, para abrir e fechar deslizando nos dois sentidos (2026-10-26, a pedido: montar
                        só ao abrir fazia a pasta fechar de um corte). Fechada, sai do foco e do leitor de tela. */}
                    <div id={subId} className={styles.sub} data-open={open || undefined} inert={!open}>
                      {/* O começo do tronco, saindo do ícone da pasta; escuro quando alguma página dela está ativa. */}
                      <span className={styles.stem} data-tone={activeIndex >= 0 ? "path" : undefined} aria-hidden="true" />
                      <div className={styles.subInner}>
                        {pages.map((item, itemIndex) => (
                          <Branch
                            key={item.href}
                            last={itemIndex === pages.length - 1}
                            tone={itemIndex === activeIndex ? "active" : itemIndex < activeIndex ? "path" : undefined}
                          >
                            <Row item={item} active={isCurrent(pathname, item.href)} onNavigate={onNavigate} />
                          </Branch>
                        ))}
                        {entry.tree === "tarefas" && (
                          <div className={styles.treeBranch}>
                            <NavTree items={fromTaskTree(tasks)} basePath="/tarefas" current={currentProject} openFolders={openBranch} label="Pastas e projetos" onNavigate={onNavigate} branched />
                          </div>
                        )}
                        {entry.tree === "funis" && (
                          <div className={styles.treeBranch}>
                            <NavTree items={fromCrmTree(funnels)} basePath="/crm" current={currentFunnel} openFolders={funnelBranch} label="Pastas e funis" onNavigate={onNavigate} branched />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Fragment>
        ))}
      </nav>

      {creating && folder?.tree === "funis" ? (
        <CrmAppearanceDialog
          title={creating === "folder" ? "Nova pasta" : "Novo funil"}
          folder={creating === "folder"}
          onClose={() => setCreating(null)}
          onSave={
            creating === "funnel"
              ? createFunnel
              : async (value) => {
                  const result = await saveCrmFolderAction({ ...value, parentId: null });
                  return result.ok ? undefined : result.error;
                }
          }
        />
      ) : (
        creating && (
          <NameDialog
            open
            onClose={() => setCreating(null)}
            title={creating === "board" ? "Nova página" : "Nova pasta"}
            description={
              creating === "board"
                ? "Só o nome: o projeto você atrela depois, se fizer sentido."
                : "Na raiz da árvore. Para criar dentro de outra, use o chevron da pasta."
            }
            placeholder={creating === "board" ? "Rotina, Ideias, Sprint de outubro" : "Clientes, Interno, 2026"}
            maxLength={creating === "board" ? 80 : undefined}
            confirmLabel={creating === "board" ? "Criar página" : undefined}
            onSubmit={creating === "board" ? createBoard : createFolder}
          />
        )
      )}

      <div className={styles.foot}>
        {!mobile && planCard}

        <div className={styles.profile}>
          <Avatar
            name={user.name}
            src={user.avatarUrl ?? undefined}
            size={mobile ? "sm" : "xs"}
          />
          <span className={styles.profileText}>
            <Text
              variant={mobile ? "callout" : "subheadline"}
              weight="medium"
              truncate
            >
              {user.name}
            </Text>
          </span>
          <span className={styles.profileActions}>
            {/* O SpeculAI mora aqui desde que o topo das páginas saiu (2026-10-27). */}
            <AiTrigger size={mobile ? "md" : "sm"} />
            <Notifications
              items={notifications}
              onChange={onNotificationsChange}
              size={mobile ? "md" : "sm"}
            />
            {!mobile && (
              <AccountMenu
                user={{
                  name: user.name,
                  email: user.email,
                  avatarUrl: user.avatarUrl,
                }}
                plan={team.plan}
              />
            )}
          </span>
        </div>

        {mobile && (
          <div className={styles.actions}>
            {accountLinks
              .filter((action) => !action.desktopOnly)
              .map((action) => (
              <Link
                key={action.href}
                href={action.href}
                onClick={onNavigate}
                className={styles.row}
                {...rounded("md")}
              >
                <action.icon aria-hidden="true" />
                <span className={styles.label}>{action.label}</span>
                {action.plan && (
                  <Badge tone="neutral" variant="soft" size="sm">
                    {team.plan}
                  </Badge>
                )}
              </Link>
            ))}

            <div className={styles.theme}>
              <span className={styles.themeLabel}>
                <CircleHalfIcon aria-hidden="true" />
                Tema
              </span>
              <ThemePicker />
            </div>

            <a href="/auth/sair" className={styles.row} {...rounded("md")}>
              <SignOutIcon aria-hidden="true" />
              <span className={styles.label}>Sair da conta</span>
            </a>
          </div>
        )}

        {mobile && planCard}
      </div>
    </div>
  );
}

/* Os três modos da barra do celular, na ordem de prioridade: as ações de uma janela aberta, a paginação
   da lista à vista e, sem nenhuma das duas, a busca e o sino de sempre. */
type BarMode = "actions" | "pager" | "browse";

const numberFormat = new Intl.NumberFormat("pt-BR");

// No celular o painel não fica: ele é chamado pela barra flutuante de baixo e toma a tela inteira.
// A troca é de árvore, e não de CSS, porque as duas formas têm conteúdo diferente no rodapé.
export function Sidebar(props: SidebarProps) {
  const mobile = useMediaQuery(MOBILE_QUERY);
  const [open, setOpen] = useState(false);
  // As ações que a janela aberta pendurou na barra do celular (salvar e sair de um formulário) e a
  // paginação que a lista pendurou: com qualquer uma delas a busca e o sino saem e entra o modo da vez, e
  // o botão do menu fica onde sempre fica. Janela manda na lista, porque um formulário aberto é o assunto.
  const { shape: actions, pager, runPrimary, runExtra, runCancel, goToPage } = useFloatingActions();
  const mode: BarMode = actions ? "actions" : pager ? "pager" : "browse";
  // O último modo de ações visto fica guardado para o fundido de saída ter o que desenhar: a barra troca
  // de modo desbotando um sobre o outro, e o que sai não pode sumir no meio do caminho.
  const [lastActions, setLastActions] = useState(actions);
  if (actions && actions !== lastActions) setLastActions(actions);
  const [lastPager, setLastPager] = useState(pager);
  if (pager && pager !== lastPager) setLastPager(pager);
  // Os modos ficam montados desde o começo, apagados e inertes, com valores de espera enquanto ninguém
  // registrou nada: montar só na hora fazia o modo aparecer já no estado final, sem o fundido de entrada,
  // e a troca lia como seca.
  const shownActions = lastActions ?? { primaryLabel: "Salvar", primaryIconOnly: false, loading: false, disabled: true, cancelLabel: "Cancelar", extras: [] };
  const shownPager = lastPager ?? { page: 1, pageCount: 1, label: "Páginas" };
  const [searching, setSearching] = useState(false);
  const [searchKey, setSearchKey] = useState(0);
  const [notifications, setNotifications] = useState(props.notifications);

  /* A lista muda na tela na hora e o servidor registra a leitura em seguida: esperar a ida faria o ponto do
     sino piscar de volta. Só as que passaram de não lida para lida vão, e nunca o contrário. */
  const changeNotifications = (next: AppNotification[]) => {
    const read = next.filter((item) => item.read && !notifications.find((current) => current.id === item.id)?.read);
    setNotifications(next);
    if (read.length > 0) void markNotificationsReadAction(read.map((item) => item.id)).catch(() => undefined);
  };
  const screen = usePresence(open);
  /* O menu só sobe acima das janelas quando foi aberto por cima de uma que já estava com ações. A janela que
     nasce de dentro do menu (etapas, cor do quadro, pasta) é a camada nova, e precisa ficar na frente dele. */
  const [overWindow, setOverWindow] = useState(false);
  if (overWindow && !actions) setOverWindow(false);
  /* A janela aberta de dentro do menu é quem manda na barra: ela sai do modo bolinha e mostra as ações da
     janela, e o X dela fecha a janela, e não o menu que ficou por baixo. */
  const overMenu = open && Boolean(actions) && !overWindow;
  const collapsed = open && !overMenu;

  const openSearch = () => {
    setSearchKey((current) => current + 1);
    setSearching(true);
  };

  const unread = notifications.filter((item) => !item.read).length;

  // A tela cheia do menu entra na fila de camadas da casa, como janela, bandeja e caixa colada no gatilho:
  // aberta por cima de um formulário, é ela quem responde ao Escape, e a janela de baixo fica quieta em vez
  // de fechar por trás dela (acerto de 2026-09-10, junto do empilhamento).
  const layer = useLayer(open);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !isTopLayer(layer)) return;
      event.preventDefault();
      setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, layer]);

  // A tecla do atalho é a mesma que o campo mostra. O `preventDefault` tira a busca do navegador, que
  // procura no texto da página e não serve a quem quer pular para outra tela.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "f" || !(event.metaKey || event.ctrlKey))
        return;
      event.preventDefault();
      setSearchKey((current) => current + 1);
      setSearching(true);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const searchReady = useOpenedOnce(searching);
  const search = searchReady ? <CommandPalette key={searchKey} open={searching} onClose={() => setSearching(false)} /> : null;
  const panel = {
    ...props,
    notifications,
    onNotificationsChange: changeNotifications,
  };

  if (!mobile) {
    return (
      <aside className={styles.sidebar}>
        <SidebarPanel {...panel} variant="desktop" onSearch={openSearch} />
        {search}
      </aside>
    );
  }

  return (
    <>
      {screen.present && (
        <div
          className={styles.screen}
          data-state={screen.state}
          // Com ações penduradas, o menu sobe junto com a barra para cima da janela aberta: sem isso ele
          // nascia atrás dela, e só a barra ficava à vista (relato de 2026-09-10).
          data-actions={actions && overWindow ? "" : undefined}
          onAnimationEnd={screen.onAnimationEnd}
        >
          <SidebarPanel {...panel} variant="mobile" onSearch={openSearch} onNavigate={() => setOpen(false)} />
        </div>
      )}

      {/* Menu aberto encolhe a barra até sobrar só o X: o grupo de busca e sino recolhe pela trilha da
          grade, que anima de 1fr a 0fr, e a barra vira bolinha. A chave no botão remonta o glifo a cada
          troca, e a entrada dele gira, porque X e três linhas não se transformam um no outro. */}
      <div
        className={styles.bar}
        data-collapsed={collapsed || undefined}
        data-actions={actions ? "" : undefined}
        data-over-menu={overMenu || undefined}
      >
        <div className={styles.barGroup} inert={collapsed || undefined}>
          <div className={styles.barGroupInner}>
            <span className={styles.barMode} data-active={mode === "browse" ? "" : undefined} inert={mode === "browse" ? undefined : true}>
              <button type="button" className={styles.search} onClick={openSearch}>
                <MagnifyingGlassIcon aria-hidden="true" />
                <span className={styles.searchLabel}>Buscar</span>
              </button>
              <span className={styles.barDivider} aria-hidden="true" />
              {/* Escondido, e não desmontado, quando não há o que ler: desmontar levava junto a bandeja
                  aberta no instante em que a última notificação era lida. */}
              <span className={styles.barBell} hidden={unread === 0}>
                <Notifications
                  items={notifications}
                  onChange={changeNotifications}
                  size="md"
                  radius="md"
                />
                <span className={styles.barDivider} aria-hidden="true" />
              </span>
            </span>
            {/* Lista com mais de uma página: anterior, a página em vigor e próxima entram no lugar da busca
                e do sino, na mesma caixa, para o celular não ganhar uma segunda barra flutuante. O número
                é só leitura, como na barra de paginação do desktop, e a leitura completa fica na voz. */}
            <span className={styles.barMode} data-active={mode === "pager" ? "" : undefined} inert={mode === "pager" ? undefined : true}>
              <IconButton label="Página anterior" variant="ghost" size="md" radius="md" disabled={shownPager.page <= 1} onClick={() => goToPage(shownPager.page - 1)}>
                <CaretLeftIcon />
              </IconButton>
              <span className={styles.barDivider} aria-hidden="true" />
              <p className={styles.barPage} aria-live="polite" aria-label={shownPager.label}>
                <span aria-hidden="true">
                  {numberFormat.format(shownPager.page)}/{numberFormat.format(shownPager.pageCount)}
                </span>
                <VisuallyHidden>{`${shownPager.label}: página ${shownPager.page} de ${shownPager.pageCount}`}</VisuallyHidden>
              </p>
              <span className={styles.barDivider} aria-hidden="true" />
              <IconButton
                label="Próxima página"
                variant="ghost"
                size="md"
                radius="md"
                disabled={shownPager.page >= shownPager.pageCount}
                onClick={() => goToPage(shownPager.page + 1)}
              >
                <CaretRightIcon />
              </IconButton>
              <span className={styles.barDivider} aria-hidden="true" />
            </span>
            {/* Janela com ações próprias: salvar e sair entram no lugar da busca e do sino, para a barra
                continuar uma só e o botão do menu ficar onde sempre fica. */}
            <span className={styles.barMode} data-active={mode === "actions" ? "" : undefined} inert={mode === "actions" ? undefined : true}>
              {/* A principal com nome abre a fila, que é o caso de salvar. Em glifo (`iconOnly`) ela troca de
                  lugar com as secundárias e vai para o fim, encostada no sair: é o desenho do compositor da
                  conversa, em que enviar é o último da fila (2026-09-11, a pedido). */}
              {/* Sem principal a barra fica só com as secundárias e o sair: é o caso da janela em que
                  escolher já confirma, como o vincular registro, em que um botão "Fechar" ao lado do X seria
                  a mesma ação duas vezes. */}
              {shownActions.primaryLabel && !shownActions.primaryIconOnly && (
                <Button size="md" radius="md" iconStart={shownActions.primaryIcon ?? <CheckIcon />} loading={shownActions.loading} disabled={shownActions.disabled} onClick={runPrimary} className={styles.barPrimary}>
                  {shownActions.primaryLabel}
                </Button>
              )}
              {/* As secundárias da janela, em glifo, entre salvar e sair: é onde enviar e copiar o link do
                  orçamento moram no celular, depois de saírem do cabeçalho (2026-09-10, a pedido). */}
              {shownActions.extras.map((extra, index) => (
                <Fragment key={extra.label}>
                  {(index > 0 || (shownActions.primaryLabel && !shownActions.primaryIconOnly)) && <span className={styles.barDivider} aria-hidden="true" />}
                  <IconButton label={extra.label} variant="ghost" size="md" radius="md" loading={extra.loading} disabled={extra.disabled} onClick={() => runExtra(index)}>
                    {extra.icon}
                  </IconButton>
                </Fragment>
              ))}
              {shownActions.primaryLabel && shownActions.primaryIconOnly && (
                <>
                  <span className={styles.barDivider} aria-hidden="true" />
                  <IconButton label={shownActions.primaryLabel} size="md" radius="md" loading={shownActions.loading} disabled={shownActions.disabled} onClick={runPrimary}>
                    {shownActions.primaryIcon ?? <CheckIcon />}
                  </IconButton>
                </>
              )}
              {/* O fio antes do sair só existe quando há algo para separar dele: numa janela de escolha, que
                  não tem principal nem secundárias, ele ficava solto ao lado do X. */}
              {(shownActions.primaryLabel || shownActions.extras.length > 0) && <span className={styles.barDivider} aria-hidden="true" />}
              <IconButton label={shownActions.cancelLabel} variant="ghost" size="md" radius="md" onClick={runCancel}>
                <XIcon />
              </IconButton>
              <span className={styles.barDivider} aria-hidden="true" />
            </span>
          </div>
        </div>
        <IconButton
          key={open ? "fechar" : "abrir"}
          className={styles.barToggle}
          label={open ? "Fechar o menu" : "Abrir o menu"}
          // Na bolinha o X ganha preenchimento: sozinho sobre o vidro, o traço fino sumia. Fechado, volta a
          // ser fantasma como os vizinhos da barra.
          variant={open ? "secondary" : "ghost"}
          size="md"
          // Bolinha por fora pede círculo por dentro: com a barra fechada em pílula, o canto de 12px do
          // botão aparecia no hover como um quadrado dentro da bola.
          radius={open ? "full" : "md"}
          onClick={() => {
            if (!open) setOverWindow(Boolean(actions));
            setOpen(!open);
          }}
        >
          {open ? <XIcon /> : <ListIcon />}
        </IconButton>
      </div>

      {search}
    </>
  );
}
