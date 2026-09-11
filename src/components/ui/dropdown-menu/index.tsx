"use client";

import { css } from "@emotion/react";
import styled from "@emotion/styled";
import { CaretRightIcon, CaretUpDownIcon, CheckIcon, MagnifyingGlassIcon, type Icon } from "@phosphor-icons/react";
import type { Route } from "next";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { planBadges, type PlanId } from "@/features/billing/plans";
import { useLayer } from "@/hooks/use-layer";
import { MOBILE_QUERY, useMediaQuery } from "@/hooks/use-media-query";
import { useAnchoredPosition } from "@/hooks/use-anchored-position";
import { useOutsideDismiss } from "@/hooks/use-outside-dismiss";
import { usePresence } from "@/hooks/use-presence";
import { slugify } from "@/lib/utils/slug";
import { Badge } from "../badge";
import type { ButtonProps } from "../button";
import { Dialog } from "../dialog";
import { IconButton } from "../icon-button";
import { Spinner } from "../spinner";
import { disabledState, focusRing, hoverMotion, layerMotion } from "../styles";
import { Switch } from "../switch";
import { Text } from "../text";

export type DropdownAction = {
  kind?: "action";
  id: string;
  label: string;
  icon?: Icon;
  /**
   * O desenho do item no lugar do glifo: o rosto de uma pessoa, a bolinha da cor de uma etiqueta
   * (2026-09-10). Glifo diz o que a opção faz; `media` diz **qual** opção ela é, e para escolher gente ou
   * cor o segundo é o que resolve.
   */
  media?: ReactNode;
  /** Rota da casa, ou endereço externo começando com `http`, que abre em outra aba. */
  href?: Route | `http${string}`;
  /** Tem mais opções dentro: mostra a seta no fim da linha. */
  submenu?: boolean;
  /** Plano que libera a opção: mostra o selo do plano no fim da linha, o mesmo chip da Assinatura no menu da conta. */
  plan?: PlanId;
  /** Contagem no fim da linha, como quantos itens o histórico tem. */
  count?: number;
  tone?: "default" | "danger";
  /** Item marcado numa escolha única, como o período em vigor: vira `menuitemradio` com o check no fim. */
  selected?: boolean;
  /** Escolher não fecha o menu: para filtro, em que a pessoa ajusta várias coisas antes de sair. */
  keepOpen?: boolean;
  onSelect?: () => void;
};

export type DropdownToggle = {
  kind: "toggle";
  id: string;
  label: string;
  icon?: Icon;
  /** O mesmo de `DropdownAction`: rosto, bolinha de cor, o que identifique a opção. */
  media?: ReactNode;
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
  /** Como o gatilho se veste, no contrato do `Button`: fantasma por padrão, como o chevron das listas; a
   *  barra de busca o veste como o campo ao lado. */
  trigger?: DropdownTrigger;
  /**
   * O conteúdo do gatilho, quando quem chama já tem o desenho dele: no lugar do botão de ícone entra um
   * botão sem caixa com isto dentro, e o clique abre o menu. É o que deixa um valor da ficha (uma etiqueta,
   * um rosto com o nome, texto solto) continuar parecendo o que é e ainda dar as opções.
   */
  triggerContent?: ReactNode;
};

export type DropdownTrigger = Pick<ButtonProps, "variant" | "radius" | "background" | "foreground" | "border">;

/** Passando disto, o menu ganha busca: é onde a lista deixa de ser lida de relance e passa a ser procurada. */
const SEARCH_FROM = 5;

const PANEL_WIDTH = 280;
const ROW_HEIGHT = 40;
const EDGE = 16;
const GAP = 8;
/* O teto do painel no computador (2026-09-10, a pedido): uma lista de vinte pessoas virava uma tira do
   tamanho da tela. Acima disto a lista rola por dentro. */
const PANEL_HEIGHT = 340;

type Resolved = { top: number; left: number; placement: "below" | "above" };

/* Canto declarado direto, sem `data-squircle`: a caixa guarda anel de foco de link e botão, e o recorte
   do fallback cortaria os dois. Mesma receita das camadas do menu. */
