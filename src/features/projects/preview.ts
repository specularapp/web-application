import { format, subMonths } from "date-fns";
import type { ProjectsSummary } from "./summary";

const monthKey = (back: number) => format(subMonths(new Date(), back), "yyyy-MM");

/**
 * Resumo de exemplo enquanto o domínio não existe no banco. Quem montar a tabela troca só a origem:
 * o bloco recebe o resumo por prop e não sabe de onde ele vem. Os meses são sempre os doze últimos,
 * para a prévia não envelhecer.
 */
export const previewProjectsSummary: ProjectsSummary = {
  total: 12,
  clientCount: 26,
  clients: [
    { name: "Estúdio Bravo", avatarUrl: null },
    { name: "Padaria Aurora", avatarUrl: null },
    { name: "Linda Dong", avatarUrl: null },
  ],
  months: [
    { month: monthKey(11), started: 2, completed: 1 },
    { month: monthKey(10), started: 3, completed: 2 },
    { month: monthKey(9), started: 2, completed: 3 },
    { month: monthKey(8), started: 4, completed: 2 },
    { month: monthKey(7), started: 3, completed: 4 },
    { month: monthKey(6), started: 5, completed: 3 },
    { month: monthKey(5), started: 3, completed: 2 },
    { month: monthKey(4), started: 5, completed: 3 },
    { month: monthKey(3), started: 4, completed: 5 },
    { month: monthKey(2), started: 4, completed: 3 },
    { month: monthKey(1), started: 6, completed: 4 },
    { month: monthKey(0), started: 5, completed: 6 },
  ],
};
