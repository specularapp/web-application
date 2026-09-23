"use client";

import styled from "@emotion/styled";
import { BellIcon, CaretUpDownIcon, CreditCardIcon, GearSixIcon, MoonIcon, ShieldCheckIcon, SignOutIcon, SunIcon } from "@phosphor-icons/react";
import type { Route } from "next";
import { useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, type DropdownSection } from "@/components/ui/dropdown-menu";
import { hoverMotion } from "@/components/ui/styles";
import { Text } from "@/components/ui/text";
import { applyTheme, type Theme } from "@/lib/theme";

export type AccountUser = { name: string; email: string | null; avatarUrl: string | null };
export type AccountMenuProps = { user: AccountUser; plan: string; size?: "sm" | "md" };
export type AccountLink = {
  label: string;
  href: Route;
  icon: typeof GearSixIcon;
  plan?: boolean;
  desktopOnly?: boolean;
};

/** Fonte única das opções de conta no menu compacto e na navegação móvel. */
export const accountLinks: AccountLink[] = [
  { label: "Assinatura", href: "/configuracoes/plano", icon: CreditCardIcon, plan: true },
  { label: "Conta", href: "/configuracoes", icon: GearSixIcon },
  { label: "Notificações", href: "/configuracoes/notificacoes", icon: BellIcon, desktopOnly: true },
  { label: "Segurança", href: "/configuracoes/seguranca", icon: ShieldCheckIcon },
];

const themes: { value: Theme; label: string; icon: typeof SunIcon }[] = [
  { value: "light", label: "Claro", icon: SunIcon },
  { value: "dark", label: "Escuro", icon: MoonIcon },
];

const Themes = styled.div`
  display: inline-grid;
  flex-shrink: 0;
  grid-auto-flow: column;
  gap: var(--space-half);
  padding: var(--space-1);
  background-color: var(--color-fill-quaternary);
  border-radius: var(--radius-md);
`;

const ThemeOption = styled.button`
  display: inline-grid;
  place-items: center;
  width: 2rem;
  height: 1.75rem;
  padding: 0;
  color: var(--color-label-secondary);
  background-color: transparent;
  border: 0;
  border-radius: calc(var(--radius-md) - var(--space-1));
  cursor: pointer;
  ${hoverMotion};

  @media (hover: hover) {
    &:hover { color: var(--color-label); }
    &:focus-visible { outline: 2px solid var(--color-focus); outline-offset: 2px; }
  }

  &[aria-pressed="true"] {
    color: var(--color-label);
    background-color: var(--color-bg-grouped-secondary);
    box-shadow: var(--shadow-sm);
  }

  & svg { width: 1rem; height: 1rem; fill: currentColor; }
`;

/** Controle compacto compartilhado com a tela móvel da conta. */
export function ThemePicker() {
  const [theme, setTheme] = useState<Theme>(() =>
    typeof document !== "undefined" && document.documentElement.dataset.theme === "light" ? "light" : "dark",
  );
  const choose = (next: Theme) => {
    applyTheme(next);
    setTheme(next);
  };

  return (
    <Themes role="group" aria-label="Tema da interface">
      {themes.map((option) => (
        <ThemeOption key={option.value} type="button" aria-label={option.label} title={option.label} aria-pressed={option.value === theme} onClick={() => choose(option.value)}>
          <option.icon aria-hidden="true" weight={option.value === theme ? "fill" : "regular"} />
        </ThemeOption>
      ))}
    </Themes>
  );
}

const Identity = styled.div`
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-width: 0;
  padding: var(--space-3);
  border-block-end: 0.0375rem solid var(--color-border);
`;

const IdentityCopy = styled.div`
  display: grid;
  flex: 1;
  gap: var(--space-half);
  min-width: 0;
`;

/** O menu de conta usa o mesmo DropdownMenu de todo o produto; não mantém outra implementação de
 * posicionamento, superfície, rolagem e teclado. */
export function AccountMenu({ user, plan, size = "sm" }: AccountMenuProps) {
  const [theme, setTheme] = useState<Theme>(() =>
    typeof document !== "undefined" && document.documentElement.dataset.theme === "light" ? "light" : "dark",
  );
  const chooseTheme = (next: Theme) => {
    applyTheme(next);
    setTheme(next);
  };

  const sections: DropdownSection[] = [
    {
      id: "account",
      items: accountLinks.map((link) => ({
        id: link.href,
        label: link.label,
        icon: link.icon,
        href: link.href,
        suffix: link.plan ? <Badge tone="neutral" variant="soft" size="sm">{plan}</Badge> : undefined,
      })),
    },
    {
      id: "theme",
      label: "Tema",
      items: themes.map((option) => ({
        id: `theme-${option.value}`,
        label: option.label,
        icon: option.icon,
        selected: theme === option.value,
        onSelect: () => chooseTheme(option.value),
      })),
    },
    { id: "session", items: [{ id: "sign-out", label: "Sair da conta", icon: SignOutIcon, href: "/auth/sair" }] },
  ];

  return (
    <DropdownMenu
      label="Opções da conta"
      triggerLabel="Abrir opções da conta"
      icon={<CaretUpDownIcon />}
      size={size}
      sections={sections}
      searchable={false}
      header={
        <Identity>
          <Avatar name={user.name} src={user.avatarUrl ?? undefined} seed={user.email ?? user.name} size="sm" />
          <IdentityCopy>
            <Text variant="subheadline" weight="medium" truncate>{user.name}</Text>
            {user.email && <Text variant="caption1" tone="secondary" truncate>{user.email}</Text>}
          </IdentityCopy>
        </Identity>
      }
    />
  );
}
