"use client";

import { css } from "@emotion/react";
import styled from "@emotion/styled";
import { CaretRightIcon, CaretUpDownIcon, type Icon } from "@phosphor-icons/react";
import type { Route } from "next";
import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { planBadges, type PlanId } from "@/features/billing/plans";
import { MOBILE_QUERY, useMediaQuery } from "@/hooks/use-media-query";
import { useAnchoredPosition } from "@/hooks/use-anchored-position";
import { useOutsideDismiss } from "@/hooks/use-outside-dismiss";
import { usePresence } from "@/hooks/use-presence";
import { Badge } from "../badge";
import { Dialog } from "../dialog";
import { IconButton } from "../icon-button";
import { hoverMotion, layerMotion } from "../styles";
import { Switch } from "../switch";
import { Text } from "../text";

export type DropdownAction = {
  kind?: "action";
  id: string;
  label: string;
  icon?: Icon;
  /** Rota da casa, ou endereço externo começando com `http`, que abre em outra aba. */
  href?: Route | `http${string}`;
  /** Tem mais opções dentro: mostra a seta no fim da linha. */
  submenu?: boolean;
  /** Plano que libera a opção: mostra o selo do plano no fim da linha, o mesmo chip da Assinatura no menu da conta. */
  plan?: PlanId;
  /** Contagem no fim da linha, como quantos itens o histórico tem. */
  count?: number;
  tone?: "default" | "danger";
  onSelect?: () => void;
};

export type DropdownToggle = {
  kind: "toggle";
  id: string;
  label: string;
  icon?: Icon;
  checked: boolean;
  onChange: (checked: boolean) => void;
};

export type DropdownItem = DropdownAction | DropdownToggle;

export type DropdownSection = {
  id: string;
  /** Título pequeno acima dos itens, como "Acompanhamento". */
  label?: string;
  items: DropdownItem[];
};

export type DropdownMenuProps = {
  /** Nome do menu para leitor de tela. */
  label: string;
  /** Nome do botão que abre, como "Mais opções de Camila". */
  triggerLabel: string;
  sections: DropdownSection[];
  icon?: ReactNode;
  size?: "sm" | "md";
};

const PANEL_WIDTH = 280;
const ROW_HEIGHT = 40;
const EDGE = 16;
const GAP = 8;

type Resolved = { top: number; left: number; placement: "below" | "above" };

/* Canto declarado direto, sem `data-squircle`: a caixa guarda anel de foco de link e botão, e o recorte
   do fallback cortaria os dois. Mesma receita das camadas do menu. */
const Popover = styled.div`
  --panel-line: 0.0375rem;
  --genie-y: calc(var(--space-2) * -1);

  position: fixed;
  z-index: var(--z-dropdown);
  display: flex;
  flex-direction: column;
  width: min(${PANEL_WIDTH}px, calc(100vw - ${EDGE * 2}px));
  max-height: calc(100dvh - ${EDGE * 2}px);
  overflow-y: auto;
  background-color: var(--glass-layer-bg);
  border: var(--panel-line) solid var(--color-border);
  border-radius: var(--radius-2xl);
  corner-shape: squircle;
  box-shadow: var(--shadow-lg);
  -webkit-backdrop-filter: var(--glass-layer-blur);
  backdrop-filter: var(--glass-layer-blur);
  transform-origin: top left;

  ${layerMotion};

  /* Abrindo para cima o gênio nasce de baixo; a posição em si já vem resolvida em pixels. */
  &[data-placement="above"] {
    --genie-y: var(--space-2);
    transform-origin: bottom left;
  }
`;

/* Na bandeja do celular a lista fica solta dentro do Dialog, com o mesmo recuo das seções. */
const Sheet = styled.div`
  --panel-line: 0.0375rem;
  display: flex;
  flex-direction: column;
`;

const Section = styled.div`
  display: grid;
  gap: var(--space-half);
  padding: var(--space-2);

  & + & {
    border-block-start: var(--panel-line) solid var(--color-border);
  }
`;

const SectionLabel = styled(Text)`
  padding: var(--space-1) var(--space-2) var(--space-half);
`;

