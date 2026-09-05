import { hashString } from "@/lib/utils/hash";

/** Frases curtas de boas-vindas do painel, na pegada de "vamos com tudo hoje". */
export const greetings = [
  "Vamos com tudo hoje!",
  "Bom te ver por aqui",
  "Um passo de cada vez",
  "Hoje é dia de fechar negócio",
  "Foco no que importa",
  "Que tal começar pelo mais difícil?",
  "Seus projetos sentiram sua falta",
  "Pronto para mais um dia?",
  "O próximo cliente pode chegar hoje",
  "Constância vence talento",
  "Tudo em ordem, siga em frente",
  "Bora fazer acontecer",
];

/**
 * Uma frase por pessoa e por dia, e não por carga: o período do painel vive na URL e cada troca refaz
 * a página no servidor, então uma frase nova a cada carga trocaria a cada clique e leria como defeito.
 */
export function greetingFor(userId: string, today = new Date()) {
  const day = today.toISOString().slice(0, 10);
  return greetings[hashString(`${userId}:${day}`) % greetings.length] ?? greetings[0];
}
