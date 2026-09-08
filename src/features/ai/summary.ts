/** O que o widget do topo mostra: quanto da IA do plano já foi usado no ciclo. */
export type AiUsage = {
  /** Ações de IA consumidas no ciclo em curso. */
  used: number;
  /** Quantas o plano dá no ciclo. */
  limit: number;
};

/** De 0 a 1, com teto: plano estourado não desenha barra passando do fim. */
export function aiShare(usage: AiUsage) {
  if (usage.limit <= 0) return 1;
  return Math.min(1, usage.used / usage.limit);
}
