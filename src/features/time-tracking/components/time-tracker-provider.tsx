"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useToast } from "@/components/providers/toast-provider";
import { callAction } from "@/lib/action";
import { startTimerAction, stopTimerAction } from "../actions";
import { durationLabel, type TimeEntry, type TimerPosition } from "../summary";
import { TimeIsland } from "./time-island";

type StartTarget = { projectId?: string; taskId?: string; note?: string };

/** De onde o cronômetro foi ligado, para a ilha subir dali até o topo. */
export type TimerOrigin = { left: number; top: number; width: number; height: number };

/**
 * O que a ilha acompanha, além do apontamento aberto: o alvo e o tempo dos trechos anteriores. Pausar
 * **fecha** o apontamento, porque o banco guarda um cronômetro ativo por pessoa e o que já passou precisa
 * estar gravado; retomar abre outro no mesmo alvo. A sessão soma os trechos para o mostrador não voltar a
 * zero a cada pausa. Vive só na tela: ao recarregar, o que sobra é o apontamento aberto, se houver.
 */
export type TimerSession = {
  target: StartTarget;
  title: string;
  reference: string | null;
  /** Quando a sessão começou, no primeiro trecho: é o "desde" que a ilha mostra. */
  since: string;
  /** Segundos dos trechos já fechados nesta sessão. */
  carried: number;
  paused: boolean;
  /** O lançamento em curso: muda a cada início, e é o que dispara a entrada da ilha com o véu de foco. */
  launch?: { id: number; origin: TimerOrigin | null };
};

type ContextValue = {
  active: TimeEntry | null;
  session: TimerSession | null;
  pending: boolean;
  /** Os apontamentos fechados desde que a página abriu, para quem mostra o registro não precisar reler. */
  finished: TimeEntry[];
  /** Liga o cronômetro; a origem é o botão tocado, para a ilha nascer dele. */
  start: (target: StartTarget, origin?: TimerOrigin | null) => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  stop: () => Promise<void>;
};

const TimeTrackerContext = createContext<ContextValue | null>(null);

/* O tempo que corre mora num contexto à parte: ele muda a cada segundo, e junto do resto faria toda tela que
   só quer saber se há cronômetro redesenhar sessenta vezes por minuto. */
const SecondsContext = createContext(0);

const elapsed = (entry: TimeEntry | null, now: number) =>
  entry ? Math.max(0, Math.floor((now - new Date(entry.startedAt).getTime()) / 1000)) : 0;

const sessionOf = (entry: TimeEntry, carried = 0): TimerSession => ({
  target: { projectId: entry.projectId ?? undefined, taskId: entry.taskId ?? undefined },
  title: entry.taskTitle ?? entry.projectName ?? "Tempo em andamento",
  reference: entry.taskReference ?? entry.projectReference,
  since: entry.startedAt,
  carried,
  paused: false,
});

export function TimeTrackerProvider({
  initialEntry,
  initialPosition,
  children,
}: {
  initialEntry: TimeEntry | null;
  initialPosition: TimerPosition;
  children: ReactNode;
}) {
  const { toast } = useToast();
  const [active, setActive] = useState(initialEntry);
  const [session, setSession] = useState<TimerSession | null>(() => (initialEntry ? sessionOf(initialEntry) : null));
  const [finished, setFinished] = useState<TimeEntry[]>([]);
  const [pending, setPending] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [active]);

  const seconds = (session?.carried ?? 0) + elapsed(active, now);

  const open = useCallback(
    async (target: StartTarget) => {
      setPending(true);
      const result = await callAction(startTimerAction({ projectId: target.projectId ?? null, taskId: target.taskId ?? null, note: target.note ?? "" }));
      setPending(false);
      if (!result.ok) {
        toast({ title: "Não deu para iniciar o cronômetro", description: result.error, tone: "danger" });
        return null;
      }
      setActive(result.data);
      setNow(Date.now());
      return result.data;
    },
    [toast],
  );

  const close = useCallback(async () => {
    if (!active) return null;
    setPending(true);
    const result = await callAction(stopTimerAction({ id: active.id }));
    setPending(false);
    if (!result.ok) {
      toast({ title: "Não deu para parar o cronômetro", description: result.error, tone: "danger" });
      return null;
    }
    setActive(null);
    setFinished((current) => [result.data, ...current]);
    return result.data;
  }, [active, toast]);

  const start = useCallback(
    async (target: StartTarget, origin: TimerOrigin | null = null) => {
      const entry = await open(target);
      if (entry) setSession({ ...sessionOf(entry), launch: { id: Date.now(), origin } });
    },
    [open],
  );

  const pause = useCallback(async () => {
    const entry = await close();
    if (entry) setSession((current) => current && { ...current, carried: current.carried + (entry.durationSeconds ?? 0), paused: true });
  }, [close]);

  const resume = useCallback(async () => {
    if (!session) return;
    const entry = await open(session.target);
    if (entry) setSession({ ...session, paused: false });
  }, [open, session]);

  const stop = useCallback(async () => {
    const total = (session?.carried ?? 0) + elapsed(active, Date.now());
    if (active && !(await close())) return;
    setSession(null);
    if (total > 0) toast({ title: "Tempo registrado", description: durationLabel(total), tone: "success" });
  }, [active, close, session, toast]);

  const value = useMemo(
    () => ({ active, session, pending, finished, start, pause, resume, stop }),
    [active, session, pending, finished, start, pause, resume, stop],
  );

  return (
    <TimeTrackerContext.Provider value={value}>
      <SecondsContext.Provider value={seconds}>
        {children}
        {session && <TimeIsland initialPosition={initialPosition} />}
      </SecondsContext.Provider>
    </TimeTrackerContext.Provider>
  );
}

export function useTimeTracker() {
  const context = useContext(TimeTrackerContext);
  if (!context) throw new Error("useTimeTracker precisa de TimeTrackerProvider");
  return context;
}

/** O tempo da sessão inteira, contando o trecho em andamento; muda a cada segundo. */
export const useTimerSeconds = () => useContext(SecondsContext);

/** A caixa de quem foi tocado, na forma que a ilha usa para nascer dali. */
export const originOf = (element: Element | null): TimerOrigin | null => {
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
};