/* Mesma linha do menu, na mesma altura e no mesmo tom: a camada é continuação dele. */
const rowStyles = css`
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
  text-decoration: none;
  background-color: transparent;
  border: 0;
  border-radius: var(--radius-md);
  corner-shape: squircle;
  cursor: pointer;

  ${hoverMotion};

  &:hover,
  &:focus-visible {
    color: var(--color-label);
    background-color: var(--color-fill-quaternary);
  }

  &:focus-visible {
    outline: none;
  }

  &[data-tone="danger"] {
    color: var(--color-danger);
  }

  &[data-tone="danger"]:hover,
  &[data-tone="danger"]:focus-visible {
    color: var(--color-danger);
    background-color: color-mix(in oklab, var(--color-danger) 10%, transparent);
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

const ActionButton = styled.button`
  ${rowStyles}
`;

const ActionLink = styled(Link)`
  ${rowStyles}
`;

const ActionAnchor = styled.a`
  ${rowStyles}
`;

/* A linha de interruptor é o rótulo do próprio interruptor: clicar em qualquer ponto dela alterna. */
const ToggleRow = styled.label`
  ${rowStyles}
`;

const Label = styled.span`
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const Trailing = styled.span`
  display: inline-flex;
  flex-shrink: 0;
  gap: var(--space-2);
  align-items: center;

  & > svg {
    width: 1rem;
    height: 1rem;
    color: var(--color-label-tertiary);
  }
`;

const Trigger = styled.span`
  display: inline-flex;
  flex-shrink: 0;
`;

const MENU_ITEMS = '[role="menuitem"], [role="menuitemcheckbox"]';

function heightOf(sections: DropdownSection[]) {
  const rows = sections.reduce((total, section) => total + section.items.length + (section.label ? 0.6 : 0), 0);
  return rows * ROW_HEIGHT + sections.length * 16;
}

function isExternal(href: string) {
  return href.startsWith("http");
}

