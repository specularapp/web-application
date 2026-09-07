/** Um dia da semana do desafio: quantas vezes a pessoa entrou e quanto tempo ficou. */
export type ChallengeDay = {
  /** Data no formato `yyyy-MM-dd`. */
  date: string;
  accesses: number;
  onlineMinutes: number;
};

/** O que o bloco de desafio semanal mostra: os sete dias da semana em curso, de segunda a domingo, e a posição entre os usuários. */
export type WeeklyChallenge = {
  days: ChallengeDay[];
  /** Minutos online por dia para o dia contar como batido: 30, por decisão de produto de 2026-09-07. */
  dailyGoalMinutes: number;
  /** Percentual de usuários que a pessoa está à frente, de 0 a 100. */
  percentile: number;
};
