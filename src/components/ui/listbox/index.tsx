"use client";

import styled from "@emotion/styled";
import { CaretDownIcon, CaretUpIcon, CheckIcon, MagnifyingGlassIcon } from "@phosphor-icons/react";
import { useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useAnchoredPosition } from "@/hooks/use-anchored-position";
import { useLayer } from "@/hooks/use-layer";
import { useOutsideDismiss } from "@/hooks/use-outside-dismiss";
import { slugify } from "@/lib/utils/slug";
import { matchIconWeight } from "../icons";
import { disabledState, popIn } from "../styles";

export type ListboxValue = string | number;

export type ListboxOption<T extends ListboxValue> = {
  value: T;
  label: string;
  /** Segunda linha do item, apagada: a empresa do cliente, o tipo e a categoria de um item do catálogo. */
  caption?: string;
  /** A foto, a bolinha ou a arte do item, à esquerda do rótulo. */
  media?: ReactNode;
};

export type ListboxAction = {
  label: string;
  onSelect: () => void;
  tone?: "danger";
  /** Ícone da ação, antes do rótulo, com o respiro padrão da lista entre os dois. */
  icon?: ReactNode;
};

export type ListboxPlacement = "below" | "above" | "auto";

export type ListboxProps<T extends ListboxValue> = {
  label: string;
  options: ListboxOption<T>[];
  value: T;
  onChange: (value: T) => void;
  placement?: ListboxPlacement;
  /** Ícone antes do rótulo, no peso do caret, para o gatilho ler como os botões da mesma fila. */
  icon?: ReactNode;
  /** Só o ícone, num gatilho quadrado como o `IconButton`: o valor em vigor fica no nome acessível e na lista. */
  iconOnly?: boolean;
  prefix?: ReactNode;
  disabled?: boolean;
  className?: string;
  id?: string;
  fullWidth?: boolean;
  placeholder?: string;
  required?: boolean;
  invalid?: boolean;
  describedBy?: string;
  actions?: ListboxAction[];
  /** Campo de busca preso no topo do painel, para lista longa: filtra por rótulo e legenda, sem acento. */
  searchable?: boolean;
  searchPlaceholder?: string;
  /** Quantos itens a lista mostra antes de alguém buscar; o resto chega pela busca. */
  visibleLimit?: number;
  /** O que a lista diz quando a busca não acha nada. */
  emptyLabel?: string;
};

const Menu = styled.div`
  position: relative;
  display: inline-flex;

  &[data-full-width] {
    display: flex;
    width: 100%;
  }
`;

const Trigger = styled.button`
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  min-height: var(--listbox-trigger-height, 2rem);
  padding-inline: var(--listbox-trigger-padding, var(--space-3)) var(--space-2);
  font: inherit;
  font-size: var(--listbox-trigger-font-size, inherit);
  font-weight: var(--listbox-trigger-weight, var(--weight-semibold));
  letter-spacing: var(--tracking-tight);
  white-space: nowrap;
  color: var(--color-label);
  background-color: var(--listbox-trigger-background, var(--color-fill-quaternary));
  border: 1px solid var(--listbox-trigger-border, transparent);
  border-radius: var(--listbox-trigger-radius, var(--radius-sm));
  corner-shape: squircle;
  transition: background-color var(--duration-fast) var(--ease-standard);

  ${disabledState};

  /* Mostrando o item escolhido com foto e legenda (o cliente, o item do catálogo), o gatilho passa da altura
     do controle: ele ganha a mesma linha da opção, então o recuo vertical entra e a altura fica livre
     (pedido de 2026-09-09). O texto continua cedendo por reticências. */
  &[data-rich-value] {
    height: auto;
    padding-block: var(--space-1);
  }

  /* O recuo do controle é feito para texto; com a foto na frente, ele deixava um vão solto à esquerda
     (relato de 2026-09-09). A foto encosta no mesmo respiro do item da lista. Sem foto, o recuo do campo
     fica, senão o texto encostava na moldura. */
  &[data-rich-value="media"] {
    padding-inline-start: var(--space-2);
  }

  &[data-full-width] {
    flex: 1;
    justify-content: space-between;
    min-width: 0;
  }

  &[data-empty] {
    font-weight: var(--weight-regular);
    color: var(--color-placeholder);
  }

  /* Quadrado do lado da altura, como o botão de ícone: só o glifo dentro, centrado, sem recuo. */
  &[data-icon-only] {
    justify-content: center;
    width: var(--listbox-trigger-height, 2rem);
    padding: 0;
  }

  &[data-icon-only] [data-glyph] {
    margin-inline-end: 0;
  }

  &[data-invalid] {
    border-color: var(--color-danger);
  }

  /* Aberto, o gatilho fica marcado em qualquer aparelho; o hover só onde há ponteiro. */
  &[aria-expanded="true"] {
    background-color: var(--listbox-trigger-background-hover, var(--color-fill-tertiary));
  }

  @media (hover: hover) {
    &:hover:not(:disabled) {
      background-color: var(--listbox-trigger-background-hover, var(--color-fill-tertiary));
    }
  }

  @media (hover: hover) {
    &:focus-visible {
      outline: 2px solid var(--color-label);
      outline-offset: -2px;
    }
  }

  & > svg {
    flex-shrink: 0;
    width: var(--listbox-caret-size, 0.875rem);
    height: var(--listbox-caret-size, 0.875rem);
    color: var(--color-label-secondary);
    fill: currentColor;
  }
`;

