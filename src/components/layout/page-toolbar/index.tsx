"use client";

import { MagnifyingGlassIcon, SlidersHorizontalIcon, XIcon, type Icon } from "@phosphor-icons/react";
import { useEffect, useRef, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, type DropdownSection, type DropdownTrigger } from "@/components/ui/dropdown-menu";
import { Kbd } from "@/components/ui/kbd";
import { squircle } from "@/lib/corners";
import styles from "./page-toolbar.module.css";

export type PageToolbarSearch = {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  /** Nome do campo para leitor de tela, como "Buscar cliente". */
  label: string;
};

/** Um filtro fora do padrão: o glifo que o representa, o valor que a etiqueta mostra e o que tira só ele. */
export type PageToolbarFilter = { id: string; label: string; icon: Icon; onClear: () => void };

/** Um jeito de ver a lista, como grade ou tabela: o glifo é o que aparece no seletor. */
export type PageToolbarViewOption = { value: string; label: string; icon: ReactNode };

export type PageToolbarView = {
  value: string;
  options: PageToolbarViewOption[];
  onChange: (value: string) => void;
  /** Nome do grupo para leitor de tela, como "Jeito de ver a lista". */
  label: string;
};

export type PageToolbarProps = {
  search: PageToolbarSearch;
  /** As seções do menu de filtros, que abre no botão ao lado da busca; sem elas o botão não aparece. */
  filters?: DropdownSection[];
  /** Os filtros fora do padrão: a contagem na quina do funil e, no desktop, uma etiqueta para cada na
   *  própria linha, colada ao funil. */
  activeFilters?: PageToolbarFilter[];
  /** O seletor de visão, só no desktop; sem ele a página tem uma visão só. */
  view?: PageToolbarView;
  /** O que age sobre o que está marcado, como excluir: a página só passa quando há seleção. */
  selection?: ReactNode;
  /** A ação principal da página, como "Novo cliente". */
  action?: ReactNode;
};

/** A tecla que leva o foco à busca de qualquer lugar da página, como nas ferramentas de trabalho. */
const SEARCH_KEY = "/";

/* O botão da barra vestido como o campo ao lado, literalmente: só o fio, sem preenchimento (o do botão
   secundário durou uma rodada e saiu a pedido, porque o fio sozinho lê melhor), na espessura do fio do
   campo por `--button-line`, declarado na barra; o canto `md` pelo sistema de cantos da casa e o glifo na
   mesma tinta secundária da lupa. */
const FIELD_TRIGGER: DropdownTrigger = { variant: "outline", radius: "md", foreground: "var(--color-label-secondary)" };

/* Quem está digitando em outro campo não perde a barra para o atalho. */
function isTyping(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

// A barra logo abaixo do topo em toda página da aplicação: a busca tomando toda a largura que sobra, no
// mesmo desenho do campo de busca do menu lateral (fio fino, raio `md`, lupa e a tecla de atalho na
// ponta); colado a ela, a 4px, o botão de filtros vestido como o campo (mesmo fio, mesmo canto, glifo na
// mesma tinta), que abre o menu de vidro do chevron duplo das listas com todos os filtros da página; o
// seletor de visão, quando a página tem mais de um jeito de ver; e a ação principal fechando a linha. No
// celular a tecla some, porque não há teclado, e o menu vira bandeja.
//
// Na mesma linha, coladas ao funil e só no desktop, uma etiqueta por filtro em vigor, com o glifo do
// filtro, o valor e o × que tira aquele filtro (a pedido, 2026-09-08; uma rodada abaixo da linha durou um
// dia): a contagem na quina do funil diz quantos são, e as etiquetas dizem quais, sem abrir o menu. Elas
// não encolhem; quem cede é a busca. No celular saem, porque a linha já ocupa a largura toda.
export function PageToolbar({ search, filters, activeFilters = [], view, selection, action }: PageToolbarProps) {
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== SEARCH_KEY || event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target)) return;
      event.preventDefault();
      input.current?.focus();
      input.current?.select();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className={styles.toolbar}>
      {/* O `label` é a caixa inteira, então clicar em qualquer ponto dela foca o campo, e o nome fica
          no `aria-label` porque o texto visível é só o placeholder. */}
      <label className={styles.find} {...squircle("md")}>
        <MagnifyingGlassIcon aria-hidden="true" />
        <input
          ref={input}
          type="search"
          className={styles.input}
          value={search.value}
          onChange={(event) => search.onChange(event.target.value)}
          placeholder={search.placeholder}
          aria-label={search.label}
          aria-keyshortcuts={SEARCH_KEY}
        />
        <Kbd aria-hidden="true">{SEARCH_KEY}</Kbd>
      </label>

      {filters && (
        <span className={styles.funnel}>
          <DropdownMenu
            label="Filtros"
            triggerLabel={activeFilters.length > 0 ? `Filtros, ${activeFilters.length} em vigor` : "Filtros"}
            sections={filters}
            icon={<SlidersHorizontalIcon />}
            trigger={FIELD_TRIGGER}
          />
          {activeFilters.length > 0 && (
            <Badge tone="accent" size="sm" shape="pill" className={styles.count} aria-hidden="true">
              {activeFilters.length}
            </Badge>
          )}
        </span>
      )}

      {activeFilters.length > 0 && (
        <ul className={styles.chips} aria-label="Filtros em vigor">
          {activeFilters.map(({ id, label, icon: Glyph, onClear }) => (
            <li key={id}>
              <button type="button" className={styles.chip} aria-label={`Tirar o filtro ${label}`} title={`Tirar o filtro ${label}`} onClick={onClear}>
                <span className={styles.chipMain}>
                  <Glyph aria-hidden="true" className={styles.chipIcon} />
                  <span className={styles.chipLabel}>{label}</span>
                </span>
                <XIcon aria-hidden="true" className={styles.chipClose} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* O seletor de visão: dois botões colados num invólucro com o fio do campo, o em vigor com o
          preenchimento da casa. `radiogroup` porque é uma escolha entre jeitos de ver a mesma lista, e
          não duas ações. Só no desktop: no celular a grade é a única visão que serve. */}
      {view && (
        <div className={styles.views} role="radiogroup" aria-label={view.label} {...squircle("md")}>
          {view.options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={option.value === view.value}
              aria-label={option.label}
              title={option.label}
              className={styles.view}
              data-on={option.value === view.value || undefined}
              onClick={() => view.onChange(option.value)}
            >
              {option.icon}
            </button>
          ))}
        </div>
      )}

      {selection && <span className={styles.selection}>{selection}</span>}

      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}
