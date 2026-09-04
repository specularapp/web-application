"use client";

import styled from "@emotion/styled";
import { ClockCounterClockwiseIcon, MagnifyingGlassIcon } from "@phosphor-icons/react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import {
  Fragment,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";
import { Text } from "@/components/ui/text";
import { slugify } from "@/features/organizations/schemas";
import { squircle } from "@/lib/corners";
import { MOBILE_QUERY, useMediaQuery } from "@/hooks/use-media-query";
import {
  RECENT_COOKIE,
  RECENT_LIMIT,
  readRecentRoutes,
  recentRoutesCookie,
  rememberRoute,
} from "@/lib/recent-routes";
import { navHighlights, navLinks, type NavResult } from "../nav";

export type CommandPaletteProps = { onClose: () => void };

const SUGGESTION_LIMIT = 5;

const Search = styled.div`
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: var(--space-2);
  padding-inline: var(--space-4);
  border-block-end: var(--panel-line) solid var(--color-border);

  & > svg {
    flex-shrink: 0;
    width: 1.125rem;
    height: 1.125rem;
    color: var(--color-label-secondary);
  }
`;

/* Fonte de 16px por baixo, senão o Safari dá zoom ao focar o campo e a janela sai do lugar. */
const Field = styled.input`
  flex: 1;
  min-width: 0;
  min-height: 3.25rem;
  padding: 0;
  font-family: var(--font-body);
  font-size: max(16px, var(--text-callout));
  letter-spacing: var(--tracking-tight);
  color: var(--color-label);
  background-color: transparent;
  border: 0;
  outline: none;

  &::placeholder {
    color: var(--color-placeholder);
  }
`;

/* As pílulas rolam na horizontal em vez de quebrar linha: numa tela estreita seis atalhos em duas
   linhas empurravam a lista para fora da vista. O conteúdo some por máscara, e não por uma faixa de
   cor por cima, porque o painel é de vidro e um gradiente sólido viraria mancha em vez de sumiço. A
   faixa do fade tem o tamanho do próprio recuo, então ela cai sobre o vão e não sobre o texto quando
   não há o que rolar. */
const Pills = styled.div`
  display: flex;
  flex-shrink: 0;
  gap: var(--space-2);
  padding: var(--space-3);
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

/* Mesma receita de cor do Badge: a tinta é o matiz a 70% sobre o rótulo e o fundo é o matiz em alfa
   baixo, mais forte no escuro. O contraste dessa fórmula já foi conferido nas 19 cores da paleta, e
   o ícone herda a tinta em vez de puxar para o cinza. */
const Pill = styled.button`
  --pill-ink: color-mix(in oklab, var(--pill-hue) 70%, var(--color-label));
  --pill-tint: light-dark(
    color-mix(in oklab, var(--pill-hue) 14%, transparent),
    color-mix(in oklab, var(--pill-hue) 18%, transparent)
  );

  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  gap: var(--space-2);
  min-height: 2rem;
  padding-inline: var(--space-3);
  font-family: var(--font-body);
  font-size: var(--text-footnote);
  font-weight: var(--weight-medium);
  letter-spacing: var(--tracking-tight);
  white-space: nowrap;
  color: var(--pill-ink);
  background-color: var(--pill-tint);
  border: 0;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: background-color var(--duration-fast) var(--ease-standard);

  &:hover {
    background-color: light-dark(
      color-mix(in oklab, var(--pill-hue) 22%, transparent),
      color-mix(in oklab, var(--pill-hue) 28%, transparent)
    );
  }

  &:focus-visible {
    outline: 2px solid var(--color-focus);
    outline-offset: 2px;
  }

  & svg {
    width: 1rem;
    height: 1rem;
    color: inherit;
    fill: currentColor;
  }

  @media (pointer: coarse) {
    min-height: 2.25rem;
  }
`;

const Body = styled.div`
  display: grid;
  align-content: start;
  gap: var(--space-1);
  min-height: 12rem;
  max-height: 20rem;
  min-width: 0;
  padding-block: var(--space-2);
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-mask-image: linear-gradient(
    to bottom,
    transparent,
    #000 var(--space-2),
    #000 calc(100% - var(--space-6)),
    transparent
  );
  mask-image: linear-gradient(
    to bottom,
    transparent,
    #000 var(--space-2),
    #000 calc(100% - var(--space-6)),
    transparent
  );

  &[data-empty] {
    align-content: center;
  }
