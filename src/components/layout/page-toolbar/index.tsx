"use client";

import { FunnelSimpleIcon, XIcon } from "@phosphor-icons/react";
import { useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { IconButton } from "@/components/ui/icon-button";
import { Text } from "@/components/ui/text";
import styles from "./page-toolbar.module.css";

export type PageToolbarProps = {
  /** O campo de busca da página; toma a largura que sobra. */
  search: ReactNode;
  /** Os menus de filtro. No desktop ficam na barra; no celular, dentro da janela de filtros. */
  filters?: ReactNode;
  /** O que age sobre a seleção, quando há: some no celular enquanto nada estiver marcado. */
  selection?: ReactNode;
  /** A ação principal da página, o "criar" dela. Fica sempre na barra. */
  action?: ReactNode;
  /** Quantos filtros estão fora do padrão, para a etiqueta no botão do celular. */
  activeFilters?: number;
  /** Quantos itens estão marcados: com zero, o grupo de seleção sai da barra no celular. */
  selectedCount?: number;
};

// A barra que fica logo abaixo do topo em toda página da aplicação: busca, filtros e ações. No desktop
// os menus de filtro ficam na própria barra; no celular a barra guarda só o essencial, busca, o botão de
// filtros e o de criar, e os menus vão para uma janela, porque três menus lado a lado não cabem numa
// tela estreita sem virar rolagem lateral. O que age sobre a seleção só aparece no celular quando há
// seleção: sem ela seria um botão desligado ocupando a linha.
export function PageToolbar({ search, filters, selection, action, activeFilters = 0, selectedCount = 0 }: PageToolbarProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className={styles.toolbar}>
      <div className={styles.search}>{search}</div>

      {filters && <div className={styles.filters}>{filters}</div>}

      <div className={styles.actions}>
        {filters && (
          <span className={styles.filterButton}>
            <IconButton
              label={activeFilters > 0 ? `Filtros, ${activeFilters} ativos` : "Filtros"}
              variant="outline"
              size="sm"
              radius="md"
              aria-expanded={open}
              onClick={() => setOpen(true)}
            >
              <FunnelSimpleIcon />
            </IconButton>
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

        {action}
      </div>

      {filters && (
        <Dialog open={open} onClose={() => setOpen(false)} label="Filtros da página" size="sm" surface="glass">
          <div className={styles.sheet}>
            <header className={styles.sheetHead}>
              <Text as="h2" variant="headline" weight="semibold">
                Filtros
              </Text>
              <IconButton label="Fechar" variant="ghost" size="sm" onClick={() => setOpen(false)}>
                <XIcon />
              </IconButton>
            </header>
            <div className={styles.sheetBody}>{filters}</div>
          </div>
        </Dialog>
      )}
    </div>
  );
}