/* Filho direto do gatilho é só o caret: o ícone fica dentro do próprio invólucro, com o tamanho dos
   ícones de botão e a cor do rótulo. A margem soma ao vão do gatilho e fecha nos 8px do Button. */
const Glyph = styled.span`
  display: inline-flex;
  flex-shrink: 0;
  margin-inline-end: var(--space-1);
  line-height: 0;
  color: var(--color-label);

  & svg {
    width: 1rem;
    height: 1rem;
    fill: currentColor;
  }
`;

const Prefix = styled.span`
  margin-inline-end: var(--space-1);
  font-weight: var(--weight-regular);
  color: var(--color-label-secondary);
`;

const Value = styled.span`
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
`;

/* A caixa vai para o corpo da página, e não para dentro do campo (2026-09-09): dentro de uma coluna que
   rola, uma caixa absoluta é cortada pela borda dela, e o painel aparecia truncado dependendo de onde o
   campo estava na rolagem. Portada e fixa, ela nunca é recortada; a posição vem em pixels de quem a abre. */
const List = styled.div`
  position: fixed;
  z-index: var(--z-popover);
  display: flex;
  flex-direction: column;
  /* Piso em rem, e não em porcentagem (acerto de 2026-09-09): portada para o corpo da página, a caixa media
     os 100% contra a página inteira e nascia do tamanho da tela. */
  min-width: 10rem;
  /* A lista cresce com o conteúdo, mas nunca passa disso: item com legenda comprida (a empresa do cliente)
     alargava o painel muito além do gatilho, e o que cede é o texto, por reticências. */
  width: max-content;
  max-width: min(26rem, calc(100vw - var(--space-8)));
  /* Vidro da casa, a receita das camadas do menu (pedido de 2026-09-09): fundo quase transparente com o
     borrão desenhando a caixa, o fio fino e a sombra grande. O canto é declarado direto, sem o recorte do
     motor: a lista sai do container e o fallback cortaria o anel de foco dos itens.

     A superfície é variável porque lista sobre lista existe: dentro de outra camada de vidro, como o
     calendário, o painel a 20% ficava quase invisível, e quem o abre ali passa a superfície com mais corpo
     (relato de 2026-09-09). */
  background-color: var(--listbox-panel-bg, var(--glass-layer-bg));
  border: 1px solid var(--color-border);
  border-radius: var(--listbox-trigger-radius, var(--radius-md));
  corner-shape: squircle;
  box-shadow: var(--shadow-lg);
  -webkit-backdrop-filter: var(--glass-layer-blur);
  backdrop-filter: var(--glass-layer-blur);
  animation: ${popIn} var(--duration-fast) var(--ease-standard);

  /* Dentro de um campo de formulário, o painel tem a largura do campo e nada mais (acerto de 2026-09-09):
     em max-content ele passava da moldura e lia como se tivesse quebrado o formulário. A medida chega em
     pixels de quem o abre, porque portado ele não tem mais o campo como pai para herdar largura. */
  &[data-full-width] {
    max-width: none;
  }

  &[data-placement="below"] {
    transform-origin: top left;
    --slide: calc(var(--space-1) * -1);
  }

  &[data-placement="above"] {
    transform-origin: bottom left;
    --slide: var(--space-1);
  }
`;

