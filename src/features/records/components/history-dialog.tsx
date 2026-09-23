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
import { format, formatDistanceToNowStrict, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { useFloatingActionsRegistration } from "@/components/layout/floating-actions";
import { Avatar } from "@/components/ui/avatar";
import { Dialog, DialogHeader } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { MOBILE_QUERY, useMediaQuery } from "@/hooks/use-media-query";
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

const agoLabel = (iso: string) => `há ${formatDistanceToNowStrict(parseISO(iso), { locale: ptBR })}`;
const exactLabel = (iso: string) => format(parseISO(iso), "d 'de' MMM. 'de' yyyy, HH:mm", { locale: ptBR });

/**
 * O histórico de um registro, na gaveta lateral: quem mexeu, o quê e quando.
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
 * A gaveta de histórico em si, sem saber de onde vêm as entradas: o registro de alterações e o de tempo de
 * uma tarefa são a mesma pergunta ("o que aconteceu aqui?") e usam a mesma peça (2026-09-22).
 */
export function HistoryDrawer({ open, onClose, label, title, description, children }: HistoryDrawerProps) {
  const mobile = useMediaQuery(MOBILE_QUERY);

  return (
    <Dialog open={open} onClose={onClose} label={label} size="md" placement="end" scrim={mobile} focusOnOpen={false}>
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

/** A linha do tempo: uma lista ordenada de `HistoryItem`. */
export function HistoryTimeline({ children }: { children: ReactNode }) {
  return <ol className={styles.entries}>{children}</ol>;
}

/** Uma entrada da linha do tempo: o glifo no matiz do ato, o que aconteceu, quando, e o que vier por baixo. */
export function HistoryItem({ icon: Glyph, hue, title, when, whenTitle, children }: { icon: Icon; hue: string; title: ReactNode; when: ReactNode; whenTitle?: string; children?: ReactNode }) {
  return (
    <li className={styles.entry}>
      {/* A trilha: o glifo do ato e o fio que desce até o próximo, que é o que faz a lista virar linha do tempo. */}
      <span className={styles.rail} aria-hidden="true">
        <span className={styles.glyph} style={{ "--act-hue": hue } as CSSProperties}>
          <Glyph weight="duotone" />
        </span>
      </span>

      <div className={styles.copy}>
        <div className={styles.line}>
          <Text as="span" variant="footnote" weight="semibold">
            {title}
          </Text>
          <Text as="span" variant="caption1" tone="secondary" title={whenTitle}>
            {when}
          </Text>
        </div>
        {children}
      </div>
    </li>
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
    <HistoryTimeline>
      {entries.map((entry) => {
        const act = actions[entry.action];

        return (
          <HistoryItem key={entry.id} icon={act.icon} hue={act.hue} title={entry.summary} when={agoLabel(entry.at)} whenTitle={exactLabel(entry.at)}>
            <div className={styles.actor}>
              {entry.actor ? (
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
              )}
            </div>

            {entry.changes.length > 0 && (
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
            )}
          </HistoryItem>
        );
      })}
    </HistoryTimeline>
  );
}
