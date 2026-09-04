"use client";

import {
  BellIcon,
  CaretLeftIcon,
  CaretRightIcon,
  CaretUpDownIcon,
  CrownSimpleIcon,
  GearSixIcon,
  LifebuoyIcon,
  LightningIcon,
  ListIcon,
  MagnifyingGlassIcon,
  MoonIcon,
  SignOutIcon,
  XIcon,
} from "@phosphor-icons/react";
import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment, useEffect, useState, type CSSProperties } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Kbd } from "@/components/ui/kbd";
import { Text } from "@/components/ui/text";
import { useCommandKey } from "@/hooks/use-command-key";
import { MOBILE_QUERY, useMediaQuery } from "@/hooks/use-media-query";
import { squircle } from "@/lib/corners";
import { CommandPalette } from "../command-palette";
import { Notifications, type AppNotification } from "../notifications";
import { isFolder, navGroups, type NavFolder, type NavLink } from "../nav";
import { TeamSwitcher, type SwitcherTeam } from "../team-switcher";
import styles from "./sidebar.module.css";

export type SidebarTeam = { name: string; logoUrl: string | null; plan: string };

export type SidebarUser = { name: string; email: string | null; role: string; avatarUrl: string | null };

/** Alerta de plano: `eyebrow` é o rótulo curto de cima, `title` é o plano em vigor. */
export type SidebarPromo = { eyebrow: string; title: string; description: string; action: string; href: Route };

export type SidebarProps = {
  team: SidebarTeam;
  user: SidebarUser;
  /** Times em que a pessoa entra, para a troca no topo. O atual vem separado porque pode não existir. */
  teams: SwitcherTeam[];
  currentTeamId: string | null;
  notifications: AppNotification[];
  /** Sem convite (plano pago em dia) a seção não é desenhada. */
  promo?: SidebarPromo;
};

const accountActions: { label: string; href: Route; icon: typeof GearSixIcon }[] = [
  { label: "Configurações da conta", href: "/configuracoes", icon: GearSixIcon },
  { label: "Notificações", href: "/configuracoes/notificacoes", icon: BellIcon },
];

