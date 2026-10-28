"use client";

import styled from "@emotion/styled";
import {
  AddressBookIcon,
  ArrowRightIcon,
  BriefcaseIcon,
  BuildingsIcon,
  CheckSquareOffsetIcon,
  ClipboardTextIcon,
  ClockCounterClockwiseIcon,
  CreditCardIcon,
  FileTextIcon,
  FlowArrowIcon,
  FunnelIcon,
  ListChecksIcon,
  MagnifyingGlassIcon,
  PlusCircleIcon,
  ReceiptIcon,
  StorefrontIcon,
  UsersThreeIcon,
  WalletIcon,
  XCircleIcon,
  type Icon,
} from "@phosphor-icons/react";
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
  type ReactNode,
} from "react";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { hoverMotion } from "@/components/ui/styles";
import { Dialog } from "@/components/ui/dialog";
import { IconButton } from "@/components/ui/icon-button";
import { Kbd } from "@/components/ui/kbd";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { searchAction, type SearchResult } from "@/features/search/actions";
import { searchable, type SearchGroupKey } from "@/features/search/summary";
import { slugify } from "@/lib/utils/slug";
import { callAction } from "@/lib/action";
import { rounded } from "@/lib/corners";
import { MOBILE_QUERY, useMediaQuery } from "@/hooks/use-media-query";
import { readCookie } from "@/lib/cookies";
import {
  RECENT_COOKIE,
  RECENT_LIMIT,
  readRecentRoutes,
  recentRoutesCookie,
  rememberRoute,
} from "@/lib/recent-routes";
import { tasksRoleAllows } from "@/features/organizations/tasks-role";
import { navHighlights, navLinks, type NavResult } from "../nav";
import { createCommands } from "./commands";

/** `restricted` é o cargo só de tarefas: a busca oferece só as páginas e os atalhos que ele pode abrir (2026-10-28). */
export type CommandPaletteProps = { open: boolean; onClose: () => void; restricted?: boolean };

const SUGGESTION_LIMIT = 5;
/** Quantas páginas aparecem antes dos registros: os grupos do banco já chegam com até cinco cada. */
const PAGES_SHOWN = 5;
/** A pausa depois da última tecla antes de perguntar ao banco. */
const DEBOUNCE_MS = 220;

/** O glifo e o matiz do azulejo de cada tipo de registro, perto dos que o domínio tem no menu. */
const groupLooks: Record<SearchGroupKey, { icon: Icon; hue: string }> = {
  clients: { icon: AddressBookIcon, hue: "var(--sys-teal)" },
  suppliers: { icon: BuildingsIcon, hue: "var(--sys-brown)" },
  opportunities: { icon: FunnelIcon, hue: "var(--sys-cyan)" },
  quotes: { icon: ReceiptIcon, hue: "var(--sys-orange)" },
  contracts: { icon: FileTextIcon, hue: "var(--sys-purple)" },
  charges: { icon: CreditCardIcon, hue: "var(--sys-green)" },
  expenses: { icon: WalletIcon, hue: "var(--sys-red)" },
  projects: { icon: BriefcaseIcon, hue: "var(--sys-indigo)" },
  tasks: { icon: ListChecksIcon, hue: "var(--sys-cyan)" },
  catalog: { icon: StorefrontIcon, hue: "var(--sys-blue)" },
  forms: { icon: ClipboardTextIcon, hue: "var(--sys-indigo)" },
  approvals: { icon: CheckSquareOffsetIcon, hue: "var(--sys-purple)" },
  automations: { icon: FlowArrowIcon, hue: "var(--sys-yellow)" },
  team: { icon: UsersThreeIcon, hue: "var(--sys-mint)" },
};