const Popover = styled.div`
  --panel-line: 0.0375rem;
  --genie-y: calc(var(--space-2) * -1);

  position: fixed;
  z-index: var(--z-popover);
  display: flex;
  flex-direction: column;
  width: min(${PANEL_WIDTH}px, calc(100vw - ${EDGE * 2}px));
  max-height: min(${PANEL_HEIGHT}px, calc(100dvh - ${EDGE * 2}px));
  overflow: hidden;
  background-color: var(--glass-layer-bg);
  border: var(--panel-line) solid var(--color-border);
  border-radius: var(--radius-2xl);
  corner-shape: squircle;
  box-shadow: var(--shadow-lg);
  -webkit-backdrop-filter: var(--glass-layer-blur);
  backdrop-filter: var(--glass-layer-blur);
  transform-origin: top left;

  ${layerMotion};

  /* Só a lista rola, e a busca fica parada no topo: com o painel inteiro rolando, o campo de busca saía
     de vista no primeiro giro da roda. */
  & > [data-scroll] {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  /* Abrindo para cima o gênio nasce de baixo; a posição em si já vem resolvida em pixels. */
  &[data-placement="above"] {
    --genie-y: var(--space-2);
    transform-origin: bottom left;
  }
`;

/* Na bandeja do celular a lista fica dentro do Dialog e rola por conta própria: o painel dele esconde o
   que transborda e espera que o conteúdo role, senão a lista era cortada no fim.

   As seções ficam listadas como no desktop, separadas pelo fio, só que com mais ar entre uma e outra e o
   título em peso maior e na tinta cheia, para dar para discriminar cada grupo numa lista que rola (relato
   de 2026-09-08; um bloco com fundo por seção durou uma rodada e saiu a pedido). O item marcado ganha
   fundo aqui, porque no dedo não há hover para acompanhar o check. */
const Sheet = styled.div`
  --panel-line: 0.0375rem;
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: var(--space-2) var(--space-2) var(--space-4);
  overflow-y: auto;
  overscroll-behavior: contain;

  /* Aberta por cima de uma janela com ações na barra flutuante, a lista leva a folga da barra embaixo,
     dentro do que rola: o último item fecha acima dela, em vez de ficar atrás sem dar para tocar. */
  html[data-floating-actions] & {
    padding-block-end: var(--floating-bar-inset);
  }

  & > [data-section] {
    padding-block: var(--space-3);
  }

  /* O título recua o mesmo que as linhas, senão ele nasce deslocado do glifo delas. */
  & [data-section-label] {
    padding: var(--space-2) var(--space-2) var(--space-1);
    font-size: var(--text-footnote);
    font-weight: var(--weight-semibold);
    color: var(--color-label);
  }

  & [data-selected] {
    background-color: var(--color-fill-secondary);
  }
`;

const Section = styled.div`
  display: grid;
  gap: var(--space-half);
  padding: var(--space-2);

  & + & {
    border-block-start: var(--panel-line) solid var(--color-border);
  }
`;

/* A busca presa no topo do menu, na mesma receita do painel do `Listbox`: a lupa, o campo cru e o fio
   embaixo separando da lista. Só aparece em menu longo. */
const Search = styled.div`
  display: flex;
  flex-shrink: 0;
  gap: var(--space-2);
  align-items: center;
  padding: 0 var(--space-3);
  border-block-end: var(--panel-line) solid var(--color-border);

  & > svg {
    flex-shrink: 0;
    width: 1rem;
    height: 1rem;
    color: var(--color-label-secondary);
  }
`;

const SearchField = styled.input`
  flex: 1;
  min-width: 0;
  min-height: 2.5rem;
  padding: 0;
  font-family: var(--font-body);
  /* Piso de 16px, senão o iPhone dá zoom ao focar. */
  font-size: max(16px, var(--text-footnote));
  letter-spacing: var(--tracking-tight);
  color: var(--color-label);
  background-color: transparent;
  border: 0;
  outline: none;

  &::placeholder {
    color: var(--color-placeholder);
  }
`;

/* Nada bateu com a busca: a frase ocupa o lugar da lista, para o menu não ficar uma caixa vazia. */
const Note = styled.p`
  padding: var(--space-3) var(--space-4) var(--space-4);
  margin: 0;
  font-family: var(--font-body);
  font-size: var(--text-footnote);
  color: var(--color-label-tertiary);
  text-align: center;
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

  @media (hover: hover) {
    &:hover,
    &:focus-visible {
      color: var(--color-label);
      background-color: var(--color-fill-quaternary);
    }
  }

  @media (hover: hover) {
    &:focus-visible {
      outline: none;
    }
  }

  &[data-selected] {
    color: var(--color-label);
  }

  &[data-tone="danger"] {
    color: var(--color-danger);
  }

  @media (hover: hover) {
    &[data-tone="danger"]:hover,
    &[data-tone="danger"]:focus-visible {
      color: var(--color-danger);
      background-color: color-mix(in oklab, var(--color-danger) 10%, transparent);
    }
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

  /* O check do item marcado vai na cor do texto, e não apagado como a seta. */
  & > svg[data-selected] {
    color: var(--color-label);
  }
`;