/* A busca presa no topo do painel, na receita do seletor de equipe: a lupa, o campo sem moldura própria e o
   fio embaixo separando da lista, que rola por baixo dela. */
const Search = styled.div`
  display: flex;
  flex-shrink: 0;
  gap: var(--space-2);
  align-items: center;
  padding: 0 var(--space-3);
  border-block-end: 1px solid var(--color-border);

  & > svg {
    flex-shrink: 0;
    width: 1rem;
    height: 1rem;
    color: var(--color-label-secondary);
  }
`;

const Field = styled.input`
  flex: 1;
  min-width: 0;
  min-height: 2.5rem;
  padding: 0;
  font-family: var(--font-body);
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

const Scroll = styled.ul`
  position: relative;
  display: grid;
  gap: var(--space-1);
  max-height: 14rem;
  margin: 0;
  /* O respiro de cima e de baixo mora aqui, e não no painel: com ele no painel, a busca tinha de descontar
     uma margem negativa, e qualquer ordem diferente de desenho deixava a lista sem respiro (2026-09-09). */
  padding: var(--space-1) 0;
  overflow-x: hidden;
  overflow-y: auto;
  list-style: none;
  outline: none;

  /* Com foto e legenda cada linha é mais alta, então a lista mostra mais de uma tela de itens. */
  &[data-rich] {
    max-height: 18rem;
  }
`;

// Respiro de 8px por item, nos quatro lados, e 8px entre o rótulo e o ícone. O recuo lateral do painel
// mora aqui, na margem do item, e não no painel: assim o divisor nasce de ponta a ponta sem margem
// negativa, que era o que abria rolagem horizontal dentro da lista. O raio é o do painel menos esse
// recuo (12 menos 4), então o encaixe é concêntrico, e o canto é superelipse declarada direto, como no
// painel: item de listbox não entra no recorte do motor de cantos, porque a lista sai do container.
const Option = styled.li`
  display: flex;
  box-sizing: border-box;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  min-height: 2.25rem;
  margin-inline: var(--space-1);
  padding: var(--space-2);
  font-size: var(--text-subheadline);
  letter-spacing: var(--tracking-tight);
  white-space: nowrap;
  border-radius: max(var(--radius-xs), calc(var(--listbox-trigger-radius, var(--radius-md)) - var(--space-1)));
  corner-shape: squircle;
  cursor: pointer;
  transition: background-color var(--duration-fast) var(--ease-standard);

  &[data-active] {
    background-color: var(--color-fill-quaternary);
  }

  &[aria-selected="true"] {
    font-weight: var(--weight-semibold);
    background-color: var(--color-fill-tertiary);
  }

  /* Ação lê corrido, ícone e rótulo juntos: o space-between é das opções, que precisam do check na
     outra ponta. */
  &[data-kind="action"] {
    justify-content: flex-start;
  }

  &[data-tone="danger"] {
    color: var(--color-danger);
  }

  /* Hover da ação que destrói acende em vermelho, e não no cinza das opções. O atributo data-active é o
     hover deste componente: o ponteiro passando por cima o move de item em item, e a seta do teclado usa
     o mesmo estado. A tinta é a fórmula do Badge, o matiz em alfa baixo, mais forte no escuro, para
     assentar sobre qualquer superfície em vez de virar bloco chapado. */
  &[data-tone="danger"][data-active] {
    background-color: light-dark(color-mix(in oklab, var(--color-danger) 14%, transparent), color-mix(in oklab, var(--color-danger) 20%, transparent));
  }

  & svg {
    width: 1rem;
    height: 1rem;
    color: var(--color-label);
    fill: currentColor;
  }

  &[data-tone="danger"],
  &[data-tone="danger"] svg {
    color: var(--color-danger);
  }
`;

/* O item ilustrado: a foto à esquerda e, ao lado, o rótulo com a legenda embaixo. A foto não encolhe e não
   herda o tamanho dos glifos da lista, porque é imagem e não ícone; quem cede é o texto, por reticências. */
const Face = styled.span`
  display: flex;
  gap: var(--space-2);
  align-items: center;
  min-width: 0;
`;

const Media = styled.span`
  display: inline-flex;
  flex-shrink: 0;
  line-height: 0;

  & svg {
    width: auto;
    height: auto;
  }