function isCurrent(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function folderIsCurrent(pathname: string, folder: NavFolder) {
  return folder.items.some((item) => isCurrent(pathname, item.href));
}

function Row({ item, active }: { item: NavLink; active: boolean }) {
  return (
    <Link href={item.href} className={styles.row} data-active={active || undefined} {...squircle("md")}>
      <item.icon aria-hidden="true" />
      <span className={styles.label}>{item.label}</span>
    </Link>
  );
}

type PanelProps = SidebarProps & {
  variant: "desktop" | "mobile";
  onSearch?: () => void;
  onNotificationsChange?: (items: AppNotification[]) => void;
};

// Pasta abre no lugar da lista, e não em submenu: a lista some, entram as páginas de dentro e um
// voltar no topo. Em painel estreito submenu aninhado empurra tudo para a direita e some da vista.
export function SidebarPanel({
  team,
  user,
  teams,
  currentTeamId,
  notifications,
  promo,
  variant,
  onSearch,
  onNotificationsChange,
}: PanelProps) {
  const pathname = usePathname();
  const commandKey = useCommandKey();
  const [folder, setFolder] = useState<NavFolder | null>(null);
  const [promoVisible, setPromoVisible] = useState(true);
  const mobile = variant === "mobile";

  // O convite de plano muda de lugar por moldura: no desktop entra acima do perfil, no celular
  // segue por último, depois das ações da conta. Posição por árvore, para a leitura seguir a tela.
  const planCard = promo && promoVisible && (
    <section className={styles.promo} {...squircle("lg")} aria-label={promo.eyebrow}>
      <div className={styles.promoHead}>
        <span className={styles.promoIcon}>
          <CrownSimpleIcon aria-hidden="true" />
        </span>
        <div className={styles.promoPlan}>
          <Text variant="caption2" tone="secondary" className={`${styles.promoLine} ${styles.promoEyebrow}`}>
            {promo.eyebrow}
          </Text>
          <Text variant={mobile ? "callout" : "subheadline"} weight="semibold" truncate className={styles.promoLine}>
            {promo.title}
          </Text>
        </div>
        <IconButton
          label="Dispensar alerta de plano"
          variant="ghost"
          size="sm"
          className={styles.promoClose}
          onClick={() => setPromoVisible(false)}
        >
          <XIcon />
        </IconButton>
      </div>

      <Text variant={mobile ? "footnote" : "caption1"} tone="secondary">
        {promo.description}
      </Text>

      <Button
        size={mobile ? "md" : "sm"}
        radius="md"
        fullWidth
        variant="secondary"
        background="var(--color-label)"
        foreground="var(--color-bg)"
        border="transparent"
        style={{ "--button-background-hover": "color-mix(in oklab, var(--color-label) 85%, var(--color-bg))" } as CSSProperties}
        iconStart={<LightningIcon />}
      >
        {promo.action}
      </Button>
    </section>
  );

  return (
    <div className={styles.panel}>
      <header className={styles.top}>
        <Avatar name={team.name} src={team.logoUrl ?? undefined} size={mobile ? "sm" : "xs"} shape="squircle" />
        <Text variant={mobile ? "callout" : "subheadline"} weight="medium" truncate className={styles.teamName}>
          {team.name}
        </Text>
        <Badge tone="neutral" variant="soft" size={mobile ? "md" : "sm"} className={styles.teamPlan}>
          {team.plan}
        </Badge>
        <TeamSwitcher
          teams={teams}
          currentId={currentTeamId}
          owner={{ name: user.name, email: user.email, avatarUrl: user.avatarUrl }}
          size={mobile ? "md" : "sm"}
        />
      </header>

      <button type="button" className={styles.find} onClick={onSearch} {...squircle("md")}>
        <MagnifyingGlassIcon aria-hidden="true" />
        <span className={styles.findLabel}>Buscar</span>
        <span className={styles.findKeys}>
          <Kbd>{commandKey}</Kbd>
          <Kbd>F</Kbd>
        </span>
      </button>

      <nav className={styles.nav} aria-label="Navegação principal">
        {folder ? (
          <div className={styles.group}>
            <button type="button" className={styles.back} onClick={() => setFolder(null)} {...squircle("md")}>
              <CaretLeftIcon aria-hidden="true" />
              <span className={styles.label}>{folder.label}</span>
            </button>
            {folder.items.map((item) => (
              <Row key={item.href} item={item} active={isCurrent(pathname, item.href)} />
            ))}
          </div>
        ) : (
          navGroups.map((group, index) => (
            // O título do grupo saiu da tela e virou nome do grupo para leitor de tela: quem separa
            // um do outro agora é a linha, que sangra até a borda do menu.
            <Fragment key={group.title}>
              {index > 0 && <span className={styles.divider} />}
              <div className={styles.group} role="group" aria-label={group.title}>
                {group.entries.map((entry) =>
                  isFolder(entry) ? (
                    <button
                      key={entry.label}
                      type="button"
                      className={styles.row}
                      data-active={folderIsCurrent(pathname, entry) || undefined}
                      onClick={() => setFolder(entry)}
                      {...squircle("md")}
                    >
                      <entry.icon aria-hidden="true" />
                      <span className={styles.label}>{entry.label}</span>
                      <CaretRightIcon aria-hidden="true" className={styles.chevron} />
                    </button>
                  ) : (
                    <Row key={entry.href} item={entry} active={isCurrent(pathname, entry.href)} />
                  ),
                )}
              </div>
            </Fragment>
          ))
        )}
      </nav>

      <div className={styles.foot}>
        {!mobile && planCard}

        <div className={styles.profile}>
          <Avatar name={user.name} src={user.avatarUrl ?? undefined} size={mobile ? "sm" : "xs"} />
          <span className={styles.profileText}>
            <Text variant={mobile ? "callout" : "subheadline"} weight="medium" truncate>
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
              <IconButton label="Abrir opções da conta" variant="ghost" size="sm">
                <CaretUpDownIcon />
              </IconButton>
            )}
          </span>
        </div>

        {mobile && (
          <div className={styles.actions}>
            {accountActions.map((action) => (
              <Link key={action.href} href={action.href} className={styles.row} {...squircle("md")}>
                <action.icon aria-hidden="true" />
                <span className={styles.label}>{action.label}</span>
              </Link>
            ))}
            <button type="button" className={styles.row} {...squircle("md")}>
              <MoonIcon aria-hidden="true" />
              <span className={styles.label}>Tema</span>
            </button>
            <button type="button" className={styles.row} {...squircle("md")}>
              <LifebuoyIcon aria-hidden="true" />
              <span className={styles.label}>Ajuda</span>
            </button>
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
  const [searching, setSearching] = useState(false);
  const [notifications, setNotifications] = useState(props.notifications);

  const unread = notifications.filter((item) => !item.read).length;

  // A tecla do atalho é a mesma que o campo mostra. O `preventDefault` tira a busca do navegador, que
  // procura no texto da página e não serve a quem quer pular para outra tela.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "f" || !(event.metaKey || event.ctrlKey)) return;
      event.preventDefault();
      setSearching(true);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const search = searching && <CommandPalette onClose={() => setSearching(false)} />;
  const panel = { ...props, notifications, onNotificationsChange: setNotifications };

  if (!mobile) {
    return (
      <aside className={styles.sidebar}>
        <SidebarPanel {...panel} variant="desktop" onSearch={() => setSearching(true)} />
        {search}
      </aside>
    );
  }

  return (
    <>
      {open && (
        <div className={styles.screen}>
          <SidebarPanel {...panel} variant="mobile" onSearch={() => setSearching(true)} />
        </div>
      )}

      <div className={styles.bar} {...squircle("3xl")}>
        <button type="button" className={styles.search} onClick={() => setSearching(true)}>
          <MagnifyingGlassIcon aria-hidden="true" />
          <span className={styles.searchLabel}>Buscar</span>
        </button>
        <span className={styles.barDivider} aria-hidden="true" />
        {unread > 0 && <Notifications items={notifications} onChange={setNotifications} size="md" />}
        <IconButton
          label={open ? "Fechar o menu" : "Abrir o menu"}
          variant="ghost"
          size="md"
          onClick={() => setOpen((current) => !current)}
        >
          {open ? <XIcon /> : <ListIcon />}
        </IconButton>
      </div>

      {search}
    </>
  );
}
