import { CheckIcon, TrophyIcon } from "@phosphor-icons/react/ssr";
import { format, getISODay, isAfter, isSameDay, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import type { CSSProperties } from "react";
import { Badge } from "@/components/ui/badge";
import { VisuallyHidden } from "@/components/ui/visually-hidden";
import type { ChallengeDay, WeeklyChallenge } from "@/features/gamification/summary";
import { squircle } from "@/lib/corners";
import styles from "./challenge-block.module.css";

export type ChallengeBlockProps = { challenge: WeeklyChallenge };

const weekdayLabels = ["SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM"];

type DayState = "met" | "partial" | "today" | "upcoming";

function stateOf(day: ChallengeDay, date: Date, today: Date, goal: number): DayState {
  if (isSameDay(date, today)) return day.onlineMinutes >= goal ? "met" : "today";
  if (isAfter(date, today)) return "upcoming";
  return day.onlineMinutes >= goal ? "met" : "partial";
}

/** 96 vira "1h36", 45 vira "45min". */
function formatMinutes(minutes: number) {
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h${String(rest).padStart(2, "0")}`;
}

// Os sete dias da semana em bolinhas, como na referência: cheia em verde com check no dia em que a
// meta de tempo foi batida, anel de progresso verde sobre o trilho cinza no dia com uso abaixo dela
// (hoje incluído), e trilho vazio para o que ainda vem. Dentro da bolinha, o dia do mês; embaixo,
// quanto tempo a pessoa ficou. Quantas vezes entrou vai para a leitura por voz e para a dica do
// ponteiro. No rodapé, a faixa amarela com a posição entre os usuários. A semana toma a altura que
// sobra e as bolinhas crescem com ela.
export function ChallengeBlock({ challenge }: ChallengeBlockProps) {
  const today = new Date();

  return (
    <div className={styles.block}>
      <ol className={styles.week} aria-label="Acessos e tempo online por dia da semana">
        {challenge.days.map((day) => {
          const date = parseISO(day.date);
          const state = stateOf(day, date, today, challenge.dailyGoalMinutes);
          const progress = Math.min(100, Math.round((day.onlineMinutes / challenge.dailyGoalMinutes) * 100));
          const label = weekdayLabels[getISODay(date) - 1] ?? "";
          const usage = state === "upcoming" ? "ainda por vir" : `${day.accesses} acessos, ${formatMinutes(day.onlineMinutes)} online`;
          const spoken = `${format(date, "EEEE, d 'de' MMMM", { locale: ptBR })}: ${usage}`;

          return (
            <li
              key={day.date}
              className={styles.day}
              data-state={state}
              title={state === "upcoming" ? undefined : usage}
              style={{ "--progress": progress } as CSSProperties}
            >
              <VisuallyHidden>{spoken}</VisuallyHidden>
              <span className={styles.weekday} aria-hidden="true">
                {label}
              </span>
              <span className={styles.dot} aria-hidden="true">
                <span className={styles.ring}>{state === "met" ? <CheckIcon weight="bold" /> : format(date, "d")}</span>
              </span>
              <span className={styles.minutes} aria-hidden="true">
                {state === "upcoming" ? "" : formatMinutes(day.onlineMinutes)}
              </span>
            </li>
          );
        })}
      </ol>

      <Badge tone="yellow" size="md" icon={<TrophyIcon />} className={styles.rank} {...squircle("sm", { clip: true })}>
        Você está à frente de {challenge.percentile}% dos usuários
      </Badge>
    </div>
  );
}
