"use client";

import type { CSSProperties } from "react";
import { useFloatingActionsRegistration } from "@/components/layout/floating-actions";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogHeader } from "@/components/ui/dialog";
import { Text } from "@/components/ui/text";
import { MOBILE_QUERY, useMediaQuery } from "@/hooks/use-media-query";
import { rounded } from "@/lib/corners";
import { categories, nodeCatalog } from "../catalog";
import { momentLabel, runStatuses, stepStatuses } from "../labels";
import type { AutomationRun } from "../summary";
import styles from "./run-log-dialog.module.css";

export type RunLogDialogProps = {
  open: boolean;
  onClose: () => void;
  name: string;
  runs: AutomationRun[];
  /** A execução que acabou de acontecer, aberta em cima das outras. */
  highlight?: string | null;
};

// O histórico de execuções de uma automação, numa gaveta lateral (bandeja no celular): uma execução por
// bloco, com a situação, o que disparou e quando, e dentro os passos, um por nó visitado, com o glifo do nó,
// o que aconteceu e o estado. A mais nova vem aberta; as outras, fechadas em `details`, para a lista não
// virar um muro.
export function RunLogDialog({ open, onClose, name, runs, highlight }: RunLogDialogProps) {
  const mobile = useMediaQuery(MOBILE_QUERY);
  return (
    <Dialog open={open} onClose={onClose} label={`Execuções de ${name}`} size="md" placement="end" scrim={mobile} focusOnOpen={false}>
      <RunLog name={name} runs={runs} highlight={highlight} onClose={onClose} />
    </Dialog>
  );
}

function RunLog({ name, runs, highlight, onClose }: Omit<RunLogDialogProps, "open">) {
  useFloatingActionsRegistration({ cancel: { label: "Fechar", onClick: onClose } });
  return (
    <div className={styles.drawer}>
      <DialogHeader title="Execuções" description={name} onClose={onClose} />

      <div className={styles.body}>
        {runs.length === 0 ? (
          <div className={styles.empty}>
            <Text variant="callout" weight="semibold">
              Ainda não rodou
            </Text>
            <Text variant="footnote" tone="secondary">
              Teste a automação pelo botão do editor, ou ative e espere o primeiro evento.
            </Text>
          </div>
        ) : (
          <ol className={styles.runs}>
            {runs.map((run, index) => {
              const status = runStatuses[run.status];
              return (
                <li key={run.id}>
                  <details className={styles.run} open={highlight ? run.id === highlight : index === 0} {...rounded("lg")}>
                    <summary className={styles.summary}>
                      <Badge tone={status.tone} size="sm" icon={<status.icon />}>
                        {status.label}
                      </Badge>
                      <span className={styles.summaryCopy}>
                        <Text as="span" variant="footnote" weight="semibold" truncate>
                          {run.trigger}
                          {run.mode === "test" ? ", em teste" : ""}
                        </Text>
                        <Text as="span" variant="caption1" tone="secondary">
                          {momentLabel(run.at)}
                        </Text>
                      </span>
                    </summary>
                    <ol className={styles.steps}>
                      {run.steps.map((step, position) => {
                        const spec = nodeCatalog[step.kind];
                        const state = stepStatuses[step.status];
                        return (
                          <li key={`${step.nodeId}-${position}`} className={styles.step}>
                            <span className={styles.stepGlyph} style={{ "--step-hue": categories[spec.category].hue } as CSSProperties} aria-hidden="true">
                              <spec.icon weight="duotone" />
                            </span>
                            <span className={styles.stepCopy}>
                              <span className={styles.stepHead}>
                                <Text as="span" variant="footnote" weight="semibold">
                                  {step.label}
                                </Text>
                                <Badge tone={state.tone} variant="soft" size="sm">
                                  {state.label}
                                </Badge>
                              </span>
                              <Text as="span" variant="caption1" tone="secondary" className={styles.detail}>
                                {step.detail}
                              </Text>
                            </span>
                          </li>
                        );
                      })}
                    </ol>
                  </details>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}
