"use client";

import {
  CheckIcon,
  CaretLeftIcon,
  CaretRightIcon,
  ListIcon,
  MagnifyingGlassIcon,
  CircleHalfIcon,
  SignOutIcon,
  XIcon,
} from "@phosphor-icons/react";
import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Fragment,
  useEffect,
  useRef,
  useState,
} from "react";
import { Avatar, AvatarGroup } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Kbd } from "@/components/ui/kbd";
import { TextLink } from "@/components/ui/link";
import { Text } from "@/components/ui/text";
import { useCommandKey } from "@/hooks/use-command-key";
import { usePresence } from "@/hooks/use-presence";
import { MOBILE_QUERY, useMediaQuery } from "@/hooks/use-media-query";
import { squircle } from "@/lib/corners";
import { AccountMenu, ThemePicker, accountLinks } from "../account-menu";
import { CommandPalette } from "../command-palette";
import { useFloatingActions } from "../floating-actions";
import { alertKindLabels, type SidebarAlert } from "../alerts";
import { Notifications, type AppNotification } from "../notifications";
import { isCurrent, isFolder, navGroups, type NavFolder, type NavLink } from "../nav";
import { TeamSwitcher, type SwitcherTeam } from "../team-switcher";
import styles from "./sidebar.module.css";

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
};

/* Quantas bolinhas o aviso mostra antes de resumir o resto em "+N". */
const ALERT_FACES = 3;

type NavMotion = "forward" | "back";

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