`;

/* O texto do item alinhado ao começo, e não ao centro: no gatilho, que é um `button`, o alinhamento do
   navegador é centralizado e o nome com a legenda saíam centrados (relato de 2026-09-09). */
const Copy = styled.span`
  display: grid;
  min-width: 0;
  text-align: start;
`;

const Label = styled.span`
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const Caption = styled.span`
  min-width: 0;
  overflow: hidden;
  font-size: var(--text-caption-1);
  font-weight: var(--weight-regular);
  color: var(--color-label-secondary);
  text-overflow: ellipsis;
`;

/* A linha vai de ponta a ponta: quem recua é o item, então ela não precisa de margem negativa para
   escapar do painel, e sem margem negativa não há nada mais largo que a lista para criar rolagem. A cor é
   a da borda do próprio painel, a mais discreta da paleta; a de separador é quase três vezes mais opaca e
   pesava demais num painel deste tamanho. */
const Divider = styled.li`
  height: 1px;
  margin-block: var(--space-1);
  background-color: var(--color-border);
`;

/* O aviso do pé: quantos itens ficaram de fora, ou que a busca não achou nada. Não é opção, não pega
   clique e não entra na navegação por teclado. */
const Note = styled.p`
  flex-shrink: 0;
  box-sizing: border-box;
  padding: var(--space-2) var(--space-3);
  margin: 0;
  font-size: var(--text-caption-1);
  color: var(--color-label-tertiary);
  text-wrap: pretty;
`;

const OPTION_HEIGHT = 36;
const RICH_OPTION_HEIGHT = 48;
const LIST_MAX_HEIGHT = 224;
const RICH_LIST_MAX_HEIGHT = 288;
const SEARCH_HEIGHT = 44;
const VIEWPORT_MARGIN = 16;
const GAP = 4;

/** A posição da caixa depois de medida: em pixels da janela, com o lado que sobrou. */
type Resolved = { top: number; left: number; width: number; placement: "below" | "above" };

/* A busca compara sem acento e sem caixa, pelo mesmo `slugify` das listas da casa: "jose" acha "José". */
const normalize = (text: string) => slugify(text, 200);

/* A altura que a caixa deve ocupar, estimada pela contagem: serve para o primeiro palpite de lado, antes de
   ela existir para ser medida. A altura da opção é fixa no CSS, então a conta erra pouco. */
function estimateHeight(count: number, rich: boolean, searchable: boolean) {
  const rows = count * (rich ? RICH_OPTION_HEIGHT : OPTION_HEIGHT);
  const cap = rich ? RICH_LIST_MAX_HEIGHT : LIST_MAX_HEIGHT;
  return Math.min(rows + VIEWPORT_MARGIN, cap) + (searchable ? SEARCH_HEIGHT : 0);
}

function revealOption(list: HTMLElement, option: HTMLElement) {
  const top = option.offsetTop;
  const bottom = top + option.offsetHeight;
  if (top < list.scrollTop) list.scrollTop = top;
  else if (bottom > list.scrollTop + list.clientHeight) list.scrollTop = bottom - list.clientHeight;
}

