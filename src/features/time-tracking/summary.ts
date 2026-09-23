export type TimeEntry = {
  id: string;
  projectId: string | null;
  projectName: string | null;
  projectReference: string | null;
  taskId: string | null;
  taskTitle: string | null;
  taskReference: string | null;
  note: string;
  startedAt: string;
  stoppedAt: string | null;
  durationSeconds: number | null;
};

/** Onde a ilha do cronômetro fica na tela, em fração do espaço livre: 0 é a borda de cima ou da esquerda. */
export type TimerPosition = { x: number; y: number };

export const TIMER_POSITION_COOKIE = "sp-cronometro-posicao";

/** A ilha nasce no alto e ao centro, onde o relógio de um aparelho costuma morar; dali a pessoa leva aonde quiser. */
export const DEFAULT_TIMER_POSITION: TimerPosition = { x: 0.5, y: 0 };

const unit = (value: number) => Math.min(1, Math.max(0, value));

export function parseTimerPosition(raw: string | undefined): TimerPosition {
  const [x, y] = (raw ?? "").split(",").map(Number);
  return Number.isFinite(x) && Number.isFinite(y) ? { x: unit(x), y: unit(y) } : DEFAULT_TIMER_POSITION;
}

export const timerPositionValue = (position: TimerPosition) => `${unit(position.x).toFixed(3)},${unit(position.y).toFixed(3)}`;

/** O mostrador: minutos e segundos, e a hora na frente só quando ela existe, como no relógio do aparelho. */
export function formatClock(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  const tail = `${String(minutes).padStart(hours > 0 ? 2 : 1, "0")}:${String(rest).padStart(2, "0")}`;
  return hours > 0 ? `${hours}:${tail}` : tail;
}

/** A duração lida numa lista: "45 s", "12 min", "1 h 05 min". */
export function durationLabel(seconds: number) {
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")} min`;
}