const Trigger = styled.span`
  display: inline-flex;
  flex-shrink: 0;
`;

/**
 * O gatilho sem enfeite, para quem traz o próprio conteúdo (2026-09-10, das informações da tarefa): o valor
 * continua desenhado como era, uma etiqueta, um rosto com o nome ou texto solto, e o clique nele é que abre o
 * menu. Sem isto, dar opções a um campo obrigava a trocar o desenho dele por um seletor, e a ficha deixava de
 * parecer uma ficha.
 *
 * É `inline-flex`, e **não** `display: contents` (acerto do mesmo dia, do relato de que o menu abria fora da
 * tela): sem caixa o botão não mede nada, `getBoundingClientRect` devolve tudo zero, e a camada, que se
 * posiciona a partir da medida do gatilho, nascia na quina de cima da janela. Sem fundo, sem fio e sem recuo
 * ele continua invisível, e agora tem medida.
 */
const BareTrigger = styled.button`
  display: inline-flex;
  align-items: center;
  min-width: 0;
  max-width: 100%;
  padding: 0;
  font: inherit;
  color: inherit;
  text-align: start;
  cursor: pointer;
  background: none;
  border: 0;

  ${disabledState};
  ${focusRing};
`;

/* O giro no fim da linha enquanto o link ainda leva para a página, e o aviso de que chegou: a linha de
   rota não fecha o menu ao clicar, porque fechar antes deixava a pessoa sem saber se o clique pegou. */
function LinkPending({ onDone }: { onDone: () => void }) {
  const { pending } = useLinkStatus();
  const [seen, setSeen] = useState(false);
  if (pending && !seen) setSeen(true);
  if (!pending && seen) {
    setSeen(false);
    onDone();
  }
  return pending ? (
    <Trailing>
      <Spinner size="sm" label="" />
    </Trailing>
  ) : null;
}

const MENU_ITEMS = '[role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"]';

function heightOf(sections: DropdownSection[]) {
  const rows = sections.reduce((total, section) => total + section.items.length + (section.label ? 0.6 : 0), 0);
  /* Limitado pelo teto do painel, senão uma lista longa dizia ao posicionamento que precisava de mil pixels
     e ele abria para cima sem necessidade. */
  return Math.min(rows * ROW_HEIGHT + sections.length * 16, PANEL_HEIGHT);
}

function isExternal(href: string) {
  return href.startsWith("http");
}

