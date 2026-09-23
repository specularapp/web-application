"use client";

import styled from "@emotion/styled";
import { useState } from "react";
import { durationLabel, type TimeEntry } from "../summary";

/**
 * As barras de tempo por dia e os botões do cronômetro, num lugar só (2026-09-22): a ilha aberta e o bloco de
 * tempo da ficha da tarefa desenham a mesma coisa, e uma cópia em cada um sairia de medida na primeira mexida.
 */

/** Quantos dias o gráfico mostra: duas semanas cabem na largura com barra que ainda se lê. */
export const TIME_DAYS = 14;

/* A inicial do dia da semana, de domingo a sábado. */
const LETTERS = ["D", "S", "T", "Q", "Q", "S", "S"];

const dayKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const dayName = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long" });

export type TimePeriod = { days: { key: string; letter: string; name: string }[]; today: string };

/** Os últimos catorze dias a partir de hoje, contados uma vez ao montar: ninguém fica com a tela aberta de um dia para o outro. */
export function useTimePeriod(): TimePeriod {
  const [period] = useState(() => {
    const now = new Date();
    const days = Array.from({ length: TIME_DAYS }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (TIME_DAYS - 1 - index));
      return { key: dayKey(date), letter: LETTERS[date.getDay()], name: dayName.format(date) };
    });
    return { days, today: dayKey(now) };
  });
  return period;
}

/** O tempo de cada dia do período, com o trecho em andamento somado a hoje. */
export function totalsOf(entries: TimeEntry[], period: TimePeriod, running: number) {
  const totals = new Map(period.days.map((day) => [day.key, 0]));
  for (const entry of entries) {
    const key = dayKey(new Date(entry.startedAt));
    if (totals.has(key)) totals.set(key, (totals.get(key) ?? 0) + (entry.durationSeconds ?? 0));
  }
  totals.set(period.today, (totals.get(period.today) ?? 0) + running);
  return totals;
}

/* Uma barra por dia: um trilho em pílula com o tempo do dia enchendo de baixo para cima, e a inicial do dia
   embaixo. A escala é o maior dia do período, então o dia mais trabalhado toca o topo. */
const Chart = styled.div`
  display: grid;
  grid-template-columns: repeat(${TIME_DAYS}, minmax(0, 1fr));
  gap: var(--space-1);
`;

const Column = styled.span`
  display: grid;
  gap: var(--space-2);
  justify-items: center;
`;

const Track = styled.span`
  position: relative;
  display: block;
  width: 0.5rem;
  height: 4.5rem;
  overflow: hidden;
  background-color: var(--color-fill-secondary);
  border-radius: var(--radius-full);
`;

const Fill = styled.span`
  position: absolute;
  inset-inline: 0;
  inset-block-end: 0;
  background-color: var(--color-label-tertiary);
  border-radius: var(--radius-full);
  transition: height var(--duration-base) var(--ease-settle);

  &[data-today] {
    background-color: var(--sys-orange);
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

const Letter = styled.span`
  font-size: var(--text-caption-2);
  font-weight: var(--weight-medium);
  color: var(--color-label-tertiary);

  &[data-today] {
    color: var(--color-label);
  }
`;

export function TimeChart({ entries, running, period }: { entries: TimeEntry[]; running: number; period: TimePeriod }) {
  const totals = totalsOf(entries, period, running);
  const peak = Math.max(...totals.values(), 1);
  const summary = period.days
    .filter((day) => (totals.get(day.key) ?? 0) > 0)
    .map((day) => `${day.name}: ${durationLabel(totals.get(day.key) ?? 0)}`)
    .join(", ");

  return (
    <Chart role="img" aria-label={summary ? `Tempo nesta tarefa nos últimos ${TIME_DAYS} dias. ${summary}` : `Sem tempo nesta tarefa nos últimos ${TIME_DAYS} dias`}>
      {period.days.map((day) => {
        const value = totals.get(day.key) ?? 0;
        const today = day.key === period.today;
        return (
          <Column key={day.key} aria-hidden="true">
            <Track>
              <Fill data-today={today || undefined} style={{ height: value > 0 ? `max(0.25rem, ${(value / peak) * 100}%)` : 0 }} />
            </Track>
            <Letter data-today={today || undefined}>{day.letter}</Letter>
          </Column>
        );
      })}
    </Chart>
  );
}

/** Os botões do cronômetro: lado a lado, em pílula, e o de encerrar no tom de perigo. */
export const TimeActions = styled.div`
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(0, 1fr);
  gap: var(--space-2);
`;

export const TimeAction = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  min-height: var(--touch-target);
  padding-inline: var(--space-4);
  font: inherit;
  font-size: var(--text-subheadline);
  font-weight: var(--weight-semibold);
  color: var(--color-label);
  background-color: var(--color-fill-secondary);
  border: 0;
  border-radius: var(--radius-full);
  cursor: pointer;
  transition: background-color var(--duration-fast) var(--ease-standard);

  & svg {
    width: 1rem;
    height: 1rem;
  }

  &[data-tone="start"] {
    color: var(--sys-orange);
    background-color: color-mix(in oklab, var(--sys-orange) 18%, transparent);
  }

  &[data-tone="danger"] {
    color: var(--color-danger);
    background-color: color-mix(in oklab, var(--color-danger) 22%, transparent);
  }

  &:disabled {
    opacity: 0.5;
    cursor: wait;
  }

  &:focus-visible {
    outline: 2px solid var(--color-focus);
    outline-offset: 2px;
  }

  @media (hover: hover) {
    &:hover:not(:disabled) {
      background-color: var(--color-fill);
    }

    &[data-tone="start"]:hover:not(:disabled) {
      background-color: color-mix(in oklab, var(--sys-orange) 28%, transparent);
    }

    &[data-tone="danger"]:hover:not(:disabled) {
      background-color: color-mix(in oklab, var(--color-danger) 32%, transparent);
    }
  }
`;

/* O azulejo, o texto pequeno e o relógio do topo do cronômetro, iguais na ilha e na ficha. */
export const TimeMark = styled.span`
  display: grid;
  place-items: center;
  width: 2.25rem;
  height: 2.25rem;
  color: var(--sys-orange);
  background-color: color-mix(in oklab, var(--sys-orange) 20%, transparent);
  border-radius: var(--radius-md);

  & svg {
    width: 1.25rem;
    height: 1.25rem;
  }
`;

export const TimeSmall = styled.span`
  font-size: var(--text-caption-1);
  color: var(--color-label-secondary);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
`;

export const TimeClock = styled.span`
  font-size: var(--text-headline);
  font-weight: var(--weight-semibold);
  line-height: var(--leading-tight);
  color: var(--sys-orange);
  font-variant-numeric: tabular-nums;

  &[data-idle],
  [data-paused] & {
    color: var(--color-label);
  }
`;
