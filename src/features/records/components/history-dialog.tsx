"use client";

import {
  ArrowCounterClockwiseIcon,
  ArchiveIcon,
  ClockCounterClockwiseIcon,
  PencilSimpleIcon,
  PlusCircleIcon,
  TrashIcon,
  XIcon,
  type Icon,
} from "@phosphor-icons/react";
import { format, formatDistanceToNowStrict, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import { useEffect, useState, type CSSProperties } from "react";
import { useFloatingActionsRegistration } from "@/components/layout/floating-actions";
import { Avatar } from "@/components/ui/avatar";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { IconButton } from "@/components/ui/icon-button";
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
  const mobile = useMediaQuery(MOBILE_QUERY);

  return (
    <Dialog open={open} onClose={onClose} label={`Histórico de ${name}`} size="md" placement="end" scrim={mobile} focusOnOpen={false}>
      <History recordType={recordType} recordId={recordId} name={name} onClose={onClose} />
    </Dialog>
  );
}

function History({ recordType, recordId, name, onClose }: Omit<HistoryDialogProps, "open">) {
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null);

  useFloatingActionsRegistration({ cancel: { label: "Fechar", onClick: onClose } });

  useEffect(() => {
    let alive = true;

    void loadHistoryAction({ recordType, recordId }).then((list) => {
      if (alive) setEntries(list ?? []);
    });

    return () => {
      alive = false;
    };
  }, [recordType, recordId]);

  return (
    <div className={styles.drawer}>
      <header className={styles.head}>
        <div className={styles.heading}>
          <Text as="h2" variant="headline" weight="semibold">
            Histórico
          </Text>
          <Text variant="footnote" tone="secondary" truncate>
            {name}
          </Text>
        </div>
        <IconButton label="Fechar" variant="ghost" size="sm" onClick={onClose}>
          <XIcon />
        </IconButton>
      </header>

      <div className={styles.body}>
        {entries === null ? (
          <div className={styles.loading}>
            <Spinner label="Carregando o histórico" />
          </div>
        ) : entries.length === 0 ? (
          <EmptyState
            icon={ClockCounterClockwiseIcon}
            size="sm"
            title="Nada registrado ainda"
            description="Toda edição passa a aparecer aqui, com quem fez e quando."
          />
        ) : (
          <ol className={styles.entries}>
            {entries.map((entry) => {
              const act = actions[entry.action];

              return (
                <li key={entry.id} className={styles.entry}>
                  {/* A trilha: o glifo do ato e o fio que desce até o próximo, que é o que faz a lista virar linha do tempo. */}
                  <span className={styles.rail} aria-hidden="true">
                    <span className={styles.glyph} style={{ "--act-hue": act.hue } as CSSProperties}>
                      <act.icon weight="duotone" />
                    </span>
                  </span>

                  <div className={styles.copy}>
                    <div className={styles.line}>
                      <Text as="span" variant="footnote" weight="semibold">
                        {entry.summary}
                      </Text>
                      <Text as="span" variant="caption1" tone="secondary" title={exactLabel(entry.at)}>
                        {agoLabel(entry.at)}
                      </Text>
                    </div>

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
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}
