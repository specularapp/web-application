"use client";

import { CalendarBlankIcon, ClockCounterClockwiseIcon, ClockIcon, ListNumbersIcon, TimerIcon } from "@phosphor-icons/react";
import { formatDistanceToNowStrict } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { DetailsDialog } from "@/components/ui/details-dialog";
import { HoverCard, HoverCardFact, HoverCardFacts, HoverCardHead, HoverCardNaming, HoverCardRule } from "@/components/ui/hover-card";
import { Text } from "@/components/ui/text";
import { MOBILE_QUERY, useMediaQuery } from "@/hooks/use-media-query";
import { callAction } from "@/lib/action";
import { loadTaskTimeAction } from "../actions";
import { durationLabel, formatClock, type TimeEntry } from "../summary";
import { TimeMark } from "./time-chart";
import { useTimeTracker, useTimerSeconds } from "./time-tracker-provider";
import styles from "./task-time.module.css";

/**
 * O tempo de uma tarefa, como a ficha dela mostra (2026-09-22, a pedido: "o registro do timer precisa ficar
 * dentro da tarefa"). Lê do banco ao abrir e soma o que fechou nesta página sem reler, pelo que o cronômetro
 * já guarda. Só aparece o que é de quem está vendo: a RLS dos apontamentos é por pessoa.
 */
export function useTaskTime(taskId: string) {
  const { active, session, finished, pending, start, stop } = useTimeTracker();
  const [loaded, setLoaded] = useState<TimeEntry[]>([]);

  useEffect(() => {
    if (!taskId) return;
    let alive = true;
    void callAction(loadTaskTimeAction({ taskId })).then((result) => {
      if (alive && result.ok) setLoaded(result.data);
    });
    return () => {
      alive = false;
    };
  }, [taskId]);

  const known = new Set(loaded.map((entry) => entry.id));
  const entries = [...finished.filter((entry) => entry.taskId === taskId && !known.has(entry.id)), ...loaded].filter(
    (entry) => entry.stoppedAt !== null,
  );
  const running = active?.taskId === taskId ? active : null;
  /* "Em andamento aqui" inclui a pausa: a sessão ainda é desta tarefa, só está parada. */
  const current = Boolean(running || (session && session.target.taskId === taskId));

  return { entries, running, current, pending, start, stop };
}

const dayFormat = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short" });
const hourFormat = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });

const sum = (entries: TimeEntry[]) => entries.reduce((total, entry) => total + (entry.durationSeconds ?? 0), 0);

/* O dia no fuso de quem vê, como chave: "2026-09-22". */
const dayKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

/** Quantos trechos o cartão lista: os mais recentes, que é o que se quer conferir de relance. */
const SHOWN_ENTRIES = 4;

function LiveClock({ className }: { className?: string }) {
  const seconds = useTimerSeconds();
  return <span className={className}>{formatClock(seconds)}</span>;
}

