"use client";

import styled from "@emotion/styled";
import { CaretLeftIcon, CaretRightIcon, ExclamationMarkIcon, XIcon } from "@phosphor-icons/react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  getISODay,
  isAfter,
  isBefore,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  subMonths,
} from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import Image from "next/image";
import { useState } from "react";
import { IconButton } from "@/components/ui/icon-button";
import { popIn } from "@/components/ui/styles";
import { Text } from "@/components/ui/text";
import { VisuallyHidden } from "@/components/ui/visually-hidden";
import type { ChallengeDay, WeeklyChallenge } from "../summary";

export type StreakSheetProps = { challenge: WeeklyChallenge };

/** Como o dia terminou frente à meta: batida, com uso mas abaixo dela, sem uso, ou ainda por vir. */
type DayState = "met" | "partial" | "missed" | "upcoming" | "none";

const weekdayLabels = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const weekdayShort = ["S", "T", "Q", "Q", "S", "S", "D"];

const number = new Intl.NumberFormat("pt-BR");

const stateLabels: Record<DayState, string> = {
  met: "meta batida",
  partial: "abaixo da meta",
  missed: "sem acesso",
  upcoming: "ainda por vir",
  none: "antes do primeiro acesso",
};

/* Três matizes chapados, os mesmos das etiquetas: verde para a meta batida, laranja para o dia parcial e
   vermelho para o dia perdido. Hoje se destaca na cor do texto, como no calendário da casa. */
const Sheet = styled.div`
  --met: var(--color-success);
  --partial: var(--color-warning);
  --missed: var(--color-danger);
  display: grid;
  gap: var(--space-5);
  padding: var(--space-6) var(--space-5) var(--space-5);
`;

/* A semana em curso numa fila de sete: o dia em cima, apagado, e embaixo a chama nos dias com a meta
   batida, o ponto de exclamação nos parciais, o X nos perdidos e um círculo tracejado com o número do
   dia nos que ainda vêm. */
const Week = styled.ol`
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: var(--space-1);
  padding: 0;
  margin: 0;
  list-style: none;
`;

const WeekDay = styled.li`
  display: grid;
  gap: var(--space-2);
  justify-items: center;
`;

const Mark = styled.span`
  display: grid;
  place-items: center;
  width: 2rem;
  height: 2rem;
  font-size: var(--text-caption-1);
  font-weight: var(--weight-medium);
  color: var(--color-on-accent);
  border-radius: var(--radius-full);

  &[data-state="partial"] {
    background-color: var(--partial);
  }

  &[data-state="missed"] {
    background-color: var(--missed);
  }

  &[data-state="upcoming"] {
    color: var(--color-label-tertiary);
    border: 1.5px dashed var(--color-label-quaternary);
  }

  & svg {
    width: 1rem;
    height: 1rem;
  }

  & img {
    width: auto;
    height: 1.75rem;
  }
`;

/* A chama grande com os dias seguidos por baixo, em número bem grande, entrando com a mola curta. */
const Hero = styled.div`
  --slide: 10px;
  display: grid;
  gap: var(--space-2);
  justify-items: center;
  padding-block: var(--space-4) var(--space-2);
  text-align: center;
  animation: ${popIn} var(--duration-slow) var(--ease-spring) both;

  & img {
    width: auto;
    height: 6rem;
    filter: drop-shadow(0 12px 24px color-mix(in oklab, var(--sys-orange) 35%, transparent));
  }

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

const Count = styled.span`
  font-size: 4rem;
  font-weight: var(--weight-semibold);
  line-height: 1;
  letter-spacing: var(--tracking-tightest);
  color: var(--color-label);
`;

/* O calendário num cartão com o preenchimento da casa: setas e o mês em cima, os dias da semana, e a
   grade de sete colunas com o número e um ponto colorido embaixo. Hoje ganha a pílula na cor do texto. */
const Calendar = styled.div`
  display: grid;
  gap: var(--space-3);
  padding: var(--space-4);
  background-color: var(--color-fill-quaternary);
  border-radius: var(--radius-lg);
  corner-shape: squircle;
`;

const MonthBar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const Grid = styled.ol`
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: var(--space-1) 0;
  padding: 0;
  margin: 0;
  list-style: none;
`;

const Heading = styled.li`
  font-size: var(--text-caption-1);
  font-weight: var(--weight-medium);
  color: var(--color-label-secondary);
  text-align: center;
`;

const Day = styled.li`
  display: grid;
  gap: 0.125rem;
  justify-items: center;
  min-height: 2.75rem;
  padding-block-start: var(--space-1);
  font-size: var(--text-footnote);
  font-weight: var(--weight-medium);
  color: var(--color-label);
  border-radius: var(--radius-md);
  corner-shape: squircle;

  &[data-state="upcoming"],
  &[data-state="none"] {
    color: var(--color-label-tertiary);
  }

  &[data-today] {
    color: var(--color-bg);
    background-color: var(--color-label);
  }
`;

const Dot = styled.span`
  width: 0.375rem;
  height: 0.375rem;
  border-radius: var(--radius-full);

  &[data-state="met"] {
    background-color: var(--met);
  }

  &[data-state="partial"] {
    background-color: var(--partial);
  }

  &[data-state="missed"] {
    background-color: var(--missed);
  }
`;

const Legend = styled.ul`
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2) var(--space-4);
  justify-content: center;
  padding: 0;
  margin: 0;
  list-style: none;
