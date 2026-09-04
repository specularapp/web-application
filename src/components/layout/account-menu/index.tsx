"use client";

import styled from "@emotion/styled";
import {
  BellIcon,
  CaretUpDownIcon,
  CreditCardIcon,
  GearSixIcon,
  ShieldCheckIcon,
  SignOutIcon,
} from "@phosphor-icons/react";
import type { Route } from "next";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { IconButton } from "@/components/ui/icon-button";
import { popIn } from "@/components/ui/styles";
import { Text } from "@/components/ui/text";
import { useAnchoredPosition } from "@/hooks/use-anchored-position";
import { readCookie } from "@/lib/cookies";
import { applyTheme, THEME_COOKIE, type ThemePreference } from "@/lib/theme";

export type AccountUser = { name: string; email: string | null; avatarUrl: string | null };

export type AccountMenuProps = {
  user: AccountUser;
  /** Rótulo curto do plano em vigor, o mesmo que o topo do menu mostra. */
  plan: string;
  size?: "sm" | "md";
};

const PANEL_WIDTH = 272;
const PANEL_HEIGHT = 360;
const EDGE = 16;

export type AccountLink = { label: string; href: Route; icon: typeof GearSixIcon; plan?: boolean };

/** Telas da conta, na ordem em que aparecem. Fonte única das duas molduras: o painel do desktop e a
 *  tela cheia do celular. */
export const accountLinks: AccountLink[] = [
  { label: "Assinatura", href: "/configuracoes/plano", icon: CreditCardIcon, plan: true },
  { label: "Conta", href: "/configuracoes", icon: GearSixIcon },
  { label: "Notificações", href: "/configuracoes/notificacoes", icon: BellIcon },
  { label: "Segurança", href: "/configuracoes/seguranca", icon: ShieldCheckIcon },
];

const themes: { value: ThemePreference; label: string }[] = [
  { value: "system", label: "Sistema" },
  { value: "light", label: "Claro" },
  { value: "dark", label: "Escuro" },
];

/* Canto declarado direto, sem `data-squircle`: a caixa guarda anel de foco de link e botão, e o
   recorte do fallback cortaria os dois. Mesma escolha das outras camadas do menu. */
const Popover = styled.div`
  --panel-line: 0.0375rem;
  --slide: calc(var(--space-2) * -1);

  position: fixed;
  z-index: var(--z-dropdown);
  display: flex;
  flex-direction: column;
  width: min(${PANEL_WIDTH}px, calc(100vw - ${EDGE * 2}px));
  overflow: hidden;
  background-color: var(--glass-bg);
  border: var(--panel-line) solid var(--color-border);
  border-radius: var(--radius-2xl);
  corner-shape: squircle;
  box-shadow: var(--shadow-lg);
  -webkit-backdrop-filter: var(--glass-blur);
  backdrop-filter: var(--glass-blur);
  transform-origin: top left;
  animation: ${popIn} var(--duration-fast) var(--ease-standard);

  &[data-placement="above"] {
    --slide: var(--space-2);
    transform-origin: bottom left;
    translate: 0 -100%;
  }

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3);
  border-block-end: var(--panel-line) solid var(--color-border);
`;

const Identity = styled.div`
  display: grid;
  flex: 1;
  gap: var(--space-half);
  min-width: 0;
`;

const Section = styled.div`
  display: grid;
  gap: var(--space-1);
  padding: var(--space-2);

  & + & {
    border-block-start: var(--panel-line) solid var(--color-border);
  }
`;

/* Mesma linha do menu, na mesma altura e no mesmo tom: a camada é continuação dele, e não outra ilha
   de estilo. */
const rowStyles = `
  display: flex;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
  min-height: 2.25rem;
  padding-block: var(--space-1);
  padding-inline: var(--space-2);
  font-family: var(--font-body);
  font-size: var(--text-subheadline);
  letter-spacing: var(--tracking-tight);
  color: color-mix(in oklab, var(--color-label) 75%, var(--color-bg));
  text-align: start;
  background-color: transparent;
  border: 0;
  border-radius: var(--radius-md);
  corner-shape: squircle;
  cursor: pointer;
  transition: background-color var(--duration-fast) var(--ease-standard);

  &:hover {
    color: var(--color-label);
    background-color: var(--color-fill-quaternary);
  }

  & > svg {
    flex-shrink: 0;
    width: 1.125rem;
    height: 1.125rem;
    color: inherit;
  }

  @media (pointer: coarse) {
    min-height: var(--touch-target);
  }
`;