export function Listbox<T extends ListboxValue>({
  label,
  options,
  value,
  onChange,
  placement = "below",
  icon,
  iconOnly = false,
  prefix,
  disabled = false,
  className,
  id,
  fullWidth = false,
  placeholder,
  required = false,
  invalid = false,
  describedBy,
  actions = [],
  searchable = false,
  searchPlaceholder = "Buscar",
  visibleLimit,
  emptyLabel = "Nada encontrado",
}: ListboxProps<T>) {
  const [open, setOpen] = useState(false);
  const [resolved, setResolved] = useState<Resolved | null>(null);
  /** A largura do gatilho, guardada entre uma abertura e outra: é ela que a caixa veste num campo. */
  const [measured, setMeasured] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [query, setQuery] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const fieldRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const selected = options.find((option) => option.value === value);
  const rich = options.some((option) => option.media !== undefined || option.caption !== undefined);
  // O gatilho repete a linha do item escolhido quando ele tem foto ou legenda: o campo passa a mostrar o
  // cliente, e não só o nome dele.
  const richValue = selected !== undefined && (selected.media !== undefined || selected.caption !== undefined);

  // O que a lista mostra: tudo o que a busca acha; sem busca, os primeiros do limite, com o item em vigor
  // sempre entre eles, senão a escolha atual desaparecia da própria lista.
  const shown = useMemo(() => {
    const needle = normalize(query);
    if (needle) return options.filter((option) => normalize(`${option.label} ${option.caption ?? ""}`).includes(needle));
    if (!visibleLimit || options.length <= visibleLimit) return options;

    const head = options.slice(0, visibleLimit);
    const current = options.find((option) => option.value === value);
    if (!current || head.some((option) => option.value === value)) return head;
    return [current, ...head.slice(0, visibleLimit - 1)];
  }, [options, query, value, visibleLimit]);

  const hidden = query ? 0 : options.length - shown.length;
  const valueIndex = shown.findIndex((option) => option.value === value);
  const total = shown.length + actions.length;

  const close = (restoreFocus = true) => {
    setOpen(false);
    setQuery("");
    if (restoreFocus) triggerRef.current?.focus();
  };

  // A caixa entra na fila das camadas da casa: aberta de dentro de uma janela, é ela quem responde ao toque
  // fora, e a janela de baixo fica quieta em vez de fechar junto.
  useLayer(open);
  useOutsideDismiss(open, [panelRef, triggerRef], () => close(false));

  const anchor = useAnchoredPosition(open, triggerRef, {
    width: measured || 240,
    height: estimateHeight(total, rich, searchable),
    gap: GAP,
    edge: VIEWPORT_MARGIN,
  });

  // O palpite do hook escolhe o lado antes de pintar; aqui a caixa já montada é medida de verdade e
  // encaixada na janela, ainda antes do primeiro quadro, como no menu da casa.
  useLayoutEffect(() => {
    if (!open || !anchor) return;
    const box = panelRef.current;
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!box || !rect) return;

    const height = box.offsetHeight;
    const room = window.innerHeight - VIEWPORT_MARGIN;
    const below = rect.bottom + GAP;
    const above = rect.top - GAP - height;
    let top = below;
    let placement: Resolved["placement"] = "below";

    if (below + height > room) {
      if (above >= VIEWPORT_MARGIN) {
        top = above;
        placement = "above";
      } else {
        top = Math.max(VIEWPORT_MARGIN, Math.min(below, room - height));
        placement = rect.top > window.innerHeight / 2 ? "above" : "below";
      }
    }

    setResolved({ top, left: anchor.left, width: rect.width, placement });
    setMeasured(rect.width);
  }, [open, anchor]);

  const side = resolved?.placement ?? anchor?.placement ?? (placement === "above" ? "above" : "below");
  const Caret = side === "above" ? CaretUpIcon : CaretDownIcon;

  // Ação e opção dividem a mesma navegação, por isso o índice manda no lugar do valor: só assim a
  // seta chega no item de remover, que não é um valor possível do campo.
  const pick = (index: number) => {
    const option = shown[index];
    if (option) {
      onChange(option.value);
      close();
      return;
    }
    const action = actions[index - shown.length];
    if (!action) return;
    close();
    action.onSelect();
  };

  // Ao abrir, o foco vai para a busca no ponteiro fino e para a lista no resto: no toque, focar o campo
  // abriria o teclado por cima da lista, que é o que a casa evita desde o seletor de equipe.
  useLayoutEffect(() => {
    if (!open) return;
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    if (searchable && !coarse) {
      fieldRef.current?.focus({ preventScroll: true });
    } else {
      listRef.current?.focus({ preventScroll: true });
    }
    const list = listRef.current;
    const current = document.getElementById(`${listId}-${valueIndex}`);
    if (list && current) list.scrollTop = current.offsetTop;
  }, [open, searchable, valueIndex, listId]);

  useLayoutEffect(() => {
    if (!open) return;
    const list = listRef.current;
    const option = document.getElementById(`${listId}-${activeIndex}`);
    if (list && option) revealOption(list, option);
  }, [open, activeIndex, listId]);

  const onKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    const step = (delta: number) => {
      event.preventDefault();
      setActiveIndex(Math.min(total - 1, Math.max(0, activeIndex + delta)));
    };

    switch (event.key) {
      case "ArrowDown":
        return step(1);
      case "ArrowUp":
        return step(-1);
      case "Home":
        return step(-total);
      case "End":
        return step(total);
      case "Enter":
        event.preventDefault();
        return pick(activeIndex);
      case " ":
        // Digitando na busca, o espaço é espaço; sem busca, ele escolhe, como no resto da casa.
        if (searchable && event.target === fieldRef.current) return;
        event.preventDefault();
        return pick(activeIndex);
      case "Escape":
        event.preventDefault();
        event.stopPropagation();
        return close();
      case "Tab":
        return close(false);
    }
  };

  return (
    <Menu className={className} data-full-width={fullWidth || undefined}>
      <Trigger
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        data-full-width={fullWidth || undefined}
        data-empty={!selected && placeholder ? "" : undefined}
        data-icon-only={iconOnly || undefined}
        data-rich-value={richValue ? (selected?.media === undefined ? "text" : "media") : undefined}
        data-invalid={invalid || undefined}
        aria-label={iconOnly ? `${label}: ${selected?.label ?? placeholder ?? ""}` : prefix ? undefined : label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-required={required || undefined}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onClick={() => {
          setActiveIndex(Math.max(0, valueIndex));
          setOpen((state) => !state);
        }}
      >
        {icon && (
          <Glyph data-glyph aria-hidden="true">
            {matchIconWeight(icon, "bold")}
          </Glyph>
        )}
        {!iconOnly && (
          <>
            {prefix && <Prefix>{prefix}</Prefix>}
            {richValue ? (
              <Face>
                {selected.media !== undefined && <Media aria-hidden="true">{selected.media}</Media>}
                <Copy>
                  <Label>{selected.label}</Label>
                  {selected.caption && <Caption>{selected.caption}</Caption>}
                </Copy>
              </Face>
            ) : (
              <Value>{selected?.label ?? placeholder}</Value>
            )}
            <Caret weight="bold" aria-hidden="true" />
          </>
        )}
      </Trigger>
      {open &&
        createPortal(
          <List
            ref={panelRef}
            data-placement={side}
            data-full-width={fullWidth || undefined}
            style={
              resolved ? ({ top: resolved.top, left: resolved.left, ...(fullWidth && { width: resolved.width }) } as CSSProperties) : { visibility: "hidden" }
            }
          >
            {searchable && (
              <Search>
                <MagnifyingGlassIcon aria-hidden="true" />
                <Field
                  ref={fieldRef}
                  type="text"
                  role="combobox"
                  autoComplete="off"
                  spellCheck={false}
                  aria-label={`${label}: buscar`}
                  aria-expanded
                  aria-controls={listId}
                  aria-autocomplete="list"
                  aria-activedescendant={`${listId}-${activeIndex}`}
                  placeholder={searchPlaceholder}
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setActiveIndex(0);
                  }}
                  onKeyDown={onKeyDown}
                />
              </Search>
            )}
            <Scroll
              ref={listRef}
              id={listId}
              role="listbox"
              aria-label={label}
              aria-activedescendant={`${listId}-${activeIndex}`}
              data-rich={rich || undefined}
              tabIndex={-1}
              onKeyDown={onKeyDown}
            >
              {shown.map((option, index) => (
                <Option
                  key={option.value}
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={option.value === value}
                  data-active={index === activeIndex || undefined}
                  onPointerMove={() => setActiveIndex(index)}
                  onClick={() => pick(index)}
                >
                  {option.media !== undefined || option.caption !== undefined ? (
                    <Face>
                      {option.media !== undefined && <Media aria-hidden="true">{option.media}</Media>}
                      <Copy>
                        <Label>{option.label}</Label>
                        {option.caption && <Caption>{option.caption}</Caption>}
                      </Copy>
                    </Face>
                  ) : (
                    option.label
                  )}
                  {option.value === value && <CheckIcon weight="bold" aria-hidden="true" />}
                </Option>
              ))}

              {actions.length > 0 && shown.length > 0 && <Divider role="presentation" />}

              {actions.map((action, position) => {
                const index = shown.length + position;
                return (
                  <Option
                    key={action.label}
                    id={`${listId}-${index}`}
                    role="option"
                    aria-selected={false}
                    data-active={index === activeIndex || undefined}
                    data-tone={action.tone}
                    onPointerMove={() => setActiveIndex(index)}
                    data-kind="action"
                    onClick={() => pick(index)}
                  >
                    {action.icon}
                    {action.label}
                  </Option>
                );
              })}
            </Scroll>
            {shown.length === 0 && <Note role="status">{emptyLabel}</Note>}
            {hidden > 0 && <Note>Digite para buscar entre {options.length} opções.</Note>}
          </List>,
          document.body,
        )}
    </Menu>
  );
}