const Search = styled.div`
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: var(--space-2);
  padding-inline: var(--space-4) var(--space-3);
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

  &::-webkit-search-cancel-button {
    display: none;
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
  padding: var(--space-3) var(--space-4);
  overflow-x: auto;
  overscroll-behavior-x: contain;
  border-block-end: var(--panel-line) solid var(--color-border);
  -webkit-mask-image: linear-gradient(
    to right,
    transparent,
    #000 var(--space-4),
    #000 calc(100% - var(--space-4)),
    transparent
  );
  mask-image: linear-gradient(
    to right,
    transparent,
    #000 var(--space-4),
    #000 calc(100% - var(--space-4)),
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

  ${hoverMotion};

  @media (hover: hover) {
    &:hover {
      background-color: light-dark(
        color-mix(in oklab, var(--pill-hue) 22%, transparent),
        color-mix(in oklab, var(--pill-hue) 28%, transparent)
      );
    }
  }

  @media (hover: hover) {
    &:focus-visible {
      outline: 2px solid var(--color-focus);
      outline-offset: 2px;
    }
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

/* A altura acompanha a tela: com o teclado aberto na bandeja, um teto fixo empurrava o campo para fora. */
const Body = styled.div`
  display: grid;
  align-content: start;
  gap: var(--space-1);
  min-height: 12rem;
  max-height: min(26rem, 55dvh);
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

  /* No celular o botão do menu da barra flutuante fica por cima da bandeja: a folga mora dentro do que
     rola, abaixo do último resultado, para nenhum deles ficar preso atrás dele. */
  @media (max-width: 47.9375rem) {
    padding-block-end: var(--floating-bar-inset);
  }
`;

/* O rótulo do grupo é item da mesma lista, marcado como apresentação: assim o listbox continua sendo
   um só, e não um por seção, que duplicaria o id que o campo aponta em `aria-controls`. */
const GroupLabel = styled.li`
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
  margin: 0;
  padding: var(--space-2) var(--space-2) var(--space-1);
  font-family: var(--font-body);
  font-size: var(--text-caption-1);
  letter-spacing: var(--tracking-tight);
  color: var(--color-label-secondary);
`;

const GroupCount = styled.span`
  font-variant-numeric: tabular-nums;
  color: var(--color-label-tertiary);
`;

const GroupDivider = styled.li`
  height: var(--panel-line);
  margin-block: var(--space-1);
  margin-inline: calc(var(--space-2) * -1);
  background-color: var(--color-border);
`;

const List = styled.ul`
  display: grid;
  gap: var(--space-1);
  margin: 0;
  padding-inline: var(--space-2);
  list-style: none;
`;

/* Linha de lista, e não botão: o foco fica no campo o tempo todo, a seta move o item ativo e o leitor
   de tela acompanha por `aria-activedescendant`. */
const Option = styled.li`
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-height: 2.5rem;
  padding-block: var(--space-1);
  padding-inline: var(--space-2);
  font-size: var(--text-subheadline);
  letter-spacing: var(--tracking-tight);
  color: var(--color-label);
  border-radius: var(--radius-md);
  cursor: pointer;

  ${hoverMotion};

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

/* O azulejo do registro tinge pela receita da pílula: é ele que diz de que domínio a linha é quando a
   lista mistura clientes, orçamentos e tarefas. */
const Thumb = styled.span`
  display: inline-grid;
  flex-shrink: 0;
  place-items: center;
  width: 1.75rem;
  height: 1.75rem;
  color: color-mix(in oklab, var(--thumb-hue) 70%, var(--color-label));
  background-color: light-dark(
    color-mix(in oklab, var(--thumb-hue) 14%, transparent),
    color-mix(in oklab, var(--thumb-hue) 20%, transparent)
  );
  border-radius: var(--radius-sm);

  & svg {
    width: 1rem;
    height: 1rem;
  }
`;

const Info = styled.span`
  display: grid;
  flex: 1;
  min-width: 0;

  & > span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

const Detail = styled.span`
  font-size: var(--text-caption-1);
  color: var(--color-label-secondary);
`;

const Mark = styled.mark`
  color: inherit;
  background-color: light-dark(
    color-mix(in oklab, var(--color-accent) 18%, transparent),
    color-mix(in oklab, var(--color-accent) 30%, transparent)
  );
  border-radius: var(--radius-xs);
`;

/* A situação do registro some na tela mais estreita: lá o nome e a linha de apoio precisam da largura
   inteira, e a situação é a primeira coisa que a ficha mostra ao abrir. */
const Status = styled.span`
  flex-shrink: 0;

  @media (max-width: 23.4375rem) {
    display: none;
  }
`;

const Notice = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: var(--space-2) var(--space-3);
  padding: var(--space-3) var(--space-4);
  text-align: center;
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
  gap: var(--space-5);
  padding: var(--space-3) var(--space-4);
  border-block-start: var(--panel-line) solid var(--color-border);

  @media (max-width: 47.9375rem) {
    display: none;
  }
`;

