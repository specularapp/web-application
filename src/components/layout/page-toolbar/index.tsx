"use client";

import { FunnelSimpleIcon, MagnifyingGlassIcon } from "@phosphor-icons/react";
import { useEffect, useRef, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, type DropdownSection } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import styles from "./page-toolbar.module.css";

export type PageToolbarSearch = {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  /** Nome do campo para leitor de tela, como "Buscar cliente". */
  label: string;
};

export type PageToolbarProps = {
  search: PageToolbarSearch;
  /** Filtros que ficam à vista na barra, como período e ordem: os que a pessoa troca toda hora. */
  quickFilters?: ReactNode;
  /** As seções do menu de filtros, que abre no botão do funil; sem elas o botão não aparece. */
  filters?: DropdownSection[];
  /** Quantos filtros do menu saíram do padrão, para a etiqueta na quina do botão. */
  activeFilters?: number;
  /** O que age sobre a seleção, como excluir e exportar. */
  selection?: ReactNode;
  /** Sem nada marcado, o grupo de seleção sai da barra no celular. */
  selectedCount?: number;
  /** A ação principal da página, como "Novo cliente". */
  action?: ReactNode;
};

/** A tecla que leva o foco à busca de qualquer lugar da página, como nas ferramentas de trabalho. */
const SEARCH_KEY = "/";

/* Quem está digitando em outro campo não perde a barra para o atalho. */
function isTyping(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

// A barra logo abaixo do topo em toda página da aplicação, sobre uma referência do usuário: a busca
// tomando toda a largura que sobra, com a tecla de atalho na ponta; os filtros rápidos à vista; o botão
// de filtros, que abre o menu de vidro da casa com os demais e leva a contagem dos que estão em vigor; o
// que age sobre a seleção; e a ação principal da página na outra ponta. No celular a barra vira duas
// linhas: busca e ação em cima, filtros embaixo, porque numa linha só a busca ficava do tamanho de um
// botão. O menu de filtros já vira bandeja sozinho, então a barra não precisa de janela própria.
export function PageToolbar({
  search,
  quickFilters,
  filters,
  activeFilters = 0,
  selection,
  selectedCount = 0,
  action,
}: PageToolbarProps) {
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
      <div className={styles.search}>
        <Input
          ref={input}
          type="search"
          size="sm"
          value={search.value}
          onChange={(event) => search.onChange(event.target.value)}
          placeholder={search.placeholder}
          aria-label={search.label}
          aria-keyshortcuts={SEARCH_KEY}
          iconStart={<MagnifyingGlassIcon />}
          iconEnd={<Kbd aria-hidden="true">{SEARCH_KEY}</Kbd>}
        />
      </div>

      <div className={styles.tools}>
        {quickFilters}

        {filters && (
          <span className={styles.filterButton}>
            <DropdownMenu
              label="Filtros"
              triggerLabel={activeFilters > 0 ? `Filtros, ${activeFilters} em vigor` : "Filtros"}
              sections={filters}
              icon={<FunnelSimpleIcon />}
              variant="outline"
              radius="md"
            />
            {activeFilters > 0 && (
              <Badge tone="accent" size="sm" shape="pill" className={styles.filterCount} aria-hidden="true">
                {activeFilters}
              </Badge>
            )}
          </span>
        )}

        {selection && (
          <span className={styles.selection} data-selecting={selectedCount > 0 || undefined}>
            {selection}
          </span>
        )}
      </div>

      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}
