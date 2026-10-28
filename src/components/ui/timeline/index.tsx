import type { Icon } from "@phosphor-icons/react";
import { differenceInCalendarDays, format, formatDistanceStrict, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import type { CSSProperties, ReactNode } from "react";
import { Text } from "../text";
import styles from "./timeline.module.css";

export type TimelineEntry = {
  id: string;
  /** ISO com hora: o dia agrupa e a hora vai na coluna da esquerda. */
  at: string;
  icon: Icon;
  /** O matiz do ato, que pinta o ícone na trilha. */
  hue: string;
  /** O que aconteceu, em uma linha. */
  title: ReactNode;
  /** A linha de apoio embaixo do título: quem fez, por onde. */
  meta?: ReactNode;
  /** O que vier por baixo do título, como o campo a campo de uma edição. */
  children?: ReactNode;
};

/* O dia no fuso de quem lê, o mesmo da hora da coluna: pelo pedaço UTC do ISO, uma edição depois das 21h em
   Brasília caía no dia seguinte (2026-10-27, correção). */
const dayKey = (iso: string) => format(parseISO(iso), "yyyy-MM-dd");

/* O nome do dia como a pessoa fala: hoje, ontem, e daí a data com o dia da semana. */
function dayLabel(iso: string, now: Date) {
  const date = parseISO(iso);
  const days = differenceInCalendarDays(now, date);
  if (days === 0) return "Hoje";
  if (days === 1) return "Ontem";
  const label = format(date, date.getFullYear() === now.getFullYear() ? "EEEE, d 'de' MMMM" : "d 'de' MMMM 'de' yyyy", { locale: ptBR });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/**
 * A linha do tempo da casa (2026-10-27, a pedido: "padronize o histórico para toda a aplicação", sobre uma
 * referência de agenda em trilha): as entradas agrupadas por dia, cada uma com a hora numa coluna à esquerda, o
 * ícone do ato num círculo na trilha vertical, que liga uma entrada à seguinte, e à direita quem fez, o que foi
 * e o detalhe. É a mesma peça no histórico de edições de qualquer registro e na linha do tempo do contrato e da
 * cobrança, para "o que aconteceu aqui?" ler igual em toda a aplicação. Recebe as entradas já na ordem em que
 * devem aparecer, da mais nova para a mais antiga.
 *
 * Reorganizada no mesmo dia (a pedido: "ainda não ficou bem estruturado"): cada entrada abre pelo que aconteceu,
 * e embaixo vêm quem fez e há quanto tempo, numa linha só; a mais recente leva o círculo cheio no matiz do ato,
 * que é o "agora" da trilha.
 */
export function Timeline({ entries, label, now = new Date() }: { entries: readonly TimelineEntry[]; label: string; now?: Date }) {
  if (entries.length === 0) return null;
  const latest = entries[0].id;

  /* Uma lista só, com o nome de cada dia novo entre as entradas: o fio corre por todas sem parar no fim do dia,
     e o nome do dia fica ao lado dele (2026-10-27, correção: "a linha nem se conecta direito", quando cada dia
     era uma lista e o fio recomeçava a cada uma). O primeiro dia abre a lista por cima, fora do fio. */
  const rows: ({ kind: "day"; key: string; label: string } | { kind: "entry"; entry: TimelineEntry })[] = [];
  let previous = dayKey(entries[0].at);
  for (const entry of entries) {
    const key = dayKey(entry.at);
    if (key !== previous) rows.push({ kind: "day", key, label: dayLabel(entry.at, now) });
    rows.push({ kind: "entry", entry });
    previous = key;
  }

  return (
    <div className={styles.timeline} aria-label={label}>
      <Text as="h3" variant="footnote" weight="semibold" className={styles.dayLabel}>
        {dayLabel(entries[0].at, now)}
      </Text>
      <ol className={styles.entries}>
        {rows.map((row) =>
          row.kind === "day" ? (
            <li key={`dia-${row.key}`} className={styles.dayRow}>
              <Text as="h3" variant="footnote" weight="semibold" className={styles.dayName}>
                {row.label}
              </Text>
            </li>
          ) : (
            <TimelineRow key={row.entry.id} entry={row.entry} latest={row.entry.id === latest} now={now} />
          ),
        )}
      </ol>
    </div>
  );
}

function TimelineRow({ entry, latest, now }: { entry: TimelineEntry; latest: boolean; now: Date }) {
  const { at, icon: Glyph, hue, title, meta, children } = entry;
  return (
    <li className={styles.entry} data-latest={latest || undefined}>
      <time className={styles.time} dateTime={at}>
        {format(parseISO(at), "HH:mm")}
      </time>
      <span className={styles.node} style={{ "--tone": hue } as CSSProperties} aria-hidden="true">
        <Glyph weight="duotone" />
      </span>
      <div className={styles.content}>
        <Text as="p" variant="subheadline" weight="semibold" className={styles.title}>
          {title}
        </Text>
        <div className={styles.meta}>
          {meta}
          <span className={styles.ago} title={format(parseISO(at), "d 'de' MMMM 'de' yyyy, HH:mm", { locale: ptBR })}>
            há {formatDistanceStrict(parseISO(at), now, { locale: ptBR })}
          </span>
        </div>
        {children}
      </div>
    </li>
  );
}
