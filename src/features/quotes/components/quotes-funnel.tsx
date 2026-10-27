"use client";

import { memo, type CSSProperties } from "react";
import { VisuallyHidden } from "@/components/ui/visually-hidden";
import { rounded } from "@/lib/corners";
import { compactMoney } from "@/lib/utils/format";
import { quoteStatuses } from "../labels";
import type { Quote, QuoteStatus } from "../summary";
import { quoteTotals } from "../totals";
import { QuoteCard } from "./quote-card";
import styles from "./quotes-funnel.module.css";

/** As etapas do funil de orçamentos, na ordem do caminho: as situações que um orçamento atravessa. */
export const quoteFunnelStages: QuoteStatus[] = ["draft", "sent", "viewed", "approved", "declined", "expired"];

/* A cor de cada etapa, a mesma da etiqueta da situação, como matiz do sistema para a coluna se tingir. */
const stageHues: Record<QuoteStatus, string> = {
  draft: "var(--sys-gray)",
  sent: "var(--color-accent)",
  viewed: "var(--sys-cyan)",
  approved: "var(--sys-green)",
  declined: "var(--sys-red)",
  expired: "var(--sys-orange)",
};

export type QuotesFunnelProps = {
  quotes: Quote[];
  onOpen: (quote: Quote) => void;
};

/**
 * Os orçamentos em funil (2026-10-26, a pedido: "a visualização de cartões aparecer como funil, com as etapas
 * padrão do orçamento"): uma coluna por situação, na ordem em que o orçamento anda, no desenho das colunas do
 * quadro de tarefas e do funil de vendas: o véu da cor da etapa, a etiqueta com o glifo, o nome e a contagem, o
 * total da etapa ao lado e os cartões de sempre embaixo. A situação muda pelo que acontece com o orçamento
 * (enviar, o cliente ver, aprovar), e não arrastando, então as colunas só mostram.
 */
function QuotesFunnelBase({ quotes, onOpen }: QuotesFunnelProps) {
  return (
    <div className={styles.rail}>
      {quoteFunnelStages.map((stage) => {
        const status = quoteStatuses[stage];
        const Glyph = status.icon;
        const items = quotes.filter((quote) => quote.status === stage);
        const total = items.reduce((sum, quote) => sum + quoteTotals(quote).total, 0);
        return (
          <section key={stage} className={styles.column} style={{ "--stage-hue": stageHues[stage] } as CSSProperties} aria-label={`${status.label}, ${items.length} orçamentos`}>
            <header className={styles.head}>
              <h2 className={styles.stage} {...rounded("md", { clip: true })}>
                <Glyph aria-hidden="true" className={styles.glyph} weight="bold" />
                <span className={styles.name}>{status.label}</span>
                <span className={styles.count} aria-hidden="true" {...rounded("sm", { clip: true })}>
                  {items.length}
                </span>
                <VisuallyHidden>{items.length === 1 ? "1 orçamento" : `${items.length} orçamentos`}</VisuallyHidden>
              </h2>
              {items.length > 0 && <span className={styles.total}>{compactMoney(total)}</span>}
            </header>
            <div className={styles.body}>
              {items.length === 0 ? (
                <p className={styles.empty}>Nenhum orçamento</p>
              ) : (
                <ul className={styles.list}>
                  {items.map((quote) => (
                    <QuoteCard key={quote.id} quote={quote} onOpen={() => onOpen(quote)} />
                  ))}
                </ul>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

/* Memorizado: cada tecla na busca refazia as colunas antes de a espera deixar a busca ir ao servidor. */
export const QuotesFunnel = memo(QuotesFunnelBase);
