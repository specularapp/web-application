"use client";

import { FunnelSimpleIcon, MagnifyingGlassIcon } from "@phosphor-icons/react";
import { useEffect, useRef, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, type DropdownSection } from "@/components/ui/dropdown-menu";
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

export type PageToolbarProps = {
  search: PageToolbarSearch;
  /** Menus que ficam à vista ao lado da busca, como ordem e período: `DropdownMenu` só com o ícone. */
  quickFilters?: ReactNode;
  /** As seções do menu de filtros, que abre no funil; sem elas o funil não aparece. */
  filters?: DropdownSection[];
  /** Quantos filtros do menu saíram do padrão, para a etiqueta na quina do funil. */
  activeFilters?: number;
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

// A barra logo abaixo do topo em toda página da aplicação: a busca tomando toda a largura que sobra, no
// mesmo desenho do campo de busca do menu lateral (fio fino, raio `md`, lupa e a tecla de atalho na
// ponta), e colados a ela, a 4px, os menus rápidos e o funil de filtros, todos no botão fantasma que o
// chevron duplo das listas usa, abrindo o mesmo menu de vidro. A ação principal da página fecha a linha.
// Uma linha só em qualquer largura: cada peça tem a altura do controle pequeno, e a tecla some no celular.
export function PageToolbar({ search, quickFilters, filters, activeFilters = 0, action }: PageToolbarProps) {
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

      {quickFilters}

      {filters && (
        <span className={styles.funnel}>
          <DropdownMenu
            label="Filtros"
            triggerLabel={activeFilters > 0 ? `Filtros, ${activeFilters} em vigor` : "Filtros"}
            sections={filters}
            icon={<FunnelSimpleIcon />}
          />
          {activeFilters > 0 && (
            <Badge tone="accent" size="sm" shape="pill" className={styles.count} aria-hidden="true">
              {activeFilters}
            </Badge>
          )}
        </span>
      )}

      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}
