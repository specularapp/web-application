"use client";

import {
  BellIcon,
  CaretLeftIcon,
  CaretRightIcon,
  CaretUpDownIcon,
  GearSixIcon,
  LifebuoyIcon,
  ListIcon,
  MagnifyingGlassIcon,
  MoonIcon,
  SignOutIcon,
  SparkleIcon,
  XIcon,
} from "@phosphor-icons/react";
import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Progress } from "@/components/ui/progress";
import { Text } from "@/components/ui/text";
import { MOBILE_QUERY, useMediaQuery } from "@/hooks/use-media-query";
import { squircle } from "@/lib/corners";
import { compactMoney } from "@/lib/utils/format";
import { Logo } from "../logo";
import { isFolder, navGroups, type NavFolder, type NavLink } from "../nav";
import styles from "./sidebar.module.css";

export type SidebarTeam = { name: string; logoUrl: string | null; plan: string };

export type SidebarUser = { name: string; role: string; avatarUrl: string | null };

/** Meta de faturamento do período, em centavos, como todo dinheiro do produto. */
export type SidebarGoal = { label: string; currentCents: number; targetCents: number };

export type SidebarPromo = { title: string; description: string; action: string; href: Route };

export type SidebarProps = {
  team: SidebarTeam;
  user: SidebarUser;
  goal: SidebarGoal;
  promo: SidebarPromo;
  notifications?: number;
  onClose?: () => void;
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

type PanelProps = SidebarProps & { variant: "desktop" | "mobile" };

// Pasta abre no lugar da lista, e não em submenu: a lista some, entram as páginas de dentro e um
// voltar no topo. Em painel estreito submenu aninhado empurra tudo para a direita e some da vista.
export function SidebarPanel({ team, user, goal, promo, notifications = 0, onClose, variant }: PanelProps) {
  const pathname = usePathname();
  const [folder, setFolder] = useState<NavFolder | null>(null);
  const mobile = variant === "mobile";
  const reached = goal.targetCents > 0 ? (goal.currentCents / goal.targetCents) * 100 : 0;

  return (
    <div className={styles.panel} {...squircle("2xl")}>
      {!mobile && (
        <header className={styles.top}>
          <Logo variant="logotipo" height={20} />
          <div className={styles.tools}>
            <IconButton label="Buscar" variant="ghost" size="sm">
              <MagnifyingGlassIcon />
            </IconButton>
            <span className={styles.bell}>
              <IconButton label={`Notificações, ${notifications} não lidas`} variant="ghost" size="sm">
                <BellIcon />
              </IconButton>
              {notifications > 0 && <span className={styles.count}>{notifications > 9 ? "9+" : notifications}</span>}
            </span>
            <IconButton label="Fechar o menu" variant="ghost" size="sm" onClick={onClose}>
              <XIcon />
            </IconButton>
          </div>
        </header>
      )}

      <div className={styles.team} {...squircle("lg")}>
        <Avatar name={team.name} src={team.logoUrl ?? undefined} size="sm" shape="squircle" />
        <span className={styles.teamText}>
          <Text variant="subheadline" weight="medium" truncate>
            {team.name}
          </Text>
          <Badge tone="neutral" variant="outline" size="sm">
            {team.plan}
          </Badge>
        </span>
        <IconButton label="Trocar de time" variant="ghost" size="sm">
          <CaretUpDownIcon />
        </IconButton>
      </div>

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
          navGroups.map((group) => (
            <div key={group.title} className={styles.group}>
              <Text variant="caption1" tone="tertiary" className={styles.groupTitle}>
                {group.title}
              </Text>
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
          ))
        )}
      </nav>

      <div className={styles.foot}>
        <section className={styles.promo} {...squircle("lg")} aria-label={promo.title}>
          <span className={styles.promoIcon}>
            <SparkleIcon weight="fill" aria-hidden="true" />
          </span>
          <div className={styles.promoText}>
            <Text variant="subheadline" weight="semibold">
              {promo.title}
            </Text>
            <Text variant="caption1" tone="secondary">
              {promo.description}
            </Text>
            <Button size="sm" radius="md" className={styles.promoAction}>
              {promo.action}
            </Button>
          </div>
        </section>

        <section className={styles.goal} {...squircle("lg")} aria-label={goal.label}>
          <div className={styles.goalHead}>
            <Text variant="caption1" tone="secondary">
              {goal.label}
            </Text>
            <span className={styles.goalValue}>
              {compactMoney(goal.currentCents)} de {compactMoney(goal.targetCents)}
            </span>
          </div>
          <Progress value={reached} size="xs" tone="success" />
        </section>

        <div className={styles.profile} {...squircle("lg")}>
          <Avatar name={user.name} src={user.avatarUrl ?? undefined} size="sm" />
          <span className={styles.profileText}>
            <Text variant="subheadline" weight="medium" truncate>
              {user.name}
            </Text>
            <Text variant="caption2" tone="secondary" truncate>
              {user.role}
            </Text>
          </span>
          {!mobile && (
            <IconButton label="Abrir opções da conta" variant="ghost" size="sm">
              <CaretUpDownIcon />
            </IconButton>
          )}
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
      </div>
    </div>
  );
}

// No celular o painel não fica: ele é chamado pela barra flutuante de baixo e toma a tela inteira.
// A troca é de árvore, e não de CSS, porque as duas formas têm conteúdo diferente no rodapé.
export function Sidebar(props: SidebarProps) {
  const mobile = useMediaQuery(MOBILE_QUERY);
  const [open, setOpen] = useState(false);

  if (!mobile) {
    return (
      <aside className={styles.sidebar}>
        <SidebarPanel {...props} variant="desktop" />
      </aside>
    );
  }

  return (
    <>
      {open && (
        <div className={styles.screen}>
          <SidebarPanel {...props} variant="mobile" onClose={() => setOpen(false)} />
        </div>
      )}

      <div className={styles.bar} {...squircle("3xl")}>
        <button type="button" className={styles.search}>
          <MagnifyingGlassIcon aria-hidden="true" />
          Buscar
        </button>
        <IconButton
          label={open ? "Fechar o menu" : "Abrir o menu"}
          variant="secondary"
          size="md"
          onClick={() => setOpen((current) => !current)}
        >
          {open ? <XIcon /> : <ListIcon />}
        </IconButton>
      </div>
    </>
  );
}