`;

const LegendItem = styled.li`
  display: inline-flex;
  gap: var(--space-2);
  align-items: center;
  font-size: var(--text-caption-1);
  color: var(--color-label-secondary);
`;

function stateOf(day: ChallengeDay | undefined, date: Date, today: Date, since: Date, goal: number): DayState {
  if (isAfter(date, today) && !isSameDay(date, today)) return "upcoming";
  if (isBefore(date, since) && !isSameDay(date, since)) return "none";
  if (!day || day.onlineMinutes === 0) return "missed";
  return day.onlineMinutes >= goal ? "met" : "partial";
}

const monthTitle = (date: Date) => {
  const name = format(date, "MMMM 'de' yyyy", { locale: ptBR });
  return name.charAt(0).toUpperCase() + name.slice(1);
};

// A sequência inteira, na pegada da referência: a semana em curso com uma marca por dia, a chama grande
// com os dias seguidos, e o calendário mês a mês, do primeiro acesso até hoje, com um ponto por dia
// dizendo se a meta foi batida, ficou pela metade ou não houve acesso. Client Component pela troca de
// mês; o histórico vem pronto por prop.
export function StreakSheet({ challenge }: StreakSheetProps) {
  const today = new Date();
  const since = parseISO(challenge.since);
  const goal = challenge.dailyGoalMinutes;
  const byDate = new Map(challenge.history.map((day) => [day.date, day]));
  const firstMonth = startOfMonth(since);
  const lastMonth = startOfMonth(today);
  const [month, setMonth] = useState(lastMonth);

  const days = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) });
  const leading = getISODay(days[0] ?? month) - 1;
  const canGoBack = isAfter(month, firstMonth);
  const canGoForward = isBefore(month, lastMonth);

  return (
    <Sheet>
      <Text as="h2" variant="title3" weight="semibold">
        Sequência
      </Text>

      <Week aria-label="Semana em curso">
        {challenge.days.map((day) => {
          const date = parseISO(day.date);
          const state = stateOf(day, date, today, since, goal);
          return (
            <WeekDay key={day.date}>
              <Text as="span" variant="caption1" tone="secondary" aria-hidden="true">
                {weekdayLabels[getISODay(date) - 1]}
              </Text>
              <VisuallyHidden>{`${format(date, "EEEE, d 'de' MMMM", { locale: ptBR })}: ${stateLabels[state]}`}</VisuallyHidden>
              <Mark data-state={state} aria-hidden="true">
                {state === "met" && <Image src="/bg/fire-streak.png" alt="" width={331} height={455} sizes="28px" />}
                {state === "partial" && <ExclamationMarkIcon weight="bold" />}
                {state === "missed" && <XIcon weight="bold" />}
                {state === "upcoming" && format(date, "d")}
              </Mark>
            </WeekDay>
          );
        })}
      </Week>

      <Hero>
        <Image src="/bg/fire-streak.png" alt="" width={331} height={455} sizes="96px" priority />
        <Count>{number.format(challenge.streakDays)}</Count>
        <Text variant="subheadline" tone="secondary">
          {challenge.streakDays === 1 ? "dia seguido" : "dias seguidos"} na plataforma
        </Text>
      </Hero>

      <Calendar>
        <MonthBar>
          <IconButton label="Mês anterior" variant="ghost" size="sm" disabled={!canGoBack} onClick={() => setMonth((current) => subMonths(current, 1))}>
            <CaretLeftIcon weight="bold" />
          </IconButton>
          <Text as="span" variant="subheadline" weight="semibold" aria-live="polite">
            {monthTitle(month)}
          </Text>
          <IconButton label="Próximo mês" variant="ghost" size="sm" disabled={!canGoForward} onClick={() => setMonth((current) => addMonths(current, 1))}>
            <CaretRightIcon weight="bold" />
          </IconButton>
        </MonthBar>

        <Grid aria-label={`Dias de ${monthTitle(month)}`}>
          {weekdayShort.map((label, index) => (
            <Heading key={index} aria-hidden="true">
              {label}
            </Heading>
          ))}
          {Array.from({ length: leading }, (_, index) => (
            <li key={`pad-${index}`} aria-hidden="true" />
          ))}
          {days.map((date) => {
            const dayKey = format(date, "yyyy-MM-dd");
            const state = stateOf(byDate.get(dayKey), date, today, since, goal);
            const isToday = isSameDay(date, today);
            return (
              <Day key={dayKey} data-state={state} data-today={isToday || undefined} aria-label={`${format(date, "d 'de' MMMM", { locale: ptBR })}: ${stateLabels[state]}`}>
                <span aria-hidden="true">{format(date, "d")}</span>
                <Dot data-state={state} aria-hidden="true" />
              </Day>
            );
          })}
        </Grid>

        <Legend aria-hidden="true">
          <LegendItem>
            <Dot data-state="met" />
            Meta batida
          </LegendItem>
          <LegendItem>
            <Dot data-state="partial" />
            Abaixo da meta
          </LegendItem>
          <LegendItem>
            <Dot data-state="missed" />
            Sem acesso
          </LegendItem>
        </Legend>
      </Calendar>

      {!isSameMonth(month, lastMonth) && (
        <VisuallyHidden aria-live="polite">{`Mostrando ${monthTitle(month)}`}</VisuallyHidden>
      )}
    </Sheet>
  );
}