const Hint = styled.span`
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  font-family: var(--font-body);
  font-size: var(--text-caption-1);
  letter-spacing: var(--tracking-tight);
  color: var(--color-label-tertiary);
`;

/* Fio da casa, o mesmo do menu, descendo por cascata para busca, pílulas e rodapé. */
const Palette = styled(Dialog)`
  --panel-line: 0.0375rem;
`;

/** Uma linha da lista: página do menu, ação de criar, registro do banco ou o "ver todos" de um grupo. */
type Item = {
  key: string;
  title: string;
  detail?: string;
  href: string;
  icon: Icon;
  /** Com matiz, o glifo vai num azulejo tingido; sem, fica solto como no menu. */
  hue?: string;
  section?: { label: string; hue: string };
  status?: { label: string; tone: BadgeTone };
  /** Só página entra nos recentes: o cookie guarda rota pública do menu, nunca registro nem o que foi digitado. */
  remember?: boolean;
};

type Section = { key: string; title: string; total?: number; items: Item[] };

const fold = (text: string) => slugify(text, 400);

/* Fora do componente, como os cookies de visão dos quadros: escrever no documento é efeito, e não render. */
function saveRecent(routes: string[]) {
  document.cookie = recentRoutesCookie(routes);
}

const plain = (text: string) => text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/** O texto com o trecho buscado marcado, sem ligar para acento: "joao" acha e marca "João". */
function marked(text: string, needle: string): ReactNode {
  if (!needle) return text;
  const folded = plain(text);
  /* Só marca quando tirar o acento não muda o tamanho do texto: senão a posição achada não cai no original. */
  if (folded.length !== text.length) return text;
  const at = folded.indexOf(needle);
  if (at < 0) return text;
  return (
    <>
      {text.slice(0, at)}
      <Mark>{text.slice(at, at + needle.length)}</Mark>
      {text.slice(at + needle.length)}
    </>
  );
}

/* Começar pelo termo vale mais que conter, e o rótulo vale mais que a seção. */
function pageScore(page: NavResult, needle: string) {
  const label = fold(page.label);
  if (label.startsWith(needle)) return 3;
  if (label.includes(needle)) return 2;
  return fold(page.section).includes(needle) ? 1 : 0;
}

const pageItem = (page: NavResult, recent = false): Item => ({
  key: `page:${page.href}`,
  title: page.label,
  href: page.href,
  icon: recent ? ClockCounterClockwiseIcon : page.icon,
  section: { label: page.section, hue: page.hue },
  remember: true,
});

