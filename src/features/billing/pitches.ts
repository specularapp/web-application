/** Um convite de ação do menu: a frase curta e o rótulo do botão. */
export type PlanPitch = { description: string; action: string };

/**
 * Convites para o Pro, um por carga e escolhido ao acaso: a mesma frase todo dia vira papel de parede,
 * e a pessoa para de ler. Cada um aponta para um recurso real do catálogo, nunca para promessa vaga.
 */
export const proPitches: PlanPitch[] = [
  {
    description: "Projetos e clientes sem teto. No gratuito param em três.",
    action: "Assinar o Pro",
  },
  {
    description: "Orçamento sai em PDF com a sua marca, e não com a nossa.",
    action: "Tirar a marca d'água",
  },
  {
    description: "Contrato pronto para assinar em minutos, com modelo revisado.",
    action: "Ver os contratos",
  },
  {
    description: "Cobrança com lembrete automático: quem atrasa recebe aviso sem você lembrar.",
    action: "Ligar as cobranças",
  },
  {
    description: "Portfólio no seu domínio, sem endereço de terceiro no cartão de visita.",
    action: "Usar meu domínio",
  },
  {
    description: "Fluxo de caixa, recebíveis e margem por projeto na mesma tela.",
    action: "Abrir o financeiro",
  },
  {
    description: "Funil de vendas com etapas suas, do primeiro contato ao contrato fechado.",
    action: "Montar o funil",
  },
  {
    description: "Automações que avisam, cobram e arquivam enquanto você entrega.",
    action: "Ver as automações",
  },
  {
    description: "Duas semanas de trabalho salvas por mês em tarefa que o Pro faz sozinho.",
    action: "Conhecer o Pro",
  },
];

/** Sorteio simples no servidor: cada carga da página traz um convite diferente. */
export function pickPitch(pitches: PlanPitch[] = proPitches) {
  return pitches[Math.floor(Math.random() * pitches.length)] ?? pitches[0];
}
