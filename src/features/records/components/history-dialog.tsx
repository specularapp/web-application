"use client";

import {
  ArrowCounterClockwiseIcon,
  ArchiveIcon,
  ClockCounterClockwiseIcon,
  PencilSimpleIcon,
  PlusCircleIcon,
  TrashIcon,
  type Icon,
} from "@phosphor-icons/react";
import { useEffect, useState, type ReactNode } from "react";
import { useFloatingActionsRegistration } from "@/components/layout/floating-actions";
import { Avatar } from "@/components/ui/avatar";
import { Dialog, DialogHeader } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { Timeline } from "@/components/ui/timeline";
import { loadHistoryAction } from "../actions";
import type { HistoryAction, HistoryEntry, HistoryKind } from "../history";
import styles from "./history-dialog.module.css";

export type HistoryDialogProps = {
  open: boolean;
  onClose: () => void;
  recordType: HistoryKind;
  recordId: string;
  /** O nome do registro, na linha de apoio do título: "Camila Ferreira". */
  name: string;
};

/** O glifo e o matiz de cada ato, para a linha do tempo dizer o que aconteceu antes de a pessoa ler. */
const actions: Record<HistoryAction, { icon: Icon; hue: string }> = {
  created: { icon: PlusCircleIcon, hue: "var(--sys-green)" },
  updated: { icon: PencilSimpleIcon, hue: "var(--sys-blue)" },
  archived: { icon: ArchiveIcon, hue: "var(--sys-orange)" },
  restored: { icon: ArrowCounterClockwiseIcon, hue: "var(--sys-teal)" },
  deleted: { icon: TrashIcon, hue: "var(--sys-red)" },
};

/**
 * O histórico de um registro numa janela centrada (2026-10-27, a pedido: "faça o modal abrir ao centro da tela,
 * organize melhor e padronize o histórico"), na linha do tempo da casa: quem mexeu, o quê e quando, por dia.
 *
 * É a **mesma** janela para todo domínio, e por isso recebe o tipo e o id em vez de um cliente: a linha
 * "Histórico" existe no leque do cliente, do item de catálogo, do projeto e da automação, e uma cópia por
 * domínio sairia de sincronia na primeira coluna nova.
 *
 * A leitura acontece quando a janela **abre**, e não junto da listagem: cem entradas por cliente em vinte e
 * quatro cartões seria carregar a base para desenhar um leque.
 */
export function HistoryDialog({ open, onClose, recordType, recordId, name }: HistoryDialogProps) {
  return (
    <HistoryDrawer open={open} onClose={onClose} label={`Histórico de ${name}`} title="Histórico" description={name}>
      <History recordType={recordType} recordId={recordId} />
    </HistoryDrawer>
  );
}

export type HistoryDrawerProps = {
  open: boolean;
  onClose: () => void;
  /** O nome que o leitor de tela ouve ao abrir. */
  label: string;
  title: string;
  description?: string;
  children: ReactNode;
};

/**
 * A janela de histórico em si, sem saber de onde vêm as entradas: o registro de alterações e o de tempo de
 * uma tarefa são a mesma pergunta ("o que aconteceu aqui?") e usam a mesma peça (2026-09-22). Centrada, sólida
 * e sobre o véu desde 2026-10-27, como as outras janelas da casa; no celular, a bandeja.
 */
export function HistoryDrawer({ open, onClose, label, title, description, children }: HistoryDrawerProps) {
  return (
    <Dialog open={open} onClose={onClose} label={label} size="lg" focusOnOpen={false}>
      <DrawerBody title={title} description={description} onClose={onClose}>
        {children}
      </DrawerBody>
    </Dialog>
  );
}

function DrawerBody({ title, description, onClose, children }: { title: string; description?: string; onClose: () => void; children: ReactNode }) {
  useFloatingActionsRegistration({ cancel: { label: "Fechar", onClick: onClose } });

  return (
    <div className={styles.drawer}>
      <DialogHeader title={title} description={description} onClose={onClose} />
      <div className={styles.body}>{children}</div>
    </div>
  );
}

function History({ recordType, recordId }: Pick<HistoryDialogProps, "recordType" | "recordId">) {
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null);

  useEffect(() => {
    let alive = true;

    void loadHistoryAction({ recordType, recordId }).then((list) => {
      if (alive) setEntries(list ?? []);
    });

    return () => {
      alive = false;
    };
  }, [recordType, recordId]);

  if (entries === null) {
    return (
      <div className={styles.loading}>
        <Spinner label="Carregando o histórico" />
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <EmptyState
        icon={ClockCounterClockwiseIcon}
        size="sm"
        title="Nada registrado ainda"
        description="Toda edição passa a aparecer aqui, com quem fez e quando."
      />
    );
  }

  return (
    <Timeline
      label="Histórico do registro"
      entries={entries.map((entry) => {
        const act = actions[entry.action];
        return {
          id: entry.id,
          at: entry.at,
          icon: act.icon,
          hue: act.hue,
          title: entry.summary,
          meta: entry.actor ? (
            <>
              <Avatar name={entry.actor.name} src={entry.actor.avatarUrl ?? undefined} size="xs" />
              <Text as="span" variant="caption1" tone="secondary" truncate>
                {entry.actor.name}
              </Text>
            </>
          ) : (
            <Text as="span" variant="caption1" tone="secondary">
              Pela aplicação
            </Text>
          ),
          children:
            entry.changes.length > 0 ? (
              <dl className={styles.changes}>
                {entry.changes.map((change) => (
                  <div key={change.field} className={styles.change}>
                    <dt>
                      <Text as="span" variant="caption1" tone="secondary">
                        {change.label}
                      </Text>
                    </dt>
                    <dd>
                      <Text as="span" variant="caption1" tone="secondary" className={styles.from}>
                        {change.from ?? "vazio"}
                      </Text>
                      <Text as="span" variant="caption1" aria-hidden="true" className={styles.arrow}>
                        →
                      </Text>
                      <Text as="span" variant="caption1">
                        {change.to ?? "vazio"}
                      </Text>
                    </dd>
                  </div>
                ))}
              </dl>
            ) : undefined,
        };
      })}
    />
  );
}