`;

/* O rótulo do grupo é item da mesma lista, marcado como apresentação: assim o listbox continua sendo
   um só, e não um por seção, que duplicaria o id que o campo aponta em `aria-controls`. */
const GroupLabel = styled.li`
  margin: 0;
  padding: var(--space-2) var(--space-2) var(--space-1);
  font-family: var(--font-body);
  font-size: var(--text-caption-1);
  letter-spacing: var(--tracking-tight);
  color: var(--color-label-secondary);
`;

const GroupDivider = styled.li`
  height: var(--panel-line);
  margin-block: var(--space-1);
  margin-inline: calc(var(--space-1) * -1);
  background-color: var(--color-border);
`;

const List = styled.ul`
  display: grid;
  gap: var(--space-1);
  margin: 0;
  padding-inline: var(--space-1);
  list-style: none;
`;

/* Linha de lista, e não botão: o foco fica no campo o tempo todo, a seta move o item ativo e o leitor
   de tela acompanha por `aria-activedescendant`. */
const Option = styled.li`
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-height: 2.25rem;
  padding-block: var(--space-1);
  padding-inline: var(--space-2);
  font-size: var(--text-subheadline);
  letter-spacing: var(--tracking-tight);
  color: var(--color-label);
  border-radius: var(--radius-md);
  corner-shape: squircle;
  cursor: pointer;
  transition: background-color var(--duration-fast) var(--ease-standard);

  &[data-active] {
    background-color: var(--color-fill-quaternary);
  }

  & > svg {
    flex-shrink: 0;
    width: 1.125rem;
    height: 1.125rem;
    color: var(--color-label-secondary);
  }

  @media (pointer: coarse) {
    min-height: var(--touch-target);
  }
`;

const OptionLabel = styled.span`
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const Empty = styled.div`
  display: grid;
  gap: var(--space-2);
  place-items: center;
  padding: var(--space-6);
  text-align: center;
`;

/* A régua de teclas some junto com as teclas no celular: sem elas sobraria "navegar" e "abrir" soltos,
   e nenhum dos dois se faz por lá. */
const Footer = styled.div`
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-2) var(--space-4);
  border-block-start: var(--panel-line) solid var(--color-border);

  @media (max-width: 47.9375rem) {
    display: none;
  }
`;

const Hint = styled.span`
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  font-family: var(--font-body);
  font-size: var(--text-caption-1);
  letter-spacing: var(--tracking-tight);
  color: var(--color-label-tertiary);
`;

/* Fio da casa, o mesmo do menu, descendo por cascata para busca, pílulas e rodapé. */
const Palette = styled(Dialog)`
  --panel-line: 0.0375rem;
`;

type Section = { title: string; items: NavResult[] };

function matches(item: NavResult, query: string) {
  const needle = slugify(query, 80);
  return slugify(item.label, 80).includes(needle) || slugify(item.section, 80).includes(needle);
}

function readCookie(name: string) {
  const entry = document.cookie.split("; ").find((item) => item.startsWith(`${name}=`));
  return entry ? decodeURIComponent(entry.slice(name.length + 1)) : undefined;
}