// Um menu de opções colado no próprio gatilho, no padrão das camadas do menu lateral: vidro, o fio da
// casa e a mesma linha do nav. Seções separadas por fio e com título opcional; itens de ação (botão,
// rota ou endereço externo), com seta de mais opções, selo do plano que libera e contagem no fim da
// linha, e itens de interruptor. No celular vira a bandeja do Dialog, sem escurecimento. Setas, Home e
// End andam pelos itens, Escape fecha e devolve o foco ao gatilho.
export function DropdownMenu({ label, triggerLabel, sections, icon, size = "sm" }: DropdownMenuProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const mobile = useMediaQuery(MOBILE_QUERY);
  const { present, state, onAnimationEnd } = usePresence(open && !mobile);
  const position = useAnchoredPosition(open && !mobile, triggerRef, { width: PANEL_WIDTH, height: heightOf(sections), edge: EDGE, gap: GAP });
  const [resolved, setResolved] = useState<Resolved | null>(null);

  useOutsideDismiss(open && !mobile, [popoverRef, triggerRef], () => setOpen(false));

  // A estimativa do hook decide o lado antes de pintar; aqui a caixa já montada é medida de verdade e
  // encaixada na janela, ainda antes do primeiro quadro: abaixo do gatilho se couber, acima se couber
  // melhor, e presa às bordas quando não cabe de jeito nenhum, com a rolagem interna cuidando do resto.
  // Refaz a cada mudança do hook, que acompanha rolagem e redimensionamento. A posição antiga fica
  // guardada entre uma abertura e outra sem aparecer: o efeito de layout recalcula antes do quadro.
  useLayoutEffect(() => {
    if (!present || !position) return;
    const box = popoverRef.current;
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!box || !rect) return;

    const height = box.offsetHeight;
    const room = window.innerHeight - EDGE;
    const below = rect.bottom + GAP;
    const above = rect.top - GAP - height;
    let top = below;
    let placement: Resolved["placement"] = "below";

    if (below + height > room) {
      if (above >= EDGE) {
        top = above;
        placement = "above";
      } else {
        top = Math.max(EDGE, Math.min(below, room - height));
        placement = rect.top > window.innerHeight / 2 ? "above" : "below";
      }
    }

    setResolved({ top, left: position.left, placement });
  }, [present, position]);

  const close = () => {
    setOpen(false);
    triggerRef.current?.focus({ preventScroll: true });
  };

  // O foco entra no primeiro item ao abrir, para as setas já funcionarem.
  useEffect(() => {
    if (!open || mobile) return;
    const frame = requestAnimationFrame(() => {
      popoverRef.current?.querySelector<HTMLElement>(MENU_ITEMS)?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [open, mobile]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(MENU_ITEMS));
    if (items.length === 0) return;
    const index = items.indexOf(document.activeElement as HTMLElement);
    const focus = (next: number) => items[(next + items.length) % items.length]?.focus({ preventScroll: true });

    if (event.key === "Escape") {
      event.preventDefault();
      close();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      focus(index + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      focus(index - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      focus(0);
    } else if (event.key === "End") {
      event.preventDefault();
      focus(items.length - 1);
    }
  };

  const renderItem = (item: DropdownItem) => {
    if (item.kind === "toggle") {
      return (
        <ToggleRow key={item.id} role="menuitemcheckbox" aria-checked={item.checked} tabIndex={-1}>
          {item.icon && <item.icon aria-hidden="true" />}
          <Label>{item.label}</Label>
          <Switch size="sm" checked={item.checked} onChange={(event) => item.onChange(event.target.checked)} tabIndex={-1} />
        </ToggleRow>
      );
    }

    const trailing = (item.count !== undefined || item.plan || item.submenu) && (
      <Trailing>
        {item.count !== undefined && (
          <Badge tone="neutral" size="sm">
            {item.count}
          </Badge>
        )}
        {item.plan && (
          <Badge tone="neutral" variant="soft" size="sm">
            {planBadges[item.plan]}
          </Badge>
        )}
        {item.submenu && <CaretRightIcon aria-hidden="true" weight="bold" />}
      </Trailing>
    );

    const content = (
      <>
        {item.icon && <item.icon aria-hidden="true" />}
        <Label>{item.label}</Label>
        {trailing}
      </>
    );

    const select = () => {
      item.onSelect?.();
      setOpen(false);
    };

    if (item.href && isExternal(item.href)) {
      return (
        <ActionAnchor key={item.id} role="menuitem" href={item.href} target="_blank" rel="noreferrer" data-tone={item.tone} onClick={select} tabIndex={-1}>
          {content}
        </ActionAnchor>
      );
    }

    if (item.href) {
      return (
        <ActionLink key={item.id} role="menuitem" href={item.href as Route} data-tone={item.tone} onClick={select} tabIndex={-1}>
          {content}
        </ActionLink>
      );
    }

    return (
      <ActionButton key={item.id} type="button" role="menuitem" data-tone={item.tone} onClick={select} tabIndex={-1}>
        {content}
      </ActionButton>
    );
  };

  const list = sections.map((section) => (
    <Section key={section.id} role="group" aria-label={section.label}>
      {section.label && (
        <SectionLabel as="p" variant="caption1" tone="secondary">
          {section.label}
        </SectionLabel>
      )}
      {section.items.map(renderItem)}
    </Section>
  ));

  return (
    <Trigger>
      <IconButton
        ref={triggerRef}
        label={triggerLabel}
        variant="ghost"
        size={size}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        {icon ?? <CaretUpDownIcon />}
      </IconButton>

      {mobile ? (
        <Dialog open={open} onClose={() => setOpen(false)} label={label} surface="glass" scrim={false} focusOnOpen={false}>
          <Sheet role="menu" aria-label={label} onKeyDown={onKeyDown}>
            {list}
          </Sheet>
        </Dialog>
      ) : (
        present &&
        createPortal(
          <Popover
            ref={popoverRef}
            role="menu"
            aria-label={label}
            data-placement={resolved?.placement ?? position?.placement ?? "below"}
            data-state={state}
            style={resolved ? { top: resolved.top, left: resolved.left } : { visibility: "hidden" }}
            onAnimationEnd={onAnimationEnd}
            onKeyDown={onKeyDown}
          >
            {list}
          </Popover>,
          document.body,
        )
      )}
    </Trigger>
  );
}