function Row({ item, active, onNavigate }: { item: NavLink; active: boolean; onNavigate?: () => void }) {
  return (
    <Link
      href={item.href}
      className={styles.row}
      data-active={active || undefined}
      onClick={onNavigate}
      {...squircle("md")}
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

// Pasta abre no lugar da lista, e não em submenu: a lista some, entram as páginas de dentro e um
// voltar no topo. Em painel estreito submenu aninhado empurra tudo para a direita e some da vista.
export function SidebarPanel({
  team,
  user,
  teams,
  currentTeamId,
  notifications,
  alert,
  variant,
  onSearch,
  onNotificationsChange,
  onNavigate,
}: PanelProps) {
  const pathname = usePathname();
  const commandKey = useCommandKey();
  const navRef = useRef<HTMLElement>(null);
  const [folder, setFolder] = useState<NavFolder | null>(null);
  const [motion, setMotion] = useState<NavMotion | null>(null);

  // Abrir pasta leva a rolagem ao topo: na tela cheia a pasta costuma ser escolhida lá embaixo, e a
  // lista curta que entra no lugar ficava fora da vista, com a tela parada no rodapé.
  const openFolder = (entry: NavFolder) => {
    setFolder(entry);
    setMotion("forward");
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    scrollRegion(navRef.current)?.scrollTo({
      top: 0,
      behavior: reduced ? "auto" : "smooth",
    });
  };

  const closeFolder = () => {
    setFolder(null);
    setMotion("back");
  };
  const [alertVisible, setAlertVisible] = useState(true);
  const mobile = variant === "mobile";

  // O aviso muda de lugar por moldura: no desktop entra acima do perfil, no celular segue por último,
  // depois das ações da conta. Posição por árvore, para a leitura seguir a tela. Quem está envolvido
  // vira bolinhas com o resto em "+N", o título e a linha de apoio dizem o que e quando, e o atalho leva
  // a quem resolve. O X dispensa até a próxima carga.
  const faces = alert?.people.slice(0, ALERT_FACES) ?? [];
  const extraFaces = alert ? alert.people.length - faces.length : 0;
  const external = alert?.action.href.startsWith("http");
  const planCard = alert && alertVisible && (
    <section className={styles.promo} {...squircle("lg")} aria-label={`${alertKindLabels[alert.kind]}: ${alert.title}`}>
      <div className={styles.promoHead}>
        {faces.length > 0 && (
          <span className={styles.promoPeople}>
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
        )}
        <IconButton label="Dispensar aviso" variant="ghost" size="sm" className={styles.promoClose} onClick={() => setAlertVisible(false)}>
          <XIcon />
        </IconButton>
      </div>

      <div className={styles.promoPlan}>
        <Text variant={mobile ? "callout" : "subheadline"} weight="semibold" truncate>
          {alert.title}
        </Text>
        <Text variant={mobile ? "footnote" : "caption1"} tone="secondary" truncate>
          {alert.detail}
        </Text>
      </div>

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
    </section>
  );
  return (
    <div className={styles.panel}>
      <header className={styles.top}>
        <Avatar
          name={team.name}
          src={team.logoUrl ?? undefined}
          size={mobile ? "sm" : "xs"}
          shape="squircle"
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
        {...squircle("md")}
      >
        <MagnifyingGlassIcon aria-hidden="true" />
        <span className={styles.findLabel}>Buscar</span>
        <span className={styles.findKeys}>
          <Kbd>{commandKey}</Kbd>
          <Kbd>F</Kbd>
        </span>
      </button>

      <nav
        ref={navRef}
        className={styles.nav}
        aria-label="Navegação principal"
        data-folder={folder ? "" : undefined}
      >
        {/* A chave troca com a pasta, então cada troca remonta a pilha e a entrada anima na direção certa:
            para dentro vem da direita, para fora volta da esquerda. */}
        <div
          key={folder?.label ?? "raiz"}
          className={styles.stack}
          data-motion={motion ?? undefined}
        >
          {folder ? (
            <div className={styles.group}>
              <button
                type="button"
                className={styles.back}
                onClick={closeFolder}
                {...squircle("md")}
              >
                <CaretLeftIcon aria-hidden="true" />
                <span className={styles.label}>{folder.label}</span>
              </button>
              {folder.items.map((item) => (
                <Row
                  key={item.href}
                  item={item}
                  active={isCurrent(pathname, item.href)}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          ) : (
            navGroups.map((group, index) => (
              // O título do grupo saiu da tela e virou nome do grupo para leitor de tela: quem separa
              // um do outro agora é a linha, que sangra até a borda do menu.
              <Fragment key={group.title}>
                {index > 0 && <span className={styles.divider} />}
                <div
                  className={styles.group}
                  role="group"
                  aria-label={group.title}
                >
                  {group.entries.map((entry) =>
                    isFolder(entry) ? (
                      <button
                        key={entry.label}
                        type="button"
                        className={styles.row}
                        data-active={
                          folderIsCurrent(pathname, entry) || undefined
                        }
                        onClick={() => openFolder(entry)}
                        {...squircle("md")}
                      >
                        <entry.icon aria-hidden="true" />
                        <span className={styles.label}>{entry.label}</span>
                        <CaretRightIcon
                          aria-hidden="true"
                          className={styles.chevron}
                        />
                      </button>
                    ) : (
                      <Row
                        key={entry.href}
                        item={entry}
                        active={isCurrent(pathname, entry.href)}
                        onNavigate={onNavigate}
                      />
                    ),
                  )}
                </div>
              </Fragment>
            ))
          )}
        </div>
      </nav>

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
                {...squircle("md")}
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

            <a href="/auth/sair" className={styles.row} {...squircle("md")}>
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

// No celular o painel não fica: ele é chamado pela barra flutuante de baixo e toma a tela inteira.
// A troca é de árvore, e não de CSS, porque as duas formas têm conteúdo diferente no rodapé.
export function Sidebar(props: SidebarProps) {
  const mobile = useMediaQuery(MOBILE_QUERY);
  const [open, setOpen] = useState(false);
  // As ações que a tela de agora pendurou na barra do celular (salvar e sair de um formulário): com elas
  // a barra fica minimizada, sem a busca, e mostra as duas ao lado do botão do menu.
  const { shape: actions, run: runAction } = useFloatingActions();
  const [searching, setSearching] = useState(false);
  const [searchKey, setSearchKey] = useState(0);
  const [notifications, setNotifications] = useState(props.notifications);
  const screen = usePresence(open);

  const openSearch = () => {
    setSearchKey((current) => current + 1);
    setSearching(true);
  };

  const unread = notifications.filter((item) => !item.read).length;

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

  const search = (
    <CommandPalette
      key={searchKey}
      open={searching}
      onClose={() => setSearching(false)}
    />
  );
  const panel = {
    ...props,
    notifications,
    onNotificationsChange: setNotifications,
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
          onAnimationEnd={screen.onAnimationEnd}
        >
          <SidebarPanel {...panel} variant="mobile" onSearch={openSearch} onNavigate={() => setOpen(false)} />
        </div>
      )}

      {/* Menu aberto encolhe a barra até sobrar só o X: o grupo de busca e sino recolhe pela trilha da
          grade, que anima de 1fr a 0fr, e a barra vira bolinha. A chave no botão remonta o glifo a cada
          troca, e a entrada dele gira, porque X e três linhas não se transformam um no outro. */}
      <div className={styles.bar} data-collapsed={open || undefined}>
        <div className={styles.barGroup} inert={open || undefined}>
          <div className={styles.barGroupInner}>
            {actions ? (
              <>
                {/* Tela com ações próprias: a busca sai e entram salvar e sair, no lugar dela, para a
                    barra continuar uma só e o botão do menu ficar onde sempre fica. */}
                <Button size="md" radius="md" iconStart={<CheckIcon />} loading={actions.loading} onClick={runAction} className={styles.barPrimary}>
                  {actions.primaryLabel}
                </Button>
                <span className={styles.barDivider} aria-hidden="true" />
                <IconButton label={actions.cancelLabel} variant="ghost" size="md" radius="md" href={actions.cancelHref}>
                  <XIcon />
                </IconButton>
                <span className={styles.barDivider} aria-hidden="true" />
              </>
            ) : (
              <>
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
                    onChange={setNotifications}
                    size="md"
                    radius="md"
                  />
                  <span className={styles.barDivider} aria-hidden="true" />
                </span>
              </>
            )}
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
          onClick={() => setOpen((current) => !current)}
        >
          {open ? <XIcon /> : <ListIcon />}
        </IconButton>
      </div>

      {search}
    </>
  );
}
