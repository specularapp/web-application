"use client";

import { MagnifyingGlassIcon, SlidersHorizontalIcon } from "@phosphor-icons/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, type DropdownMenuProps, type DropdownSection, type DropdownTrigger } from "@/components/ui/dropdown-menu";
import { IconButton } from "@/components/ui/icon-button";
import { Kbd } from "@/components/ui/kbd";
import { MOBILE_QUERY, useMediaQuery } from "@/hooks/use-media-query";
import { squircle } from "@/lib/corners";
import { FilterSheet } from "./filter-sheet";
import styles from "./page-toolbar.module.css";

export type PageToolbarSearch = {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  /** Nome do campo para leitor de tela, como "Buscar cliente". */
  label: string;
};

/** Um menu rápido à vista na barra, como ordem ou período: a barra é quem o veste. */
export type PageToolbarMenu = Omit<DropdownMenuProps, "trigger" | "size">;

export type PageToolbarProps = {
  search: PageToolbarSearch;
  /** Menus que ficam à vista ao lado da busca no desktop, como ordem e período, só com o ícone. No
   *  celular eles entram dentro do funil. */
  quickFilters?: PageToolbarMenu[];
  /** Quantos menus rápidos saíram do padrão: no celular somam à etiqueta do funil, que é onde eles estão. */
  activeQuickFilters?: number;
  /** As seções do menu de filtros, que abre no funil; sem elas o funil não aparece. */
  filters?: DropdownSection[];
  /** Quantos filtros do menu saíram do padrão, para a etiqueta na quina do funil. */
  activeFilters?: number;
  /** A ação principal da página, como "Novo cliente". */
  action?: ReactNode;
};

/** A tecla que leva o foco à busca de qualquer lugar da página, como nas ferramentas de trabalho. */
const SEARCH_KEY = "/";

/* Os botões da barra vestidos como o campo ao lado, literalmente: o preenchimento e o fio do botão
   secundário (o fio fino vem de `--button-line`, declarado na barra), o canto `md` pelo sistema de
   cantos da casa e o glifo na mesma tinta secundária da lupa. */
const FIELD_TRIGGER: DropdownTrigger = { variant: "secondary", radius: "md", foreground: "var(--color-label-secondary)" };

/* Quem está digitando em outro campo não perde a barra para o atalho. */
function isTyping(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

// A barra logo abaixo do topo em toda página da aplicação: a busca tomando toda a largura que sobra, no
// mesmo desenho do campo de busca do menu lateral (fio fino, raio `md`, lupa e a tecla de atalho na
// ponta), e colados a ela, a 4px, os menus rápidos e o funil de filtros, cada um um botão vestido como o
// campo (mesmo fio, mesmo canto, glifo na mesma tinta, com um preenchimento leve para o botão se ver) e
// abrindo o menu de vidro do chevron duplo das listas. A ação principal da página fecha a linha.
//
// No celular sobram três peças: a busca, o botão de filtros e a ação. Os menus rápidos somem da linha por
// CSS e as seções deles entram no começo da bandeja de filtros (`FilterSheet`), que arruma tudo em grupos
// de fichas em vez da lista corrida do menu; a etiqueta do botão passa a contar tudo o que está lá
// dentro. A tecla de atalho some junto, porque não há teclado.
export function PageToolbar({
  search,
  quickFilters,
  activeQuickFilters = 0,
  filters,
  activeFilters = 0,
  action,
}: PageToolbarProps) {
  const input = useRef<HTMLInputElement>(null);
  const mobile = useMediaQuery(MOBILE_QUERY);
  const [sheet, setSheet] = useState(false);

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

  // A bandeja só é montada quando abre, depois da hidratação, então ler a largura aqui não faz o
  // servidor e o cliente discordarem: o botão é o mesmo nos dois.
  const sheetSections = [...(quickFilters ?? []).flatMap((menu) => menu.sections), ...(filters ?? [])];
  const funnelCount = mobile ? activeFilters + activeQuickFilters : activeFilters;
  const showFunnel = filters || (mobile && quickFilters);

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

      {quickFilters && (
        <span className={styles.quick}>
          {quickFilters.map((menu) => (
            <DropdownMenu key={menu.label} {...menu} trigger={FIELD_TRIGGER} />
          ))}
        </span>
      )}

      {showFunnel && (
        <span className={styles.funnel}>
          {mobile ? (
            <>
              <IconButton
                label={funnelCount > 0 ? `Filtros, ${funnelCount} em vigor` : "Filtros"}
                size="sm"
                aria-haspopup="dialog"
                aria-expanded={sheet}
                onClick={() => setSheet(true)}
                {...FIELD_TRIGGER}
              >
                <SlidersHorizontalIcon />
              </IconButton>
              <FilterSheet open={sheet} onClose={() => setSheet(false)} sections={sheetSections} />
            </>
          ) : (
            <DropdownMenu
              label="Filtros"
              triggerLabel={funnelCount > 0 ? `Filtros, ${funnelCount} em vigor` : "Filtros"}
              sections={filters ?? []}
              icon={<SlidersHorizontalIcon />}
              trigger={FIELD_TRIGGER}
            />
          )}
          {funnelCount > 0 && (
            <Badge tone="accent" size="sm" shape="pill" className={styles.count} aria-hidden="true">
              {funnelCount}
            </Badge>
          )}
        </span>
      )}

      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}
