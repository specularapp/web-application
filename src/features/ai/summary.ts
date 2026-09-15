/** O que o widget do topo mostra: quanto da IA do plano já foi usado no ciclo. */
export type AiUsage = {
  /** Ações de IA consumidas no ciclo em curso. */
  used: number;
  /** Quantas o plano dá no ciclo. */
  limit: number;
  /** Quando o ciclo vira e a contagem zera, no formato `yyyy-MM-dd`. */
  renewsAt: string;
};

/** De 0 a 1, com teto: plano estourado não desenha barra passando do fim. */
export function aiShare(usage: AiUsage) {
  if (usage.limit <= 0) return 1;
  return Math.min(1, usage.used / usage.limit);
}

/** Quantas ações ainda cabem no ciclo; nunca negativo, porque estourado é estourado. */
export function aiRemaining(usage: AiUsage) {
  return Math.max(0, usage.limit - usage.used);
}

/** Um áudio ditado no compositor: onde ele está e quanto dura. Mesma forma do áudio da conversa da tarefa,
 *  que é de onde vem o gravador. */
export type AiVoice = { url: string; seconds: number };

/** Um arquivo pendurado na mensagem antes de ela sair: o nome e o tamanho já escritos como a pessoa lê. */
export type AiAttachment = { id: string; name: string; size: string };

/** O primeiro nome de quem está na conta, para a saudação do vazio falar com a pessoa e não com o cadastro. */
export function firstName(name: string) {
  return name.trim().split(/\s+/)[0] ?? name;
}
