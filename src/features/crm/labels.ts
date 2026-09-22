import { differenceInCalendarDays, differenceInMinutes, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import type { BadgeTone } from "@/components/ui/badge";
import { stageKind, type CrmStage } from "./stages";
import type { CrmPerson, Opportunity, OpportunitySource, OpportunityStatus, OpportunityTemperature } from "./summary";

/** Quantos caracteres a fila de nomes ocupa antes de virar reticência mais a contagem do resto. */
const NAME_BUDGET = 32;

/** Os primeiros nomes que cabem no orçamento de caracteres, e quantos ficaram de fora. Mesma conta da
 *  conversa das tarefas: o corte é por caractere, porque nomes têm larguras muito diferentes. */
export function crmPeopleLabel(people: CrmPerson[], budget = NAME_BUDGET) {
  const first = people.map((person) => person.name.split(" ")[0] ?? person.name);
  const shown: string[] = [];
  let length = 0;

  for (const name of first) {
    const next = shown.length === 0 ? name.length : length + 2 + name.length;
    if (shown.length > 0 && next > budget) break;
    shown.push(name);
    length = next;
  }

  return { names: shown.join(", "), rest: first.length - shown.length };
}

/* Aberta em azul, ganha em verde e perdida em vermelho: aqui o fim tem dois lados, e a cor precisa separar
   um do outro de relance, ao contrário da tarefa concluída, que é sempre a mesma coisa. */
export const crmStatusLabels: Record<OpportunityStatus, string> = { open: "Em aberto", won: "Ganha", lost: "Perdida" };
export const crmStatusTones: Record<OpportunityStatus, BadgeTone> = { open: "accent", won: "success", lost: "danger" };

/**
 * A situação lida a partir da etapa, e não guardada no modelo: sai do `kind` que cada etapa do catálogo
 * declara, então etapa nova já nasce com a própria leitura e nenhum segundo mapa fica para trás.
 */
export const crmStatus = (stage: CrmStage): OpportunityStatus => stageKind(stage);

export const statusOf = (opportunity: Opportunity) => crmStatus(opportunity.stage);

export const isOpen = (opportunity: Opportunity) => crmStatus(opportunity.stage) === "open";

/* A temperatura em três degraus: fria neutra, morna laranja e quente vermelha. */
export const temperatureLabels: Record<OpportunityTemperature, string> = { cold: "Fria", warm: "Morna", hot: "Quente" };
export const temperatureTones: Record<OpportunityTemperature, BadgeTone> = { cold: "neutral", warm: "warning", hot: "danger" };

/** O mesmo degrau como token de cor, para o que não é `Badge` se tingir, como o seletor da ficha. */
export const temperatureHues: Record<OpportunityTemperature, string> = {
  cold: "var(--sys-gray)",
  warm: "var(--color-warning)",
  hot: "var(--color-danger)",
};

export const sourceLabels: Record<OpportunitySource, string> = {
  whatsapp: "WhatsApp",
  indicacao: "Indicação",
  site: "Site",
  instagram: "Instagram",
  google: "Google",
  facebook: "Facebook",
  evento: "Evento",
  prospeccao: "Prospecção",
  telefone: "Telefone",
  outro: "Outro",
};

/**
 * O matiz de cada origem, para a etiqueta dela sair na cor do canal: o WhatsApp no verde oficial da marca,
 * que a casa já tem em token, e os outros nas cores do sistema. É o que faz a origem ser reconhecida antes
 * de ser lida, numa ficha com trinta campos.
 */
export const sourceHues: Record<OpportunitySource, string> = {
  whatsapp: "var(--color-whatsapp)",
  indicacao: "var(--sys-green)",
  site: "var(--sys-blue)",
  instagram: "var(--sys-pink)",
  google: "var(--sys-yellow)",
  facebook: "var(--sys-blue)",
  evento: "var(--sys-purple)",
  prospeccao: "var(--sys-teal)",
  telefone: "var(--sys-cyan)",
  outro: "var(--sys-gray)",
};

/**
 * Quantos dias sem contato bastam para a venda contar como **parada**. Dez dias corridos: menos que isso
 * pega quem só passou o fim de semana sem falar, e mais que isso é tempo demais para um funil ativo.
 */
export const STALE_DAYS = 10;

/** Dias desde o último contato de verdade. */
export const daysSinceTouch = (opportunity: Opportunity) => differenceInCalendarDays(new Date(), parseISO(opportunity.lastTouchAt || opportunity.enteredAt));

/**
 * Venda parada: passou da folga sem ninguém falar com o cliente e ainda está em aberto. Ganha ou perdida não
 * para, porque já acabou.
 */
export const isStale = (opportunity: Opportunity) => isOpen(opportunity) && daysSinceTouch(opportunity) > STALE_DAYS;

/** "há 12 dias", "ontem", "hoje": como a pessoa fala do último contato. */
export function touchLabel(opportunity: Opportunity) {
  if (!opportunity.lastTouchAt) return "Sem contato registrado";
  const days = daysSinceTouch(opportunity);
  if (days <= 0) return "Contato hoje";
  if (days === 1) return "Contato ontem";
  return `Sem contato há ${days} dias`;
}

/**
 * A previsão de fechamento em uma palavra quando dá: hoje em vermelho, amanhã em laranja, e o resto pela
 * data. Oportunidade em aberto com a previsão vencida fica em vermelho, porque é a que mais pede uma
 * decisão; ganha ou perdida no passado fica neutra, porque a data já cumpriu o papel dela.
 */
export function expectedOf(opportunity: Opportunity): { label: string; tone: BadgeTone } {
  if (!opportunity.expectedAt) return { label: "Sem previsão", tone: "neutral" };
  const date = parseISO(opportunity.expectedAt);
  const days = differenceInCalendarDays(date, new Date());
  const late = days < 0 && isOpen(opportunity);

  if (days === 0) return { label: "Hoje", tone: "danger" };
  if (days === 1) return { label: "Amanhã", tone: "warning" };
  if (days === -1) return { label: "Ontem", tone: late ? "danger" : "neutral" };
  return { label: format(date, "d MMM.", { locale: ptBR }), tone: late ? "danger" : "neutral" };
}

/** A data do próximo passo por extenso curto, como o prazo: "12 out.". */
export const stepDate = (iso: string) => format(parseISO(iso), "d MMM.", { locale: ptBR });

/**
 * O previsto **ponderado** de uma lista: cada valor vezes a chance de fechar. É o número que um funil
 * responde de verdade, porque somar o valor cheio de tudo conta como certo o que ainda é conversa.
 */
export const weightedValue = (opportunities: Opportunity[]) =>
  opportunities.reduce((sum, opportunity) => sum + Math.round((opportunity.value * opportunity.probability) / 100), 0);

/** O valor cheio de uma lista, sem ponderar: é o que a coluna mostra no cabeçalho. */
export const totalValue = (opportunities: Opportunity[]) => opportunities.reduce((sum, opportunity) => sum + opportunity.value, 0);

/** Uma duração em minutos como a pessoa fala: "14h 12m", "3d 2h", "48m". É o tempo parado na etapa e o de
 *  resposta, que são as duas medidas de ritmo do funil. */
export function durationLabel(minutes: number) {
  const whole = Math.max(0, Math.round(minutes));
  const days = Math.floor(whole / (24 * 60));
  const hours = Math.floor((whole % (24 * 60)) / 60);
  const rest = whole % 60;
  const parts = [days > 0 && `${days}d`, hours > 0 && `${hours}h`, rest > 0 && `${rest}m`].filter(Boolean);
  return parts.length > 0 ? parts.slice(0, 2).join(" ") : "0m";
}

/** Há quanto tempo a venda está parada na etapa em que está, em minutos. */
export const stageMinutes = (opportunity: Opportunity) => differenceInMinutes(new Date(), parseISO(opportunity.stageSince));

/** Data e hora como a pessoa lê: "14/09/2026, 14:43", o mesmo formato da ficha do CRM que serviu de modelo. */
export const dateTimeLabel = (iso: string) => format(parseISO(iso), "dd/MM/yyyy', 'HH:mm", { locale: ptBR });

/** O endereço desta oportunidade na aplicação, que é o link que se manda para alguém abrir o mesmo cartão. */
export const opportunityLink = (opportunity: Opportunity) =>
  `/crm${opportunity.funnel ? `/${opportunity.funnel.slug}` : ""}#${encodeURIComponent(opportunity.reference)}`;