// Busca do produto: campo em cima, atalhos em pílula, o que foi aberto por último e sugestões. As
// opções saem de `nav.ts`, que já é a fonte única do menu e tem `href` tipado por rota, então a
// paleta nunca oferece uma página que não existe.
export function CommandPalette({ onClose }: CommandPaletteProps) {
  const router = useRouter();
  const sheet = useMediaQuery(MOBILE_QUERY);
  const listId = useId();
  const fieldRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [recent, setRecent] = useState<string[]>(() => readRecentRoutes(readCookie(RECENT_COOKIE)));

  const pages = useMemo(() => navLinks(), []);

  // No celular o campo não recebe foco sozinho: o teclado subiria antes de a lista aparecer.
  useEffect(() => {
    if (sheet) return;
    const frame = window.requestAnimationFrame(() => fieldRef.current?.focus({ preventScroll: true }));
    return () => window.cancelAnimationFrame(frame);
  }, [sheet]);

  const sections = useMemo<Section[]>(() => {
    if (query.trim()) {
      return [{ title: "Resultados", items: pages.filter((page) => matches(page, query)) }];
    }

    const visited = recent
      .map((path) => pages.find((page) => page.href === path))
      .filter((page): page is NavResult => Boolean(page));

    const suggestions = pages
      .filter((page) => !visited.some((item) => item.href === page.href))
      .slice(0, SUGGESTION_LIMIT);

    const list: Section[] = [];
    if (visited.length > 0) list.push({ title: "Recentes", items: visited.slice(0, RECENT_LIMIT) });
    list.push({ title: "Sugestões", items: suggestions });
    return list;
  }, [pages, query, recent]);

  const flat = useMemo(() => sections.flatMap((section) => section.items), [sections]);

  useEffect(() => {
    bodyRef.current?.querySelector<HTMLElement>("[data-active]")?.scrollIntoView({ block: "nearest" });
  }, [active, query]);

  const go = (href: Route) => {
    const next = rememberRoute(recent, href);
    document.cookie = recentRoutesCookie(next);
    setRecent(next);
    onClose();
    router.push(href);
  };

  const navigate = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (flat.length === 0) return;
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((current) => (current + step + flat.length) % flat.length);
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      const page = flat[active];
      if (page) go(page.href);
    }
  };

  return (
    <Palette open onClose={onClose} label="Buscar" size="md" surface="glass" scrim={false} focusOnOpen={false}>
      <Search>
        <MagnifyingGlassIcon aria-hidden="true" />
        <Field
          ref={fieldRef}
          type="text"
          role="combobox"
          autoComplete="off"
          aria-label="Buscar no Specular"
          aria-expanded={flat.length > 0}
          aria-controls={flat.length > 0 ? listId : undefined}
          aria-autocomplete="list"
          aria-activedescendant={flat[active] ? `${listId}-${flat[active].href}` : undefined}
          placeholder="Buscar página, cliente ou projeto"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
          }}
          onKeyDown={navigate}
        />
        <Kbd aria-hidden="true">Esc</Kbd>
      </Search>

      <Pills>
        {navHighlights.map((item) => (
          <Pill
            key={item.href}
            type="button"
            style={{ "--pill-hue": item.hue } as CSSProperties}
            onClick={() => go(item.href)}
            {...squircle("md")}
          >
            <item.icon aria-hidden="true" />
            {item.label}
          </Pill>
        ))}
      </Pills>

      <Body ref={bodyRef} data-empty={flat.length === 0 || undefined}>
        {flat.length === 0 ? (
          <Empty>
            <Text variant="footnote" tone="secondary">
              Nada encontrado para o que você digitou.
            </Text>
          </Empty>
        ) : (
          <List id={listId} role="listbox" aria-label="Resultados da busca">
            {sections
              .filter((section) => section.items.length > 0)
              .map((section, position) => (
                <Fragment key={section.title}>
                  {position > 0 && <GroupDivider role="presentation" />}
                  <GroupLabel role="presentation">{section.title}</GroupLabel>
                  {section.items.map((page) => {
                    const index = flat.findIndex((item) => item.href === page.href);
                    return (
                      <Option
                        key={page.href}
                        id={`${listId}-${page.href}`}
                        role="option"
                        aria-selected={index === active}
                        data-active={index === active || undefined}
                        onPointerMove={() => setActive(index)}
                        onClick={() => go(page.href)}
                      >
                        {section.title === "Recentes" ? (
                          <ClockCounterClockwiseIcon aria-hidden="true" />
                        ) : (
                          <page.icon aria-hidden="true" />
                        )}
                        <OptionLabel>{page.label}</OptionLabel>
                        <Badge variant="soft" size="sm" hue={page.hue}>
                          {page.section}
                        </Badge>
                      </Option>
                    );
                  })}
                </Fragment>
              ))}
          </List>
        )}
      </Body>

      <Footer>
        <Hint>
          <Kbd>Esc</Kbd>
          fechar
        </Hint>
        <Hint>
          <Kbd>↑</Kbd>
          <Kbd>↓</Kbd>
          navegar
        </Hint>
        <Hint>
          <Kbd>Enter</Kbd>
          abrir
        </Hint>
      </Footer>
    </Palette>
  );
}
