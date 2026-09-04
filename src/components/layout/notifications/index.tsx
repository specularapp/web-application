"use client";

import { keyframes } from "@emotion/react";
import styled from "@emotion/styled";
import { BellIcon, BellSlashIcon, ChecksIcon, GearSixIcon, WarningCircleIcon, XIcon } from "@phosphor-icons/react";
import { formatDistanceToNowStrict } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import type { Route } from "next";
import { useEffect, useMemo, useRef, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { IconButton } from "@/components/ui/icon-button";
import { fadeIn, hoverMotion, layerMotion } from "@/components/ui/styles";
import { Text } from "@/components/ui/text";
import { useAnchoredPosition } from "@/hooks/use-anchored-position";
import { usePresence } from "@/hooks/use-presence";
import { MOBILE_QUERY, useMediaQuery } from "@/hooks/use-media-query";
import { cookieString, readCookie } from "@/lib/cookies";
import { createPortal } from "react-dom";

export type NotificationKind = "acao" | "revisao" | "sistema";

export type AppNotification = {
  id: string;
  kind: NotificationKind;
  title: string;
  description: string;
  /** Data em ISO: o tempo relativo é escrito no cliente, que é onde o painel monta. */
  at: string;
  read: boolean;
  actor?: { name: string; avatarUrl: string | null };
  action?: { label: string; href: Route };
};

export type NotificationsProps = {
  items: AppNotification[];
  /** Sem ele o painel guarda a própria lista; com ele quem manda é quem chamou, e dois gatilhos podem
   *  mostrar a mesma contagem. */
  onChange?: (items: AppNotification[]) => void;
  size?: "sm" | "md";
  /** Repassado ao gatilho: na barra flutuante ele acompanha o canto da barra, e não o círculo padrão. */
  radius?: "auto" | "md";
};

export const MUTE_COOKIE = "sp-notifications-muted";

/** Quantas notificações sem ler o contador mostra antes de virar "9+". */
const COUNT_LIMIT = 9;

const PANEL_WIDTH = 384;
const PANEL_HEIGHT = 460;
const EDGE = 16;

const tabs: { id: NotificationKind | "todas"; label: string }[] = [
  { id: "todas", label: "Todas" },
  { id: "acao", label: "Ação necessária" },
  { id: "revisao", label: "Revisões" },
  { id: "sistema", label: "Sistema" },
];

const kindIcon: Record<NotificationKind, typeof BellIcon> = {
  acao: WarningCircleIcon,
  revisao: ChecksIcon,
  sistema: GearSixIcon,
};

const grow = keyframes`
  from {
    transform: scaleX(0);
  }
`;

/* Canto declarado direto, sem `data-squircle`: a caixa guarda anel de foco de botão e link, e o
   recorte do fallback cortaria os dois. Mesma escolha do Listbox e da troca de time. */
const Popover = styled.div`
  --panel-line: 0.0375rem;
  --genie-y: calc(var(--space-2) * -1);

  position: fixed;
  z-index: var(--z-dropdown);
  display: flex;
  flex-direction: column;
  width: min(${PANEL_WIDTH}px, calc(100vw - ${EDGE * 2}px));
  overflow: hidden;
  background-color: var(--glass-layer-bg);
  border: var(--panel-line) solid var(--color-border);
  border-radius: var(--radius-3xl);
  corner-shape: squircle;
  box-shadow: var(--shadow-lg);
  -webkit-backdrop-filter: var(--glass-layer-blur);
  backdrop-filter: var(--glass-layer-blur);
  transform-origin: top left;

  ${layerMotion};

  &[data-placement="above"] {
    --genie-y: var(--space-2);
    transform-origin: bottom left;
    translate: 0 -100%;
  }
`;

const Header = styled.header`
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
`;

const Close = styled.span`
  flex-shrink: 0;
  margin-inline-start: auto;
`;

/* A fila de abas rola na horizontal e desbota nas pontas, como a fila de atalhos da busca: quatro
   categorias não cabem numa tela estreita e quebrar em duas linhas empurraria a lista para fora. */
const Tabs = styled.div`
  display: flex;
  flex-shrink: 0;
  gap: var(--space-1);
  padding-inline: var(--space-3);
  overflow-x: auto;
  overscroll-behavior-x: contain;
  border-block-end: var(--panel-line) solid var(--color-border);
  -webkit-mask-image: linear-gradient(
    to right,
    transparent,
    #000 var(--space-3),
    #000 calc(100% - var(--space-3)),
    transparent
  );
  mask-image: linear-gradient(
    to right,
    transparent,
    #000 var(--space-3),
    #000 calc(100% - var(--space-3)),
    transparent
  );
`;

/* A aba em vigor é marcada pelo traço embaixo, e não por preenchimento: preenchimento aqui competiria
   com a linha não lida de cada notificação. */
const Tab = styled.button`
  position: relative;
  flex-shrink: 0;
  min-height: 2.5rem;
  padding-inline: var(--space-2);
  font-family: var(--font-body);
  font-size: var(--text-footnote);
  font-weight: var(--weight-medium);
  letter-spacing: var(--tracking-tight);
  white-space: nowrap;
  color: var(--color-label-secondary);
  background-color: transparent;
  border: 0;
  cursor: pointer;

  ${hoverMotion};

  &:hover {
    color: var(--color-label);
  }

  &[aria-selected="true"] {
    color: var(--color-label);
  }

  &[aria-selected="true"]::after {
    content: "";
    position: absolute;
    inset-inline: var(--space-2);
    bottom: calc(var(--panel-line) * -1);
    height: 0.125rem;
    background-color: var(--color-label);
    transform-origin: left;
    animation: ${grow} var(--duration-base) var(--ease-standard);
  }

  @media (prefers-reduced-motion: reduce) {
    &[aria-selected="true"]::after {
      animation: none;
    }
  }
`;

const Body = styled.div`
  display: grid;
  align-content: start;
  min-height: 14rem;
  max-height: 24rem;
  min-width: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-mask-image: linear-gradient(to bottom, #000 calc(100% - var(--space-6)), transparent);
  mask-image: linear-gradient(to bottom, #000 calc(100% - var(--space-6)), transparent);

  &[data-empty] {
    align-content: center;
  }
`;

const List = styled.ul`
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
  animation: ${fadeIn} var(--duration-fast) var(--ease-standard) both;
`;

/* A linha inteira é o alvo: clicar marca como lida. O não lido acende um ponto na frente do título,
   e não pinta a linha toda, senão a lista vira um bloco de cor com meia dúzia de itens. */
const Item = styled.li`
  display: flex;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  cursor: pointer;

  ${hoverMotion};

  & + & {
    border-block-start: var(--panel-line) solid var(--color-border);
  }

  &:hover {
    background-color: var(--color-fill-quaternary);
  }

  &[data-read] {
    opacity: 0.6;
  }
`;

const Glyph = styled.span`
  display: grid;
  flex-shrink: 0;
  place-items: center;
  width: 2rem;
  height: 2rem;
  color: var(--color-label-secondary);
  border: var(--panel-line) solid var(--color-border);
  border-radius: var(--radius-md);
  corner-shape: squircle;

  & svg {
    width: 1.125rem;
    height: 1.125rem;
  }
`;

const Content = styled.div`
  display: grid;
  gap: var(--space-1);
  min-width: 0;
`;

const Line = styled.div`
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
`;

const Title = styled.span`
  min-width: 0;
  overflow: hidden;
  font-size: var(--text-subheadline);
  font-weight: var(--weight-medium);
  letter-spacing: var(--tracking-tight);
  color: var(--color-label);
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const Dot = styled.span`
  flex-shrink: 0;
  width: 0.375rem;
  height: 0.375rem;
  background-color: var(--color-accent);
  border-radius: var(--radius-full);
`;

const When = styled.time`
  flex-shrink: 0;
  margin-inline-start: auto;
  font-size: var(--text-caption-1);
  color: var(--color-label-tertiary);
`;

const Action = styled.span`
  justify-self: start;
  margin-block-start: var(--space-1);
`;

const Empty = styled.div`
  display: grid;
  gap: var(--space-3);
  place-items: center;
  padding: var(--space-8) var(--space-6);
  text-align: center;
`;

const EmptyIcon = styled.span`
  display: grid;
  place-items: center;
  width: 2.5rem;
  height: 2.5rem;
  color: var(--color-label-secondary);
  border: var(--panel-line, 0.0375rem) solid var(--color-border);
  border-radius: var(--radius-md);
  corner-shape: squircle;

  & svg {
    width: 1.25rem;
    height: 1.25rem;
  }
`;

const Trigger = styled.span`
  position: relative;
  display: inline-flex;
  flex-shrink: 0;
`;

/* O contador senta na quina do sino e não recebe ponteiro: quem clica é o botão embaixo dele. */
const Count = styled.span`
  position: absolute;
  inset-block-start: 0;
  inset-inline-end: 0;
  display: grid;
  place-items: center;
  min-width: 1rem;
  height: 1rem;
  padding-inline: 0.1875rem;
  font-family: var(--font-body);
  font-size: 0.625rem;
  font-weight: var(--weight-semibold);
  font-variant-numeric: tabular-nums;
  line-height: 1;
  color: var(--color-on-accent);
  background-color: var(--color-accent);
  border-radius: var(--radius-full);
  pointer-events: none;
`;

const Sheet = styled(Dialog)`
  --panel-line: 0.0375rem;
`;

function when(iso: string) {
  return formatDistanceToNowStrict(new Date(iso), { locale: ptBR, addSuffix: true });
}

// Notificações do produto, coladas no próprio sino: cabeçalho com o que falta ler, categorias em aba
// e a lista embaixo. No celular vira bandeja, onde o rodapé do menu fica longe do polegar.
export function Notifications({ items, onChange, size = "sm", radius = "auto" }: NotificationsProps) {
  const sheet = useMediaQuery(MOBILE_QUERY);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<NotificationKind | "todas">("todas");
  const [own, setOwn] = useState(items);
  const [muted, setMuted] = useState(() => readCookie(MUTE_COOKIE) === "1");
  const { present, state, onAnimationEnd } = usePresence(open && !sheet);

  const list = onChange ? items : own;
  const update = onChange ?? setOwn;

  const position = useAnchoredPosition(open && !sheet, triggerRef, {
    width: PANEL_WIDTH,
    height: PANEL_HEIGHT,
  });

  const unread = list.filter((item) => !item.read).length;
  const shown = useMemo(() => (tab === "todas" ? list : list.filter((item) => item.kind === tab)), [list, tab]);

  const close = () => setOpen(false);

  // A bandeja fecha sozinha por Escape e por toque fora; no desktop a caixa é avulsa e precisa dos
  // dois escutadores aqui.
  useEffect(() => {
    if (!open || sheet) return;

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
  }, [open, sheet]);

  const markOne = (id: string) => update(list.map((item) => (item.id === id ? { ...item, read: true } : item)));

  // Silenciar é preferência de interface, então mora em cookie e sobrevive ao recarregar.
  const toggleMute = () => {
    const next = !muted;
    document.cookie = cookieString(MUTE_COOKIE, next ? "1" : "0");
    setMuted(next);
  };

  const content = (
    <>
      <Header>
        <Text as="h2" variant="headline" weight="semibold">
          Notificações
        </Text>
        {unread > 0 && (
          <Badge tone="accent" variant="soft" size="sm">
            {unread}
          </Badge>
        )}
        <Close>
          <IconButton
            label={muted ? "Voltar a receber notificações" : "Silenciar notificações"}
            variant="ghost"
            size="sm"
            aria-pressed={muted}
            onClick={toggleMute}
          >
            {muted ? <BellSlashIcon /> : <BellIcon />}
          </IconButton>
          <IconButton label="Fechar" variant="ghost" size="sm" onClick={close}>
            <XIcon />
          </IconButton>
        </Close>
      </Header>

      <Tabs role="tablist" aria-label="Categorias de notificação">
        {tabs.map((entry) => (
          <Tab
            key={entry.id}
            type="button"
            role="tab"
            aria-selected={entry.id === tab}
            onClick={() => setTab(entry.id)}
          >
            {entry.label}
          </Tab>
        ))}
      </Tabs>

      <Body data-empty={shown.length === 0 || undefined}>
        {shown.length === 0 ? (
          <Empty>
            <EmptyIcon aria-hidden="true">
              <BellIcon />
            </EmptyIcon>
            <Text variant="footnote" tone="secondary">
              Nada por aqui nesta categoria.
            </Text>
          </Empty>
        ) : (
          <List key={tab}>
            {shown.map((item) => {
              const Icon = kindIcon[item.kind];
              return (
                <Item key={item.id} data-read={item.read || undefined} onClick={() => markOne(item.id)}>
                  {item.actor ? (
                    <Avatar
                      name={item.actor.name}
                      src={item.actor.avatarUrl ?? undefined}
                      seed={item.actor.name}
                      size="sm"
                    />
                  ) : (
                    <Glyph aria-hidden="true">
                      <Icon />
                    </Glyph>
                  )}
                  <Content>
                    <Line>
                      {!item.read && <Dot aria-hidden="true" />}
                      <Title>{item.title}</Title>
                      <When dateTime={item.at}>{when(item.at)}</When>
                    </Line>
                    <Text variant="footnote" tone="secondary">
                      {item.description}
                    </Text>
                    {item.action && (
                      <Action onClick={(event) => event.stopPropagation()}>
                        <Button href={item.action.href} size="sm" radius="md">
                          {item.action.label}
                        </Button>
                      </Action>
                    )}
                  </Content>
                </Item>
              );
            })}
          </List>
        )}
      </Body>
    </>
  );

  return (
    <>
      <Trigger>
        <IconButton
          ref={triggerRef}
          label={unread > 0 ? `Notificações, ${unread} sem ler` : "Notificações"}
          variant="ghost"
          size={size}
          radius={radius}
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
        >
          {muted ? <BellSlashIcon /> : <BellIcon />}
        </IconButton>
        {unread > 0 && <Count aria-hidden="true">{unread > COUNT_LIMIT ? `${COUNT_LIMIT}+` : unread}</Count>}
      </Trigger>

      {sheet ? (
        <Sheet open={open} onClose={close} label="Notificações" size="sm" surface="glass" scrim={false}>
          {content}
        </Sheet>
      ) : (
        present &&
        createPortal(
          <Popover
            ref={popoverRef}
            role="dialog"
            aria-label="Notificações"
            data-placement={position?.placement ?? "above"}
            data-state={state}
            style={position ? { top: position.top, left: position.left } : { visibility: "hidden" }}
            onAnimationEnd={onAnimationEnd}
          >
            {content}
          </Popover>,
          document.body,
        )
      )}
    </>
  );
}
