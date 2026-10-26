import type { BadgeTone } from "@/components/ui/badge";
import type { DispatchEvent, NpsChannel, NpsGroup, NpsService, QuestionKind, SendStatus, SurveyStatus, TreatmentStatus } from "./types";

export const groups: NpsGroup[] = ["promoter", "passive", "detractor"];

export const groupOf = (score: number): NpsGroup => (score >= 9 ? "promoter" : score >= 7 ? "passive" : "detractor");

export const groupLabels: Record<NpsGroup, { label: string; plural: string; range: string; tone: BadgeTone; color: string }> = {
  promoter: { label: "Promotor", plural: "Promotores", range: "9 e 10", tone: "success", color: "var(--sys-green)" },
  passive: { label: "Neutro", plural: "Neutros", range: "7 e 8", tone: "warning", color: "var(--sys-yellow)" },
  detractor: { label: "Detrator", plural: "Detratores", range: "0 a 6", tone: "danger", color: "var(--sys-red)" },
};

/** O NPS de uma lista de notas: % de promotores menos % de detratores, de -100 a 100. Nulo sem nota. */
export function npsOf(scores: number[]): number | null {
  if (scores.length === 0) return null;
  let promoters = 0;
  let detractors = 0;
  for (const score of scores) {
    if (score >= 9) promoters += 1;
    else if (score <= 6) detractors += 1;
  }
  return Math.round(((promoters - detractors) / scores.length) * 100);
}

/** A zona do NPS na régua de mercado. */
export function zoneOf(nps: number): { label: string; tone: BadgeTone } {
  if (nps < 0) return { label: "Zona crítica", tone: "danger" };
  if (nps < 50) return { label: "Aperfeiçoamento", tone: "warning" };
  if (nps < 75) return { label: "Qualidade", tone: "info" };
  return { label: "Excelência", tone: "success" };
}

export const formatNps = (nps: number | null) => (nps === null ? "Sem nota" : nps > 0 ? `+${nps}` : String(nps));

const numberFormat = new Intl.NumberFormat("pt-BR");
const percentFormat = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const decimalFormat = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export const formatCount = (value: number) => numberFormat.format(value);
export const formatShare = (value: number) => `${percentFormat.format(value)}%`;
export const formatDecimal = (value: number) => decimalFormat.format(value);
export const plural = (count: number, one: string, many: string) => `${formatCount(count)} ${count === 1 ? one : many}`;

export const serviceLabels: Record<NpsService, { label: string; tone: BadgeTone }> = {
  site: { label: "Site institucional", tone: "blue" },
  app: { label: "Aplicativo", tone: "purple" },
  branding: { label: "Identidade visual", tone: "pink" },
  ecommerce: { label: "E-commerce", tone: "orange" },
  support: { label: "Suporte e manutenção", tone: "teal" },
};

export const services = Object.keys(serviceLabels) as NpsService[];

export const channelLabels: Record<NpsChannel, string> = { email: "E-mail", whatsapp: "WhatsApp", link: "Link aberto" };

export const questionKinds: Record<QuestionKind, { label: string; description: string }> = {
  nps: { label: "Nota de 0 a 10", description: "A pergunta do NPS: quanto indicaria." },
  stars: { label: "Estrelas de 1 a 5", description: "Nota para um aspecto, como prazo ou comunicação." },
  choice: { label: "Escolha única", description: "Uma alternativa entre várias." },
  multiple: { label: "Múltipla escolha", description: "Marca quantas quiser." },
  yesNo: { label: "Sim ou não", description: "Resposta rápida de dois botões." },
  text: { label: "Texto livre", description: "Comentário com as palavras do cliente." },
};

export const surveyStatusLabels: Record<SurveyStatus, { label: string; tone: BadgeTone }> = {
  active: { label: "Ativa", tone: "success" },
  paused: { label: "Pausada", tone: "warning" },
  draft: { label: "Rascunho", tone: "neutral" },
  archived: { label: "Arquivada", tone: "neutral" },
};

export const surveyStatusOrder: SurveyStatus[] = ["active", "paused", "draft", "archived"];

export const treatmentLabels: Record<TreatmentStatus, { label: string; tone: BadgeTone; color: string; description: string }> = {
  open: { label: "Aberta", tone: "danger", color: "var(--sys-red)", description: "Ninguém falou com o cliente ainda." },
  contacted: { label: "Em contato", tone: "warning", color: "var(--sys-orange)", description: "Já houve conversa; falta fechar." },
  review: { label: "Em análise", tone: "purple", color: "var(--sys-purple)", description: "A equipe apura o que aconteceu no projeto." },
  adjustment: { label: "Ajuste combinado", tone: "info", color: "var(--sys-blue)", description: "Uma correção ou cortesia foi oferecida; falta o cliente confirmar." },
  resolved: { label: "Resolvida", tone: "success", color: "var(--sys-green)", description: "Conversa encerrada com o cliente." },
  noReply: { label: "Sem retorno", tone: "neutral", color: "var(--sys-gray)", description: "Tentamos e o cliente não respondeu." },
};

