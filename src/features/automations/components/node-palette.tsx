"use client";

import { DotsSixVerticalIcon, MagnifyingGlassIcon } from "@phosphor-icons/react";
import { useState, type CSSProperties, type DragEvent } from "react";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { rounded } from "@/lib/corners";
import { categories, nodesOf, type NodeSpec } from "../catalog";
import type { NodeCategory, NodeKind } from "../summary";
import styles from "./automation-editor.module.css";

/** O tipo de dado do arrastar da paleta para o quadro. */
export const NODE_DRAG_TYPE = "application/x-specular-node";

export type NodePaletteProps = {
  onPick: (kind: NodeKind) => void;
  /** Só os gatilhos (no quadro vazio) ou só o que vem depois (no "O que acontece depois?"); sem isso, tudo. */
  only?: "trigger" | "steps";
  /** O fluxo já tem gatilho: os gatilhos ficam apagados, com o motivo. */
  hasTrigger: boolean;
  /** Os itens podem ser arrastados para o quadro, além de clicados. */
  draggable?: boolean;
  /** Com busca em cima, para a lista longa da coluna. */
  searchable?: boolean;
};

const plain = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("pt-BR");

// A paleta de nós, no desenho da coluna de ferramentas da referência: os grupos (Gatilhos, Lógica, Ações)
// com o título miúdo e a contagem, e um item por nó com o glifo no matiz da categoria, o nome e a linha do que
// faz. Clicar adiciona ao quadro; no desktop também dá para arrastar até o lugar.
export function NodePalette({ onPick, only, hasTrigger, draggable = false, searchable = false }: NodePaletteProps) {
  const [query, setQuery] = useState("");
  const needle = plain(query.trim());
  const groups = (Object.keys(categories) as NodeCategory[]).filter((category) => (only === "trigger" ? category === "trigger" : only === "steps" ? category !== "trigger" : true));

  const onDragStart = (event: DragEvent<HTMLButtonElement>, kind: NodeKind) => {
    event.dataTransfer.setData(NODE_DRAG_TYPE, kind);
    event.dataTransfer.effectAllowed = "move";
  };

  const matches = (spec: NodeSpec) => !needle || plain(`${spec.label} ${spec.description}`).includes(needle);

  return (
    <div className={styles.palette}>
      {searchable && <Input type="search" size="sm" value={query} placeholder="Buscar passo" aria-label="Buscar passo" iconStart={<MagnifyingGlassIcon />} onChange={(event) => setQuery(event.target.value)} />}
      {groups.map((category) => {
        const specs = nodesOf(category).filter(matches);
        if (specs.length === 0) return null;
        const meta = categories[category];
        /* Com o gatilho no lugar, a lista de gatilhos vira uma linha: nove itens apagados só empurravam o
           resto para baixo. */
        if (category === "trigger" && hasTrigger && !needle) {
          return (
            <section key={category} className={styles.paletteGroup} aria-label={meta.label}>
              <header className={styles.paletteHead}>
                <Text as="h3" variant="caption1" weight="semibold" tone="secondary" className={styles.paletteTitle}>
                  {meta.label}
                </Text>
              </header>
              <Text variant="caption1" tone="tertiary">
                O fluxo já tem o gatilho. Para trocar, remova o atual no quadro e escolha outro aqui.
              </Text>
            </section>
          );
        }
        return (
          <section key={category} className={styles.paletteGroup} aria-label={meta.label}>
            <header className={styles.paletteHead}>
              <Text as="h3" variant="caption1" weight="semibold" tone="secondary" className={styles.paletteTitle}>
                {meta.label}
              </Text>
              <Text as="span" variant="caption2" tone="tertiary">
                {specs.length}
              </Text>
            </header>
            <ul className={styles.paletteList}>
              {specs.map((spec) => {
                const blocked = category === "trigger" && hasTrigger;
                return (
                  <li key={spec.kind}>
                    <button
                      type="button"
                      className={styles.paletteItem}
                      style={{ "--item-hue": meta.hue } as CSSProperties}
                      disabled={blocked}
                      title={blocked ? "O fluxo já tem um gatilho. Remova o atual para trocar." : undefined}
                      draggable={draggable && !blocked}
                      onDragStart={(event) => onDragStart(event, spec.kind)}
                      onClick={() => onPick(spec.kind)}
                      {...rounded("md")}
                    >
                      <span className={styles.paletteGlyph} aria-hidden="true" {...rounded("sm")}>
                        <spec.icon weight="duotone" />
                      </span>
                      <span className={styles.paletteCopy}>
                        <Text as="span" variant="footnote" weight="semibold">
                          {spec.label}
                        </Text>
                        <Text as="span" variant="caption1" tone="secondary" className={styles.paletteDescription}>
                          {blocked ? "O fluxo já tem um gatilho" : spec.description}
                        </Text>
                      </span>
                      {draggable && !blocked && <DotsSixVerticalIcon className={styles.paletteGrip} weight="bold" aria-hidden="true" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
