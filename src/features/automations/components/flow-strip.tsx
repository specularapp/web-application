import { CaretRightIcon } from "@phosphor-icons/react/ssr";
import type { CSSProperties } from "react";
import { Text } from "@/components/ui/text";
import { VisuallyHidden } from "@/components/ui/visually-hidden";
import { rounded } from "@/lib/corners";
import { categories, nodeCatalog } from "../catalog";
import type { AutomationEdge, AutomationNode } from "../summary";
import { orderedNodes } from "../templates";
import styles from "./flow-strip.module.css";

export type FlowStripProps = {
  nodes: AutomationNode[];
  edges: AutomationEdge[];
  /** Quantos passos mostrar antes de resumir o resto em "+N". */
  limit?: number;
  className?: string;
};

// A trilha do fluxo em miniatura, para o cartão e a galeria: um azulejo por passo, na ordem de leitura (do
// gatilho para a frente), no matiz da categoria, com a seta entre eles e o resto em "+N". Diz de relance o que
// a automação faz sem abrir o quadro.
export function FlowStrip({ nodes, edges, limit = 5, className }: FlowStripProps) {
  const ordered = orderedNodes(nodes, edges);
  const shown = ordered.slice(0, limit);
  const rest = ordered.length - shown.length;

  if (ordered.length === 0) {
    return (
      <Text as="p" variant="caption1" tone="tertiary" className={className}>
        Fluxo vazio
      </Text>
    );
  }

  return (
    <ol className={[styles.strip, className].filter(Boolean).join(" ")} aria-label="Passos do fluxo">
      {shown.map((node, index) => {
        const spec = nodeCatalog[node.kind];
        return (
          <li key={node.id} className={styles.step}>
            {index > 0 && <CaretRightIcon className={styles.arrow} weight="bold" aria-hidden="true" />}
            <span className={styles.tile} style={{ "--tile-hue": categories[spec.category].hue } as CSSProperties} title={spec.label} {...rounded("sm")}>
              <spec.icon weight="duotone" aria-hidden="true" />
            </span>
            <VisuallyHidden>{spec.label}</VisuallyHidden>
          </li>
        );
      })}
      {rest > 0 && (
        <li className={styles.step}>
          <CaretRightIcon className={styles.arrow} weight="bold" aria-hidden="true" />
          <Text as="span" variant="caption1" tone="secondary" weight="semibold" className={styles.more}>
            +{rest}
          </Text>
        </li>
      )}
    </ol>
  );
}
