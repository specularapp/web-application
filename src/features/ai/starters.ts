/**
 * Os começos de conversa da abertura do SpeculAI. Clicar num não pergunta sozinho: o começo da pergunta cai no
 * campo e a pessoa termina com o que só ela sabe.
 */
export type AiStarterId = "funil" | "orcamentos" | "cobrancas" | "prazos";

export type AiStarter = {
  id: AiStarterId;
  label: string;
  description: string;
  prompt: string;
};

export const aiStarters: readonly AiStarter[] = [
  {
    id: "funil",
    label: "Funil de vendas",
    description: "Oportunidades paradas e o próximo passo",
    prompt: "Quais oportunidades do funil estão paradas há mais de ",
  },
  {
    id: "orcamentos",
    label: "Orçamentos",
    description: "O que foi enviado e ainda não teve resposta",
    prompt: "Liste os orçamentos enviados que ainda esperam resposta do cliente ",
  },
  {
    id: "cobrancas",
    label: "Cobranças",
    description: "O que vence e o que já atrasou",
    prompt: "Mostre as cobranças que vencem ",
  },
  {
    id: "prazos",
    label: "Projetos e tarefas",
    description: "Entregas em risco nesta semana",
    prompt: "Quais tarefas e projetos estão com o prazo em risco ",
  },
];

/** Os atalhos de continuar uma resposta: cada um pergunta de novo sobre o que acabou de ser dito. */
export type AiFollowUpId = "resumir" | "detalhar" | "passos";

export const aiFollowUps: readonly { id: AiFollowUpId; label: string; prompt: string }[] = [
  { id: "resumir", label: "Resumir", prompt: "Resuma a sua última resposta, mantendo os números e as ressalvas." },
  { id: "detalhar", label: "Detalhar", prompt: "Detalhe a sua última resposta e explique os pontos que pesam mais." },
  { id: "passos", label: "Passo a passo", prompt: "Organize a sua última resposta em um passo a passo prático." },
];
