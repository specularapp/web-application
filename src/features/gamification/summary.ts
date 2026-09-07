/** Um dia da semana do desafio: quantas vezes a pessoa entrou e quanto tempo ficou. */
export type ChallengeDay = {
  /** Data no formato `yyyy-MM-dd`. */
  date: string;
  accesses: number;
  onlineMinutes: number;
};

/** O que o bloco de conquistas mostra: os pontos da gamificação e como eles crescem. */
export type PointsSummary = {
  points: number;
  /** Posição entre todos os usuários, 1 é o primeiro. */
  rank: number;
  /** Quantos pontos a pessoa gera por dia no ritmo atual. */
  dailyPoints: number;
  /** O bônus do dia: quantos pontos o arrasto vale e se hoje já foi pego. */
  dailyBonus: { points: number; claimedToday: boolean };
};

/** O que o bloco de desafio diário mostra: a sequência de dias logados, a meta de hoje e os sete dias da semana em curso. */
export type WeeklyChallenge = {
  /** Dias seguidos em que a pessoa entrou na plataforma, contando hoje se já entrou. */
  streakDays: number;
  /** Primeiro dia em que a pessoa entrou na plataforma, no formato `yyyy-MM-dd`. */
  since: string;
  /** De segunda a domingo. */
  days: ChallengeDay[];
  /** Um dia para cada dia desde o primeiro acesso até hoje, do mais antigo para o mais novo; dia sem entrada não teve acesso. */
  history: ChallengeDay[];
  /** Minutos online por dia para o dia contar como batido: 30, por decisão de produto de 2026-09-07. */
  dailyGoalMinutes: number;
};
