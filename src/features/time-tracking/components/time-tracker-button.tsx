"use client";

import { StopCircleIcon, TimerIcon } from "@phosphor-icons/react";
import { IconButton } from "@/components/ui/icon-button";
import { originOf, useTimeTracker } from "./time-tracker-provider";

export function TimeTrackerButton({ projectId, taskId, label }: { projectId?: string; taskId?: string; label: string }) {
  const { session, pending, start, stop } = useTimeTracker();
  /* A sessão, e não só o apontamento aberto: pausado, o cronômetro continua sendo deste alvo, e o botão
     encerra em vez de começar outro do zero. */
  const target = session?.target;
  const current = Boolean(target && (taskId ? target.taskId === taskId : projectId && target.projectId === projectId && !target.taskId));
  const title = current ? `Encerrar o tempo em ${label}` : `Iniciar o tempo em ${label}`;
  return (
    <IconButton label={title} variant="ghost" size="sm" disabled={pending} onClick={(event) => void (current ? stop() : start({ projectId, taskId }, originOf(event.currentTarget)))}>
      {current ? <StopCircleIcon weight="fill" /> : <TimerIcon />}
    </IconButton>
  );
}