// Um menu de opções colado no próprio gatilho, no padrão das camadas do menu lateral: vidro, o fio da
// casa e a mesma linha do nav. Seções separadas por fio e com título opcional; itens de ação (botão,
// rota ou endereço externo), com seta de mais opções, selo do plano que libera e contagem no fim da
// linha, e itens de interruptor. No celular vira a bandeja do Dialog, sem escurecimento. Setas, Home e
// End andam pelos itens, Escape fecha e devolve o foco ao gatilho.
export function DropdownMenu({ label, triggerLabel, sections, icon, size = "sm", trigger, triggerContent }: DropdownMenuProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const mobile = useMediaQuery(MOBILE_QUERY);
  // Trocar de página fecha o menu, ajustado durante o render: é a garantia para a linha de rota, que não
  // fecha ao clicar e espera a navegação terminar.
  const pathname = usePathname();
  const [seenPath, setSeenPath] = useState(pathname);
  if (seenPath !== pathname) {
    setSeenPath(pathname);
    setOpen(false);
  }
  const { present, state, onAnimationEnd } = usePresence(open && !mobile);
  const position = useAnchoredPosition(open && !mobile, triggerRef, { width: PANEL_WIDTH, height: heightOf(sections), edge: EDGE, gap: GAP });
  const [resolved, setResolved] = useState<Resolved | null>(null);

  // A caixa colada no gatilho entra na mesma fila das janelas: aberta de dentro de uma, é ela quem
  // responde ao Escape e ao toque fora, e a janela de baixo fica quieta em vez de fechar junto. No
  // celular quem registra é o `Dialog` da bandeja.
  useLayer(open && !mobile);

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

  /* Fechado, a busca esquece o que foi digitado: reabrir com o filtro de antes escondia opções sem a pessoa
     ter pedido. Ajustado durante o render, e não em efeito, que é como o React pede para reagir a uma
     mudança de estado e o que o lint da casa aceita. */
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (!open && query) setQuery("");
  }

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
          {item.media ?? (item.icon && <item.icon aria-hidden="true" />)}
          <Label>{item.label}</Label>
          <Switch size="sm" checked={item.checked} onChange={(event) => item.onChange(event.target.checked)} tabIndex={-1} />
        </ToggleRow>
      );
    }

    const trailing = (item.count !== undefined || item.plan || item.submenu || item.selected !== undefined) && (
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
        {item.selected && <CheckIcon aria-hidden="true" weight="bold" data-selected />}
      </Trailing>
    );

    const role = item.selected === undefined ? "menuitem" : "menuitemradio";
    const checked = item.selected === undefined ? undefined : item.selected;

    const content = (
      <>
        {item.media ?? (item.icon && <item.icon aria-hidden="true" />)}
        <Label>{item.label}</Label>
        {trailing}
      </>
    );

    const select = () => {
      item.onSelect?.();
      if (!item.keepOpen) setOpen(false);
    };

    if (item.href && isExternal(item.href)) {
      return (
        <ActionAnchor key={item.id} role={role} aria-checked={checked} href={item.href} target="_blank" rel="noreferrer" data-tone={item.tone} onClick={select} tabIndex={-1}>
          {content}
        </ActionAnchor>
      );
    }

    if (item.href) {
      return (
        <ActionLink key={item.id} role={role} aria-checked={checked} href={item.href as Route} data-tone={item.tone} onClick={item.onSelect} tabIndex={-1}>
          {content}
          <LinkPending onDone={() => setOpen(false)} />
        </ActionLink>
      );
    }

    return (
      <ActionButton key={item.id} type="button" role={role} aria-checked={checked} data-tone={item.tone} data-selected={item.selected || undefined} onClick={select} tabIndex={-1}>
        {content}
      </ActionButton>
    );
  };

  /**
   * Menu comprido ganha busca (2026-09-10, a pedido): passando de cinco opções, um campo preso no topo
   * filtra pelo nome. Cinco é o ponto em que a lista deixa de ser lida de relance e passa a ser procurada;
   * abaixo disso o campo só tiraria espaço e uma linha de rolagem não custa nada.
   *
   * A busca compara pelo mesmo formato dos dois lados, então acento e maiúscula não atrapalham. Seção que
   * fica sem item sai, para não sobrar título solto.
   */
  const listed = sections.reduce((sum, section) => sum + section.items.length, 0);
  const searchable = listed > SEARCH_FROM;
  const needle = slugify(query, 80);
  const shown =
    searchable && needle
      ? sections
          .map((section) => ({ ...section, items: section.items.filter((item) => slugify(item.label, 80).includes(needle)) }))
          .filter((section) => section.items.length > 0)
      : sections;

  const field = searchable && (
    <Search>
      <MagnifyingGlassIcon aria-hidden="true" />
      <SearchField
        type="text"
        autoComplete="off"
        spellCheck={false}
        value={query}
        placeholder="Buscar"
        aria-label={`${label}: buscar`}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => event.stopPropagation()}
      />
    </Search>
  );

  const list = (
    <>
      {field}
      <div data-scroll>
        {shown.length === 0 ? (
          <Note role="status">Nada bateu com o que você procurou.</Note>
        ) : (
          shown.map((section) => (
            <Section key={section.id} role="group" aria-label={section.label} data-section>
              {section.label && (
                <SectionLabel as="p" variant="caption1" tone="secondary" data-section-label>
                  {section.label}
                </SectionLabel>
              )}
              {section.items.map(renderItem)}
            </Section>
          ))
        )}
      </div>
    </>
  );

  return (
    <Trigger>
      {/* O gatilho é o botão de ícone da casa, ou um botão sem caixa com o conteúdo de quem chama. */}
      {triggerContent ? (
        <BareTrigger
          ref={triggerRef}
          type="button"
          aria-label={triggerLabel}
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
        >
          {triggerContent}
        </BareTrigger>
      ) : (
        <IconButton
          ref={triggerRef}
          label={triggerLabel}
          variant="ghost"
          {...trigger}
          size={size}
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
        >
          {icon ?? <CaretUpDownIcon />}
        </IconButton>
      )}

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