/** O cartão que abre colado na etiqueta: o total no topo, os fatos do tempo e os últimos trechos. */
function TimeSummary({ entries, running, today }: { entries: TimeEntry[]; running: TimeEntry | null; today: string }) {
  const total = sum(entries);
  const todayTotal = sum(entries.filter((entry) => dayKey(new Date(entry.startedAt)) === today));
  const last = entries[0];

  return (
    <>
      <HoverCardHead>
        <TimeMark aria-hidden="true">
          <TimerIcon weight="fill" />
        </TimeMark>
        <HoverCardNaming>
          <Text as="strong" variant="subheadline" weight="semibold">
            {running ? <LiveClock className={styles.live} /> : durationLabel(total)}
          </Text>
          <Text variant="footnote" tone="secondary">
            {running ? `Correndo desde ${hourFormat.format(new Date(running.startedAt))}` : "Tempo registrado por você"}
          </Text>
        </HoverCardNaming>
      </HoverCardHead>

      <HoverCardFacts>
        <HoverCardFact icon={ClockIcon}>Total de {durationLabel(total)}</HoverCardFact>
        <HoverCardFact icon={CalendarBlankIcon}>Hoje, {durationLabel(todayTotal)}</HoverCardFact>
        <HoverCardFact icon={ListNumbersIcon}>
          {entries.length} {entries.length === 1 ? "trecho" : "trechos"}
        </HoverCardFact>
        {last?.stoppedAt && (
          <HoverCardFact icon={ClockCounterClockwiseIcon}>
            Último há {formatDistanceToNowStrict(new Date(last.stoppedAt), { locale: ptBR })}
          </HoverCardFact>
        )}
      </HoverCardFacts>

      {entries.length > 0 && (
        <>
          <HoverCardRule />
          <ul className={styles.entries}>
            {entries.slice(0, SHOWN_ENTRIES).map((entry) => (
              <li key={entry.id} className={styles.entry}>
                <Text as="span" variant="footnote" tone="secondary" className={styles.number}>
                  {dayFormat.format(new Date(entry.startedAt))}, {hourFormat.format(new Date(entry.startedAt))} às{" "}
                  {entry.stoppedAt ? hourFormat.format(new Date(entry.stoppedAt)) : ""}
                </Text>
                <Text as="span" variant="footnote" weight="semibold" className={styles.number}>
                  {durationLabel(entry.durationSeconds ?? 0)}
                </Text>
              </li>
            ))}
          </ul>
          {entries.length > SHOWN_ENTRIES && (
            <Text variant="caption1" tone="tertiary">
              E mais {entries.length - SHOWN_ENTRIES} {entries.length - SHOWN_ENTRIES === 1 ? "trecho" : "trechos"}
            </Text>
          )}
        </>
      )}
    </>
  );
}

/**
 * O tempo da tarefa como uma propriedade da ficha (2026-09-22, a pedido: "integrada direto nas informações,
 * com badge, apenas com o total"): a etiqueta com o total que a pessoa registrou, e, com o cronômetro
 * correndo nesta tarefa, o tempo andando no laranja do cronômetro. Tocar abre, colado nela, o cartão com o
 * resumo e os últimos trechos (a pedido, no lugar da gaveta lateral). Iniciar e encerrar ficam no topo da
 * ficha e, no celular, na barra flutuante.
 */
export function TaskTimeBadge({ entries, running, current }: { entries: TimeEntry[]; running: TimeEntry | null; current: boolean }) {
  const [today] = useState(() => dayKey(new Date()));
  const [open, setOpen] = useState(false);
  const mobile = useMediaQuery(MOBILE_QUERY);
  const total = sum(entries);
  const summary = <TimeSummary entries={entries} running={running} today={today} />;

  const label = current ? (
    <Badge size="md" hue="var(--sys-orange)" icon={<TimerIcon weight="fill" />}>
      <LiveClock className={styles.number} />
    </Badge>
  ) : total > 0 ? (
    <Badge size="md" tone="neutral" icon={<TimerIcon />}>
      {durationLabel(total)}
    </Badge>
  ) : (
    <Text as="span" variant="subheadline" tone="tertiary">
      Nenhum
    </Text>
  );

  /* No celular o resumo abre na bandeja de baixo, a janela de detalhes da casa, e não colado na etiqueta: no
     dedo um cartão flutuante ao lado do valor cobre o que está em volta e não tem como ser lido inteiro. */
  if (mobile) {
    return (
      <>
        <button type="button" className={styles.trigger} aria-label="Ver o resumo do tempo da tarefa" onClick={() => setOpen(true)}>
          {label}
        </button>
        <DetailsDialog open={open} onClose={() => setOpen(false)} label="Tempo da tarefa">
          <div className={styles.sheet}>{summary}</div>
        </DetailsDialog>
      </>
    );
  }

  return (
    <HoverCard openOnClick inline width={300} height={320} content={summary}>
      <button type="button" className={styles.trigger} aria-label="Ver o resumo do tempo da tarefa">
        {label}
      </button>
    </HoverCard>
  );
}
