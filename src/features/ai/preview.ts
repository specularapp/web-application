import { addMonths, format, startOfMonth } from "date-fns";
import type { AiReply } from "./conversation";
import type { AiUsage } from "./summary";

/**
 * Uso de exemplo enquanto o domínio não existe no banco. Quem montar a contagem troca só a origem: o
 * widget recebe o uso por prop e não sabe de onde ele vem. O ciclo vira no primeiro dia do mês que vem,
 * relativo a hoje, para a data na janela nunca ficar no passado.
 */
export const previewAiUsage: AiUsage = {
  used: 128,
  limit: 500,
  renewsAt: format(startOfMonth(addMonths(new Date(), 1)), "yyyy-MM-dd"),
};

/* As respostas simuladas, escolhidas por palavra da pergunta. Elas existem para a conversa ter forma antes
   de o modelo existir: quando a rota de IA entrar, `previewAiReply` sai inteira e quem responde é ela. */
const replies: readonly { match: RegExp; reply: AiReply }[] = [
  {
    match: /or[çc]amento|proposta|parad/i,
    reply: {
      text: `Você tem **três orçamentos parados** esperando resposta, somando R$ 186.400. O mais antigo já passou de duas semanas.

- **ORC-2026-0042**, Construtora Aurora, R$ 98.200, enviado há 17 dias e aberto 4 vezes
- **ORC-2026-0039**, Marina Câmara, R$ 54.700, enviado há 9 dias e ainda não aberto
- **ORC-2026-0051**, Pedro Nogueira, R$ 33.500, enviado há 6 dias, com uma pergunta sem resposta no contrato

O da Aurora é o que vale a ligação: quem abre quatro vezes está comparando preço, não ignorando. Quer que eu escreva o retorno dos três?`,
      steps: ["Lendo os orçamentos enviados", "Cruzando com a resposta dos clientes", "Montando o resumo"],
      sources: [
        { id: "orc-42", label: "ORC-2026-0042" },
        { id: "orc-39", label: "ORC-2026-0039" },
        { id: "orc-51", label: "ORC-2026-0051" },
      ],
    },
  },
  {
    match: /cobran|atras|inadimpl|receb/i,
    reply: {
      text: `Duas cobranças venceram. Escrevi para a mais antiga, a da Construtora Aurora, de R$ 24.550, com 12 dias de atraso.

Olá, Ricardo, tudo bem? Passando para lembrar da parcela de R$ 24.550 do contrato da obra do Jardim Aurora, que venceu no dia 2. Se já tiver saído, me avisa que eu baixo aqui. Se preferir, consigo reemitir com nova data hoje mesmo.

Deixei curto e sem cobrança dura de propósito: é cliente com três obras fechadas no ano, e o atraso é o primeiro. Quer que eu ajuste o tom ou já preparo a segunda?`,
      steps: ["Lendo as cobranças em aberto", "Vendo o histórico do cliente", "Escrevendo o texto"],
      sources: [
        { id: "cli-aurora", label: "Construtora Aurora" },
        { id: "cob-118", label: "Cobrança 118" },
      ],
    },
  },
  {
    match: /projeto|trav|atrasad|obra/i,
    reply: {
      text: `Três projetos passaram da data e o motivo é o mesmo em dois deles.

- **Jardim Aurora**: parado na aprovação do cliente há 8 dias, com 4 tarefas esperando a mesma resposta
- **Residencial Vila Nova**: a equipe está com 11 tarefas em execução para 3 pessoas, mais que o dobro do que fecha numa semana
- **Galpão Serra**: esperando o mesmo aval do Jardim Aurora, do mesmo cliente

Juntando os dois que dependem da Aurora, uma cobrança só destrava 6 tarefas. É o melhor retorno por esforço desta semana.`,
      steps: ["Lendo os projetos em andamento", "Somando as tarefas paradas", "Procurando o que se repete"],
      sources: [
        { id: "proj-aurora", label: "Jardim Aurora" },
        { id: "proj-vila", label: "Residencial Vila Nova" },
        { id: "proj-serra", label: "Galpão Serra" },
      ],
    },
  },
  {
    match: /semana|plano|tarefa|prioridad/i,
    reply: {
      text: `Você tem 14 tarefas em aberto para esta semana, 3 delas vencidas. Deixaria assim:

- **Segunda**: as 3 vencidas, todas de aprovação, que é o que está segurando os outros
- **Terça e quarta**: o detalhamento do Vila Nova, que é o trabalho mais longo e precisa de bloco inteiro
- **Quinta**: o retorno dos orçamentos parados, junto de uma vez só
- **Sexta**: a medição do Galpão Serra, que só depende de você entrar no sistema

Sobram duas tarefas sem data que dá para empurrar sem prejuízo. Quer que eu marque assim no quadro?`,
      steps: ["Lendo as tarefas em aberto", "Separando o que está vencido", "Distribuindo pela semana"],
      sources: [
        { id: "tarefas", label: "14 tarefas em aberto" },
        { id: "proj-vila", label: "Residencial Vila Nova" },
      ],
    },
  },
];

const fallback: AiReply = {
  text: `Ainda não estou ligado ao modelo, então esta resposta é de exemplo: ela serve para a conversa ter a forma certa antes de existir de verdade.

Quando eu estiver ligado, vou ler o que está na sua conta para responder: orçamentos, clientes, projetos, contratos e tarefas do seu time, e só os que você pode ver.`,
  sources: [],
  steps: ["Pensando no que você pediu"],
};

/** A resposta simulada para uma pergunta. Some quando a rota de IA existir. */
export function previewAiReply(question: string): AiReply {
  return replies.find((entry) => entry.match.test(question))?.reply ?? fallback;
}