// Busca do produto: campo em cima, atalhos em pílula, o que foi aberto por último e sugestões. Com texto,
// procura nas páginas do menu na hora e, depois de uma pausa na digitação, nos registros da equipe pela
// `searchAction`, que passa pela busca de cada quadro. As páginas saem de `nav.ts`, que tem `href` tipado
// por rota, então a paleta nunca oferece uma página que não existe.
export function CommandPalette({ open, onClose, restricted = false }: CommandPaletteProps) {
  const router = useRouter();
  const sheet = useMediaQuery(MOBILE_QUERY);
  const listId = useId();
  const fieldRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [results, setResults] = useState<Record<string, SearchResult>>({});
  const [recent, setRecent] = useState<string[]>(() =>
    typeof document === "undefined" ? [] : readRecentRoutes(readCookie(RECENT_COOKIE)),
  );

  const pages = useMemo(() => navLinks().filter((page) => !restricted || tasksRoleAllows(page.href)), [restricted]);
  const term = query.trim();
  const needle = fold(term);
  const highlight = plain(term);
  const ready = searchable(term);
  const result = ready ? results[term] : undefined;
  const searching = ready && !result;

  // No celular o campo não recebe foco sozinho: o teclado subiria antes de a lista aparecer.
  useEffect(() => {
    if (sheet) return;
    const frame = window.requestAnimationFrame(() => fieldRef.current?.focus({ preventScroll: true }));
    return () => window.cancelAnimationFrame(frame);
  }, [sheet]);

  // O banco responde depois de uma pausa na digitação. Cada resposta fica guardada pelo termo enquanto a
  // janela está aberta, então apagar uma letra devolve o resultado anterior sem nova ida ao servidor.
  const answered = Boolean(result);
  useEffect(() => {
    if (!open || !ready || answered) return;
    const timer = window.setTimeout(() => {
      void callAction(searchAction({ term })).then((reply) => setResults((current) => ({ ...current, [term]: reply })));
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [open, ready, answered, term]);

  const retry = () => {
    setResults((current) => {
      const next = { ...current };
      delete next[term];
      return next;
    });
    fieldRef.current?.focus({ preventScroll: true });
  };

  const commands = useMemo<Item[]>(
    () =>
      createCommands.flatMap((command) => {
        const list = pages.find((page) => page.href === command.list);
        if (!list) return [];
        return [{ key: `create:${command.href}`, title: command.label, href: command.href, icon: PlusCircleIcon, section: { label: list.section, hue: list.hue } }];
      }),
    [pages],
  );

  /* Sem memorização à mão: são algumas dezenas de linhas, recalculadas por tecla sem custo que se note. */
  const sections = ((): Section[] => {
    if (!needle) {
      const visited = recent
        .map((path) => pages.find((page) => page.href === path))
        .filter((page): page is NavResult => Boolean(page));

      const suggestions = pages
        .filter((page) => !visited.some((item) => item.href === page.href))
        .slice(0, SUGGESTION_LIMIT);

      const list: Section[] = [];
      if (visited.length > 0) list.push({ key: "recent", title: "Recentes", items: visited.slice(0, RECENT_LIMIT).map((page) => pageItem(page, true)) });
      list.push({ key: "suggestions", title: "Sugestões", items: suggestions.map((page) => pageItem(page)) });
      list.push({ key: "create", title: "Criar", items: commands });
      return list;
    }

    const matchedPages = pages
      .map((page) => ({ page, score: pageScore(page, needle) }))
      .filter(({ score }) => score > 0)
      .toSorted((a, b) => b.score - a.score)
      .map(({ page }) => pageItem(page));

    const matchedCommands = commands.filter((command) => fold(`${command.title} criar adicionar ${command.section?.label ?? ""}`).includes(needle));

    const list: Section[] = [];
    if (matchedPages.length > 0) list.push({ key: "pages", title: "Páginas", total: matchedPages.length, items: matchedPages.slice(0, PAGES_SHOWN) });
    if (matchedCommands.length > 0) list.push({ key: "create", title: "Criar", items: matchedCommands });

    if (result?.ok) {
      for (const group of result.groups) {
        const look = groupLooks[group.key];
        const items: Item[] = group.hits.map((hit) => ({
          key: `${group.key}:${hit.id}`,
          title: hit.title,
          detail: hit.detail,
          href: hit.href,
          icon: look.icon,
          hue: look.hue,
          status: hit.status,
        }));
        if (group.all) {
          items.push({
            key: `${group.key}:all`,
            title: `Ver os ${group.total} resultados em ${group.label}`,
            href: group.all,
            icon: ArrowRightIcon,
          });
        }
        list.push({ key: group.key, title: group.label, total: group.total, items });
      }
    }

    return list;
  })();

  const flat = sections.flatMap((section) => section.items);
  const selected = Math.min(active, Math.max(0, flat.length - 1));

  useEffect(() => {
    bodyRef.current?.querySelector<HTMLElement>("[data-active]")?.scrollIntoView({ block: "nearest" });
  }, [selected, result, query]);

  const go = (item: Item) => {
    if (item.remember) {
      const next = rememberRoute(recent, item.href);
      saveRecent(next);
      setRecent(next);
    }
    onClose();
    router.push(item.href as Route);
  };

  const navigate = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (flat.length === 0) return;

    const moves: Record<string, number> = { ArrowDown: 1, ArrowUp: -1, PageDown: 5, PageUp: -5 };
    const step = moves[event.key];
    if (step !== undefined) {
      event.preventDefault();
      /* A seta dá a volta na lista; a página para nas pontas, que é o que se espera de pular de cinco em cinco. */
      const next = Math.abs(step) === 1 ? (selected + step + flat.length) % flat.length : Math.min(flat.length - 1, Math.max(0, selected + step));
      setActive(next);
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      const item = flat[selected];
      if (item) go(item);
    }
  };

  const failed = result && !result.ok ? result.error : null;
  const nothing = Boolean(needle) && !searching && !failed && flat.length === 0;
  const optionId = (index: number) => `${listId}-${index}`;

  return (
    <Palette open={open} onClose={onClose} label="Buscar" size="md" surface="glass" scrim={false} focusOnOpen={false}>
      <Search>
        <MagnifyingGlassIcon aria-hidden="true" />
        <Field
          ref={fieldRef}
          type="search"
          role="combobox"
          autoComplete="off"
          enterKeyHint="search"
          aria-label="Buscar no Specular"
          aria-expanded={flat.length > 0}
          aria-controls={flat.length > 0 ? listId : undefined}
          aria-autocomplete="list"
          aria-activedescendant={flat[selected] ? optionId(selected) : undefined}
          aria-busy={searching || undefined}
          placeholder="Buscar cliente, orçamento, tarefa, página..."
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
          }}
          onKeyDown={navigate}
        />
        {query ? (
          <IconButton
            label="Limpar a busca"
            variant="ghost"
            size="sm"
            onClick={() => {
              setQuery("");
              setActive(0);
              fieldRef.current?.focus({ preventScroll: true });
            }}
          >
            <XCircleIcon weight="fill" />
          </IconButton>
        ) : (
          <Kbd aria-hidden="true">Esc</Kbd>
        )}
      </Search>

      {!needle && (
        <Pills>
          {navHighlights.filter((item) => !restricted || tasksRoleAllows(item.href)).map((item) => (
            <Pill
              key={item.href}
              type="button"
              style={{ "--pill-hue": item.hue } as CSSProperties}
              onClick={() => go({ key: item.href, title: item.label, href: item.href, icon: item.icon, remember: true })}
              {...rounded("md")}
            >
              <item.icon aria-hidden="true" />
              {item.label}
            </Pill>
          ))}
        </Pills>
      )}

      <Body ref={bodyRef} data-empty={(flat.length === 0 && !searching) || undefined}>
        {flat.length > 0 && (
          <List id={listId} role="listbox" aria-label="Resultados da busca">
            {sections
              .filter((section) => section.items.length > 0)
              .map((section, position) => (
                <Fragment key={section.key}>
                  {position > 0 && <GroupDivider role="presentation" />}
                  <GroupLabel role="presentation">
                    {section.title}
                    {section.total !== undefined && <GroupCount>{section.total}</GroupCount>}
                  </GroupLabel>
                  {section.items.map((item) => {
                    const index = flat.indexOf(item);
                    return (
                      <Option
                        key={item.key}
                        id={optionId(index)}
                        role="option"
                        aria-selected={index === selected}
                        data-active={index === selected || undefined}
                        onPointerMove={() => setActive(index)}
                        onClick={() => go(item)}
                      >
                        {item.hue ? (
                          <Thumb style={{ "--thumb-hue": item.hue } as CSSProperties} {...rounded("sm")}>
                            <item.icon aria-hidden="true" />
                          </Thumb>
                        ) : (
                          <item.icon aria-hidden="true" />
                        )}
                        <Info>
                          <span>{marked(item.title, highlight)}</span>
                          {item.detail && <Detail>{marked(item.detail, highlight)}</Detail>}
                        </Info>
                        {item.status && (
                          <Status>
                            <Badge variant="soft" size="sm" tone={item.status.tone}>
                              {item.status.label}
                            </Badge>
                          </Status>
                        )}
                        {item.section && (
                          <Badge variant="soft" size="sm" hue={item.section.hue}>
                            {item.section.label}
                          </Badge>
                        )}
                      </Option>
                    );
                  })}
                </Fragment>
              ))}
          </List>
        )}

        {searching && (
          <Notice>
            <Spinner size="sm" label="Buscando nos registros" />
            <Text variant="footnote" tone="secondary" aria-hidden="true">
              Buscando nos registros
            </Text>
          </Notice>
        )}

        {failed && (
          <Notice role="alert">
            <Text variant="footnote" tone="secondary">
              Não deu para buscar nos registros. {failed}
            </Text>
            <Button variant="secondary" size="sm" onClick={retry}>
              Tentar de novo
            </Button>
          </Notice>
        )}

        {nothing && (
          <Empty>
            <Text variant="footnote" tone="secondary">
              {ready ? `Nada encontrado para “${term}”.` : "Nenhuma página com esse nome. Digite ao menos duas letras para buscar nos registros."}
            </Text>
          </Empty>
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
