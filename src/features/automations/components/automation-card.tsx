"use client";

import { ClockCounterClockwiseIcon } from "@phosphor-icons/react";
import type { KeyboardEvent, MouseEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Text } from "@/components/ui/text";
import { agoLabel, automationStatuses, runsLabel } from "../labels";
import type { Automation } from "../summary";
import { AutomationMenu, type AutomationMenuActions } from "./automation-menu";
import { FlowStrip } from "./flow-strip";
import styles from "./automation-card.module.css";

export type AutomationCardProps = AutomationMenuActions & {
  automation: Automation;
  /** Abre o editor. */
  onOpen: () => void;
  /** O interruptor está trocando a situação no servidor. */
  toggling?: boolean;
};

/* Controles com ação própria dentro do cartão: clique que nasce neles não abre o editor. */
const INTERACTIVE = "button, a, input, label, [role='button'], [role='menuitem']";

// O cartão da automação (2026-09-15, sobre as referências n8n e Make do usuário, nos padrões da casa): em
// cima a situação e, na outra ponta, o interruptor de ativar e o leque; o nome e a descrição; a trilha do
// fluxo em azulejos, que diz o que ela faz de relance; e no pé quantas vezes rodou e quando foi a última. O
// cartão inteiro abre o editor; o interruptor e o leque têm ação própria. O fio da caixa é o do `Card`, em
// duas camadas recortadas pelo sistema de cantos.
export function AutomationCard({ automation, onOpen, toggling = false, ...actions }: AutomationCardProps) {
  const status = automationStatuses[automation.status];

  const onClick = (event: MouseEvent<HTMLElement>) => {
    const control = (event.target as HTMLElement).closest(INTERACTIVE);
    if (control && control !== event.currentTarget) return;
    onOpen();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onOpen();
    }
  };

  return (
    <article className={styles.card} data-status={automation.status}>
      <div className={styles.inner} role="button" tabIndex={0} aria-label={`Abrir a automação ${automation.name}`} onClick={onClick} onKeyDown={onKeyDown}>
        <header className={styles.head}>
          <Badge tone={status.tone} size="sm" icon={<status.icon />}>
            {status.label}
          </Badge>
          <span className={styles.controls}>
            <Switch size="sm" checked={automation.status === "active"} disabled={toggling || !actions.onToggle} aria-label={automation.status === "active" ? `Pausar ${automation.name}` : `Ativar ${automation.name}`} onChange={() => actions.onToggle?.()} />
            <AutomationMenu automation={automation} {...actions} />
          </span>
        </header>

        <div className={styles.copy}>
          <Text as="h3" variant="headline" weight="semibold" className={styles.title}>
            {automation.name}
          </Text>
          <Text as="p" variant="footnote" tone="secondary" className={styles.description}>
            {automation.description || "Sem descrição"}
          </Text>
        </div>

        <FlowStrip nodes={automation.nodes} edges={automation.edges} className={styles.strip} />

        <footer className={styles.foot}>
          <Badge tone="neutral" variant="soft" size="sm" icon={<ClockCounterClockwiseIcon />}>
            {runsLabel(automation.runCount)}
          </Badge>
          {automation.lastRunAt && (
            <Text as="span" variant="caption1" tone="tertiary" truncate>
              Última {agoLabel(automation.lastRunAt)}
            </Text>
          )}
        </footer>
      </div>
    </article>
  );
}