export const treatmentOrder: TreatmentStatus[] = ["open", "contacted", "review", "adjustment", "resolved", "noReply"];

export const treatmentIsOpen = (status: TreatmentStatus) => status !== "resolved" && status !== "noReply";

export const sendStatusLabels: Record<SendStatus, { label: string; tone: BadgeTone }> = {
  scheduled: { label: "Agendado", tone: "info" },
  sent: { label: "Enviado", tone: "neutral" },
  delivered: { label: "Entregue", tone: "neutral" },
  read: { label: "Lido", tone: "purple" },
  answered: { label: "Respondido", tone: "success" },
  failed: { label: "Falhou", tone: "danger" },
  cancelled: { label: "Cancelado", tone: "neutral" },
};

export const eventLabels: Record<DispatchEvent, { label: string; after: string }> = {
  projectDone: { label: "Projeto concluído", after: "da conclusão do projeto" },
  deliveryApproved: { label: "Entrega aprovada", after: "da aprovação da entrega" },
  chargePaid: { label: "Última cobrança paga", after: "do pagamento da última parcela" },
  supportCheck: { label: "Acompanhamento pós-entrega", after: "da entrega, para medir o suporte" },
};

/** Os assuntos que o painel conta nos comentários, com as palavras que os denunciam, sem acento. */
export const themes: { id: string; label: string; words: string[] }[] = [
  { id: "communication", label: "Comunicação", words: ["comunica", "atualiza", "respond", "whatsapp", "reuni", "avis", "transparen"] },
  { id: "deadline", label: "Prazo", words: ["prazo", "atras", "antes do", "cronograma", "estour"] },
  { id: "quality", label: "Qualidade técnica", words: ["bug", "codigo", "qualidade", "erro", "lent", "performance"] },
  { id: "design", label: "Design", words: ["design", "layout", "identidade", "prototipo", "visual", "marca"] },
  { id: "support", label: "Suporte", words: ["suporte", "ajuste", "pos-entrega", "chamado"] },
  { id: "price", label: "Preço", words: ["preco", "orcamento", "valor", "caro", "custo"] },
  { id: "docs", label: "Documentação", words: ["documenta", "painel", "treinamento", "manual"] },
];

const plain = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function themesOf(comment: string): string[] {
  const text = plain(comment);
  if (!text.trim()) return [];
  return themes.filter((theme) => theme.words.some((word) => text.includes(word))).map((theme) => theme.id);
}

export const themeLabel = (id: string) => themes.find((theme) => theme.id === id)?.label ?? id;

/** As variáveis dos textos da pesquisa: o que cada uma vira para o cliente. */
export const surveyVariables = [
  { token: "{nome}", label: "Nome do cliente", example: "Helena" },
  { token: "{projeto}", label: "Projeto", example: "Rebranding Atelier Prado" },
];

/** "{nome}" e "{projeto}" no texto da pesquisa, com a pontuação ajustada quando falta o nome. */
export function fillSurveyText(text: string, values: { name?: string | null; project?: string | null }) {
  const first = values.name?.trim().split(/\s+/)[0] ?? "";
  return text
    .replace(/\{nome\}/g, first)
    .replace(/\{projeto\}/g, values.project ?? "seu projeto")
    .replace(/\s+([,!.?])/g, "$1")
    .replace(/,([!.?])/g, "$1")
    .replace(/^,\s*/, "");
}

export const HOUR = 3_600_000;
export const DAY = 86_400_000;

const relative = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });

/** "há 3 horas", "ontem", "há 5 dias", contados a partir do agora que a tela recebe. */
export function timeAgo(iso: string, now: string) {
  const minutes = Math.round((Date.parse(iso) - Date.parse(now)) / 60_000);
  if (Math.abs(minutes) < 60) return relative.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return relative.format(hours, "hour");
  const days = Math.round(hours / 24);
  if (Math.abs(days) < 30) return relative.format(days, "day");
  return dateLabel(iso);
}

const dateFormat = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric", timeZone: "America/Sao_Paulo" });
const dateTimeFormat = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
const timeFormat = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

export const dateLabel = (iso: string) => dateFormat.format(new Date(iso)).replace(/\./g, "");
export const dateTimeLabel = (iso: string) => dateTimeFormat.format(new Date(iso)).replace(",", " às");
export const timeLabel = (iso: string) => timeFormat.format(new Date(iso));

/** Horas e minutos curtos para prazo: "45 min", "6 h", "3 dias". */
export function spanLabel(hours: number) {
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} min`;
  if (hours < 48) return `${Math.round(hours)} h`;
  return `${Math.round(hours / 24)} dias`;
}
