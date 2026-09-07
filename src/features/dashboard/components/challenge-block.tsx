import { CheckIcon } from "@phosphor-icons/react/ssr";
import { format, getDaysInMonth, getISODay, isAfter, isSameDay, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import Image from "next/image";
import { Progress } from "@/components/ui/progress";
import { Text } from "@/components/ui/text";
import { VisuallyHidden } from "@/components/ui/visually-hidden";
import type { WeeklyChallenge } from "@/features/gamification/summary";
import { squircle } from "@/lib/corners";
import styles from "./challenge-block.module.css";

export type ChallengeBlockProps = { challenge: WeeklyChallenge };

const weekdayLabels = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

/* Sequência com separador de milhar: 3.000 dias seguidos continua legível. */
const streakFormat = new Intl.NumberFormat("pt-BR");

/** 96 vira "1h36", 45 vira "45min". */
function formatMinutes(minutes: number) {
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h${String(rest).padStart(2, "0")}`;
}

// Na pegada da referência: à esquerda o azulejo da sequência, só a chama da casa e quantos dias seguidos
// a pessoa entrou; à direita, quanto falta para a meta de tempo de hoje, em número e barra, com
// a data do primeiro acesso na outra ponta da linha do número, e a semana em bolinhas, com check no dia em que a meta foi batida. Acessos e tempo de cada dia vão para
// a leitura por voz e para a dica do ponteiro. A sequência inteira abre pelo atalho do cabeçalho do bloco
// (`StreakButton`, ligado na grade).
export function ChallengeBlock({ challenge }: ChallengeBlockProps) {
  const today = new Date();
  const todayMinutes = challenge.days.find((day) => isSameDay(parseISO(day.date), today))?.onlineMinutes ?? 0;
  const goal = challenge.dailyGoalMinutes;
  // Um segmento por dia do mês em curso, para a barra ler como o calendário do mês.
  const segments = getDaysInMonth(today);

  return (
    <div className={styles.block}>
      <div className={styles.streak} {...squircle("sm", { clip: true })}>
        <Image src="/bg/fire-streak.png" alt="" width={331} height={455} sizes="48px" className={styles.flame} />
        <Text as="p" variant="subheadline" weight="semibold" className={styles.streakCount}>
          {streakFormat.format(challenge.streakDays)} {challenge.streakDays === 1 ? "dia" : "dias"}
        </Text>
        <VisuallyHidden>seguidos na plataforma</VisuallyHidden>
      </div>

      <div className={styles.progress}>
        <div className={styles.summary}>
          <p className={styles.goal}>
            <Text as="span" variant="title1" weight="semibold">
              {Math.min(todayMinutes, goal)}
            </Text>
            <Text as="span" variant="callout" tone="secondary">
              / {goal} min hoje
            </Text>
          </p>
          <Text as="p" variant="caption1" tone="secondary" truncate className={styles.since}>
            Desde {format(parseISO(challenge.since), "d MMM. yyyy", { locale: ptBR })}
          </Text>
        </div>
        <Progress
          value={todayMinutes}
          max={goal}
          tone="warning"
          size="lg"
          segments={segments}
          className={styles.bar}
          aria-label="Tempo online hoje"
        />

        <ol className={styles.week} aria-label="Dias da semana com a meta batida" {...squircle("sm", { clip: true })}>
          {challenge.days.map((day) => {
            const date = parseISO(day.date);
            const upcoming = isAfter(date, today) && !isSameDay(date, today);
            const met = day.onlineMinutes >= goal;
            const usage = upcoming ? "ainda por vir" : `${day.accesses} acessos, ${formatMinutes(day.onlineMinutes)} online`;

            return (
              <li
                key={day.date}
                className={styles.day}
                data-met={met || undefined}
                data-today={isSameDay(date, today) || undefined}
                title={upcoming ? undefined : usage}
              >
                <VisuallyHidden>{`${format(date, "EEEE, d 'de' MMMM", { locale: ptBR })}: ${usage}`}</VisuallyHidden>
                <span className={styles.dot} aria-hidden="true">
                  {met && <CheckIcon weight="bold" />}
                </span>
                <span className={styles.weekday} aria-hidden="true">
                  {weekdayLabels[getISODay(date) - 1]}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
