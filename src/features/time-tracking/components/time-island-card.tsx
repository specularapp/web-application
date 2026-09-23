"use client";

import styled from "@emotion/styled";
import { PauseIcon, PlayIcon, StopIcon, TimerIcon } from "@phosphor-icons/react";
import { formatClock } from "../summary";
import { useTaskTime } from "./task-time";
import { TimeAction, TimeActions, TimeChart, TimeClock, TimeMark, TimeSmall, useTimePeriod } from "./time-chart";
import { useTimeTracker, useTimerSeconds } from "./time-tracker-provider";

/**
 * A ilha aberta no desenho de widget (2026-09-22, a pedido, sobre a referência de um widget de cotação): no
 * topo, de quem é o tempo e quanto já passou; no meio, as barras dos últimos catorze dias naquela tarefa, com
 * a de hoje acesa e crescendo enquanto o cronômetro corre; embaixo, pausar e encerrar. As barras e os botões
 * são os mesmos do bloco de tempo da ficha.
 */

const timeOfDay = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });

const Wrap = styled.div`
  display: grid;
  gap: var(--space-4);
  padding: var(--space-4);
`;

/* O topo inteiro é o botão de recolher: tocar no nome ou no tempo fecha a ilha de volta na pílula. */
const Head = styled.button`
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-3);
  padding: 0;
  color: inherit;
  font: inherit;
  text-align: start;
  background: none;
  border: 0;
  border-radius: var(--radius-md);
  cursor: pointer;

  &:focus-visible {
    outline: 2px solid var(--color-focus);
    outline-offset: 4px;
  }
`;

const Name = styled.span`
  display: grid;
  min-width: 0;
`;

const Stamp = styled.span`
  display: grid;
  justify-items: end;
`;

const Title = styled.span`
  overflow: hidden;
  font-size: var(--text-headline);
  font-weight: var(--weight-semibold);
  line-height: var(--leading-tight);
  text-overflow: ellipsis;
  white-space: nowrap;
`;

export function TimeIslandCard({ onCollapse }: { onCollapse: () => void }) {
  const { active, session, pending, pause, resume, stop } = useTimeTracker();
  const seconds = useTimerSeconds();
  const taskId = session?.target.taskId ?? "";
  const { entries } = useTaskTime(taskId);
  const period = useTimePeriod();

  if (!session) return null;

  const paused = session.paused;
  /* O que o trecho aberto já somou: o mostrador conta a sessão inteira, e os trechos fechados já estão nas
     entradas do registro. */
  const running = active ? Math.max(0, seconds - session.carried) : 0;

  return (
    <Wrap>
      <Head type="button" aria-label="Recolher o cronômetro" onClick={onCollapse}>
        <TimeMark aria-hidden="true">
          <TimerIcon weight="fill" />
        </TimeMark>
        <Name>
          <TimeSmall>{session.reference ?? "Tempo"}</TimeSmall>
          <Title>{session.title}</Title>
        </Name>
        <Stamp>
          <TimeSmall>{paused ? "pausado" : `desde ${timeOfDay.format(new Date(session.since))}`}</TimeSmall>
          <TimeClock aria-live="off">{formatClock(seconds)}</TimeClock>
        </Stamp>
      </Head>

      {taskId && <TimeChart entries={entries} running={running} period={period} />}

      <TimeActions>
        <TimeAction type="button" disabled={pending} onClick={() => void (paused ? resume() : pause())}>
          {paused ? <PlayIcon weight="fill" aria-hidden="true" /> : <PauseIcon weight="fill" aria-hidden="true" />}
          {paused ? "Retomar" : "Pausar"}
        </TimeAction>
        <TimeAction type="button" data-tone="danger" disabled={pending} onClick={() => void stop()}>
          <StopIcon weight="fill" aria-hidden="true" />
          Encerrar
        </TimeAction>
      </TimeActions>
    </Wrap>
  );
}