const Row = styled(Link)`
  ${rowStyles}
`;

const Exit = styled.a`
  ${rowStyles}
`;

const Label = styled.span`
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const ThemeRow = styled.div`
  display: grid;
  gap: var(--space-2);
  padding-block: var(--space-1);
  padding-inline: var(--space-2);
`;

/* Três estados em fila, e não um interruptor: a casa guarda claro, escuro e o que o sistema mandar, e
   interruptor não sabe dizer o terceiro. */
const Themes = styled.div`
  display: inline-grid;
  flex-shrink: 0;
  grid-auto-flow: column;
  grid-auto-columns: minmax(max-content, 1fr);
  gap: var(--space-1);
  padding: var(--space-1);
  background-color: var(--color-fill-quaternary);
  border-radius: var(--radius-lg);
  corner-shape: squircle;
`;

const ThemeOption = styled.button`
  min-height: 1.75rem;
  padding-inline: var(--space-2);
  font-family: var(--font-body);
  font-size: var(--text-caption-1);
  font-weight: var(--weight-medium);
  letter-spacing: var(--tracking-tight);
  color: var(--color-label-secondary);
  background-color: transparent;
  border: 0;
  border-radius: calc(var(--radius-lg) - var(--space-1));
  corner-shape: squircle;
  cursor: pointer;
  transition: background-color var(--duration-fast) var(--ease-standard);

  &[aria-pressed="true"] {
    color: var(--color-label);
    background-color: var(--color-bg-grouped-secondary);
    box-shadow: var(--shadow-sm);
  }
`;

/** Fila de três estados, usada pelo painel do desktop e pela tela cheia do celular. */
export function ThemePicker() {
  const [theme, setTheme] = useState<ThemePreference>(
    () => (readCookie(THEME_COOKIE) as ThemePreference | undefined) ?? "system",
  );

  const choose = (next: ThemePreference) => {
    applyTheme(next);
    setTheme(next);
  };

  return (
    <Themes role="group" aria-label="Tema da interface">
      {themes.map((option) => (
        <ThemeOption
          key={option.value}
          type="button"
          aria-pressed={option.value === theme}
          onClick={() => choose(option.value)}
        >
          {option.label}
        </ThemeOption>
      ))}
    </Themes>
  );
}

const Trigger = styled.span`
  display: inline-flex;
  flex-shrink: 0;
`;

// Opções da conta coladas no próprio chevron, subindo porque o perfil mora no rodapé do menu: quem é
// você em cima, as telas da conta no meio, o tema e a saída embaixo.
export function AccountMenu({ user, plan, size = "sm" }: AccountMenuProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  const position = useAnchoredPosition(open, triggerRef, { width: PANEL_WIDTH, height: PANEL_HEIGHT });

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (popoverRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpen(false);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus({ preventScroll: true });
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <Trigger>
      <IconButton
        ref={triggerRef}
        label="Abrir opções da conta"
        variant="ghost"
        size={size}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <CaretUpDownIcon />
      </IconButton>

      {open &&
        createPortal(
          <Popover
            ref={popoverRef}
            role="menu"
            aria-label="Opções da conta"
            data-placement={position?.placement ?? "above"}
            style={position ? { top: position.top, left: position.left } : { visibility: "hidden" }}
          >
            <Header>
              <Avatar name={user.name} src={user.avatarUrl ?? undefined} seed={user.email ?? user.name} size="sm" />
              <Identity>
                <Text variant="subheadline" weight="medium" truncate>
                  {user.name}
                </Text>
                {user.email && (
                  <Text variant="caption1" tone="secondary" truncate>
                    {user.email}
                  </Text>
                )}
              </Identity>
            </Header>

            <Section>
              {accountLinks.map((link) => (
                <Row key={link.href} href={link.href} role="menuitem" onClick={() => setOpen(false)}>
                  <link.icon aria-hidden="true" />
                  <Label>{link.label}</Label>
                  {link.plan && (
                    <Badge tone="neutral" variant="soft" size="sm">
                      {plan}
                    </Badge>
                  )}
                </Row>
              ))}
            </Section>

            <Section>
              <ThemeRow>
                <Text variant="caption1" tone="secondary">
                  Tema
                </Text>
                <ThemePicker />
              </ThemeRow>
            </Section>

            <Section>
              <Exit href="/auth/sair" role="menuitem">
                <SignOutIcon aria-hidden="true" />
                <Label>Sair da conta</Label>
              </Exit>
            </Section>
          </Popover>,
          document.body,
        )}
    </Trigger>
  );
}
