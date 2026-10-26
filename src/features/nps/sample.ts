import { DAY, HOUR, groupOf, themesOf } from "./labels";
import type { Answer, DispatchRule, NpsChannel, NpsClient, NpsData, NpsMember, NpsResponse, NpsSend, NpsService, Survey, Treatment, TreatmentEvent, TreatmentStatus } from "./types";

/*
 * Dados de exemplo do NPS, em memória e determinísticos: o mesmo sorteio no servidor e no navegador, a partir
 * de um "agora" fixo. Saem quando o domínio existir no banco; as telas já recebem tudo por props, no formato
 * que a consulta vai entregar.
 */

const NOW = "2026-10-25T17:00:00.000Z";
const now = Date.parse(NOW);

/** Sorteio com semente (mulberry32): o mesmo resultado em toda execução. */
function random(seed: number) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

const team: NpsMember[] = [
  { id: "m-marina", name: "Marina Lopes", role: "Atendimento" },
  { id: "m-rafael", name: "Rafael Duarte", role: "Líder de desenvolvimento" },
  { id: "m-bianca", name: "Bianca Torres", role: "Design" },
  { id: "m-caio", name: "Caio Mendes", role: "Gestão de projetos" },
];

const client = (id: string, name: string, company: string, project: string, reference: number, service: NpsService): NpsClient => ({
  id,
  contact: { name, company, email: `${name.split(" ")[0].toLowerCase()}@${company.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z]+/g, "")}.com.br`, phone: `(11) 9${String(8100 + reference * 37).slice(0, 4)}-${String(2200 + reference * 53).slice(0, 4)}` },
  project: { id: `p-${id}`, name: project, reference: `PRJ-2026-${String(reference).padStart(4, "0")}`, service },
});

const clients: NpsClient[] = [
  client("c-prado", "Helena Prado", "Atelier Prado", "Rebranding Atelier Prado", 12, "branding"),
  client("c-ferraz", "Lucas Ferraz", "Ferraz Advocacia", "Site institucional Ferraz", 18, "site"),
  client("c-rocha", "Camila Rocha", "Rocha Nutrição", "App de agendamento", 21, "app"),
  client("c-antunes", "Diego Antunes", "Antunes Imóveis", "Portal de imóveis", 9, "site"),
  client("c-nogueira", "Patrícia Nogueira", "Nogueira Moda", "Loja virtual Nogueira", 27, "ecommerce"),
  client("c-siqueira", "Renato Siqueira", "Siqueira Engenharia", "Site e blog técnico", 15, "site"),
  client("c-viver", "Juliana Castro", "Clínica Viver Bem", "App do paciente", 24, "app"),
  client("c-barros", "Thiago Barros", "Barros Café", "Identidade e embalagens", 7, "branding"),
  client("c-educa", "Fernanda Lima", "EducaMais", "Plataforma de cursos", 31, "app"),
  client("c-pires", "Gustavo Pires", "Pires Logística", "Manutenção do painel", 4, "support"),
  client("c-bella", "Larissa Melo", "Bella Cosméticos", "Loja e integração com ERP", 29, "ecommerce"),
  client("c-coelho", "André Coelho", "Coelho Contabilidade", "Suporte do site e intranet", 3, "support"),
  client("c-ramalho", "Sofia Ramalho", "Studio Ramalho", "Portfólio de arquitetura", 33, "site"),
  client("c-vieira", "Marcelo Vieira", "Vieira Fitness", "App de treinos", 19, "app"),
];

const thanks = {
  promoter: { title: "Obrigado, {nome}!", text: "Ficamos muito felizes. Se puder, deixe um depoimento curto: ele vai para o nosso portfólio com o {projeto}." },
  passive: { title: "Obrigado pela sinceridade", text: "Vamos usar o que você contou para que o próximo projeto seja nota 10." },
  detractor: { title: "Sentimos muito, {nome}", text: "Alguém da equipe vai falar com você em até 24 horas para entender o que aconteceu com o {projeto}." },
};

const surveys: Survey[] = [
  {
    id: "s-entrega",
    name: "Pós-entrega",
    status: "active",
    services: ["site", "app", "branding", "ecommerce"],
    intro: "Oi, {nome}! O {projeto} foi entregue. Como foi trabalhar com a gente?",
    questions: [
      { id: "q-nps", kind: "nps", title: "De 0 a 10, quanto você indicaria o nosso estúdio para um amigo ou parceiro?", help: "", required: true, options: [], aspect: "", showTo: [] },
      { id: "q-comunicacao", kind: "stars", title: "Como foi a comunicação durante o projeto?", help: "", required: false, options: [], aspect: "Comunicação", showTo: [] },
      { id: "q-prazo", kind: "stars", title: "E o cumprimento dos prazos combinados?", help: "", required: false, options: [], aspect: "Prazo", showTo: [] },
      { id: "q-qualidade", kind: "stars", title: "Qual nota você dá para a qualidade da entrega?", help: "Design, código e acabamento.", required: false, options: [], aspect: "Qualidade da entrega", showTo: [] },
      { id: "q-peso", kind: "choice", title: "O que mais pesou na sua nota?", help: "", required: false, options: ["Comunicação", "Prazo", "Qualidade técnica", "Design", "Preço"], aspect: "", showTo: ["passive", "detractor"] },
      { id: "q-denovo", kind: "yesNo", title: "Contrataria a gente de novo?", help: "", required: false, options: [], aspect: "", showTo: [] },
      { id: "q-texto", kind: "text", title: "Quer contar mais alguma coisa?", help: "Elogio, crítica ou sugestão: tudo ajuda.", required: false, options: [], aspect: "", showTo: [] },
    ],
    thanks,
    testimonial: true,
    publicLink: false,
    accent: "var(--sys-blue)",
    updatedAt: "2026-10-18T13:20:00.000Z",
    updatedBy: "Marina Lopes",
  },
  {
    id: "s-suporte",
    name: "Suporte e manutenção",
    status: "active",
    services: ["support", "site"],
    intro: "Oi, {nome}! Faz um tempo que cuidamos do {projeto}. Como está o suporte?",
    questions: [
      { id: "q-nps", kind: "nps", title: "De 0 a 10, quanto você recomendaria o nosso suporte?", help: "", required: true, options: [], aspect: "", showTo: [] },
      { id: "q-resposta", kind: "stars", title: "Como está o tempo de resposta dos chamados?", help: "", required: false, options: [], aspect: "Tempo de resposta", showTo: [] },
      { id: "q-resolucao", kind: "stars", title: "Os problemas são resolvidos de primeira?", help: "", required: false, options: [], aspect: "Resolução", showTo: [] },
      { id: "q-texto", kind: "text", title: "O que podemos melhorar?", help: "", required: false, options: [], aspect: "", showTo: [] },
    ],
    thanks,
    testimonial: false,
    publicLink: true,
    accent: "var(--sys-teal)",
    updatedAt: "2026-09-02T18:05:00.000Z",
    updatedBy: "Rafael Duarte",
  },
  {
    id: "s-kickoff",
    name: "Primeira semana de projeto",
    status: "paused",
    services: ["site", "app", "branding", "ecommerce"],
    intro: "Oi, {nome}! Uma semana de {projeto}. Está tudo claro até aqui?",
    questions: [
      { id: "q-nps", kind: "nps", title: "De 0 a 10, como está a sua experiência até agora?", help: "", required: true, options: [], aspect: "", showTo: [] },
      { id: "q-escopo", kind: "stars", title: "O escopo ficou claro no início?", help: "", required: false, options: [], aspect: "Clareza do escopo", showTo: [] },
      { id: "q-canais", kind: "multiple", title: "Como prefere receber atualizações?", help: "", required: false, options: ["E-mail", "WhatsApp", "Reunião semanal", "Página do projeto"], aspect: "", showTo: [] },
      { id: "q-texto", kind: "text", title: "Alguma dúvida ou preocupação?", help: "", required: false, options: [], aspect: "", showTo: [] },
    ],
    thanks,
    testimonial: false,
    publicLink: false,
    accent: "var(--sys-purple)",
    updatedAt: "2026-06-21T12:40:00.000Z",
    updatedBy: "Caio Mendes",
  },
  {
    id: "s-marca",
    name: "Entrega de identidade visual",
    status: "draft",
    services: ["branding"],
    intro: "Oi, {nome}! A nova marca está nas suas mãos. O que achou?",
    questions: [
      { id: "q-nps", kind: "nps", title: "De 0 a 10, quanto você indicaria o nosso estúdio de design?", help: "", required: true, options: [], aspect: "", showTo: [] },
      { id: "q-apresentacao", kind: "stars", title: "Como foi a apresentação da marca?", help: "", required: false, options: [], aspect: "Apresentação", showTo: [] },
      { id: "q-texto", kind: "text", title: "Quer deixar um comentário?", help: "", required: false, options: [], aspect: "", showTo: [] },
    ],
    thanks,
    testimonial: true,
    publicLink: false,
    accent: "var(--sys-pink)",
    updatedAt: "2026-10-22T20:10:00.000Z",
    updatedBy: "Bianca Torres",
  },
  {
    id: "s-2025",
    name: "Pós-entrega 2025",
    status: "archived",
    services: ["site", "app", "ecommerce"],
    intro: "Oi, {nome}! Como foi o {projeto}?",
    questions: [
      { id: "q-nps", kind: "nps", title: "De 0 a 10, quanto você nos indicaria?", help: "", required: true, options: [], aspect: "", showTo: [] },
      { id: "q-texto", kind: "text", title: "Comentário", help: "", required: false, options: [], aspect: "", showTo: [] },
    ],
    thanks,
    testimonial: false,
    publicLink: false,
    accent: "var(--sys-gray)",
    updatedAt: "2025-12-15T15:00:00.000Z",
    updatedBy: "Marina Lopes",
  },
];

const comments: Record<"promoter" | "passive" | "detractor", string[]> = {
  promoter: [
    "Equipe muito atenciosa, sempre respondeu rápido no WhatsApp e explicou cada etapa.",
    "O site ficou exatamente como imaginávamos e foi entregue antes do prazo.",
    "Design impecável. Os clientes elogiaram a nova identidade logo na primeira semana.",
    "A documentação e o treinamento do painel ajudaram muito o nosso time.",
    "As reuniões semanais deixaram tudo transparente. Recomendo sem pensar duas vezes.",
    "Código bem organizado, o nosso time interno conseguiu dar continuidade sem dor.",
    "Suporte pós-entrega excelente, resolveram um ajuste no mesmo dia.",
    "A loja ficou rápida e as vendas pelo celular subiram já no primeiro mês.",
  ],
  passive: [
    "Bom resultado, mas o prazo final atrasou uma semana.",
    "Gostei do design, só senti falta de mais atualizações durante o desenvolvimento.",
    "Entrega boa, o orçamento ficou um pouco acima do que esperávamos.",
    "A comunicação poderia ser mais proativa, mas a qualidade compensou.",
    "Ficou bonito, ainda estamos aprendendo a mexer no painel.",
  ],
  detractor: [
    "O prazo foi estourado em quase um mês e ninguém avisou com antecedência.",
    "Encontramos vários bugs depois da publicação e o suporte demorou a responder.",
    "O layout final ficou diferente do protótipo aprovado.",
    "Pouca comunicação durante o projeto, tive que cobrar atualizações toda semana.",
    "O orçamento mudou no meio do caminho sem uma conversa clara.",
    "Faltou documentação para o nosso time mexer no painel.",
  ],
};

const iso = (time: number) => new Date(time).toISOString();

/** As respostas dos últimos dias, escritas à mão para a caixa de atendimento abrir com casos de verdade. */
const latest: { clientId: string; score: number; hoursAgo: number; channel: NpsChannel; comment: string }[] = [
  { clientId: "c-educa", score: 3, hoursAgo: 5, channel: "email", comment: "A plataforma saiu com vários bugs no checkout e o suporte demorou dois dias para responder." },
  { clientId: "c-ramalho", score: 10, hoursAgo: 20, channel: "whatsapp", comment: "Portfólio lindo e entregue antes do prazo. A equipe explicou cada etapa do design." },
  { clientId: "c-nogueira", score: 5, hoursAgo: 31, channel: "email", comment: "O layout final ficou diferente do protótipo aprovado e precisamos refazer as fotos dos produtos." },
  { clientId: "c-ferraz", score: 8, hoursAgo: 52, channel: "email", comment: "Site ficou ótimo, só faltou um treinamento do painel para a nossa equipe." },
  { clientId: "c-viver", score: 6, hoursAgo: 75, channel: "whatsapp", comment: "O app atrasou duas semanas e a comunicação sobre o novo prazo foi fraca." },
];

function buildResponses() {
  const pick = random(2026);
  const list: NpsResponse[] = [];

  const add = (owner: NpsClient, score: number, surveyId: string, answeredAt: number, channel: NpsChannel, comment: string) => {
    const group = groupOf(score);
    const survey = surveys.find((item) => item.id === surveyId);
    const answers: Record<string, Answer> = { "q-nps": score };
    for (const question of survey?.questions ?? []) {
      if (question.kind === "stars") answers[question.id] = Math.max(1, Math.min(5, (score >= 9 ? 5 : score >= 7 ? 4 : 2) - (pick() < 0.3 ? 1 : 0) + (score < 7 && pick() < 0.35 ? 1 : 0)));
      if (question.kind === "choice" && group !== "promoter") answers[question.id] = question.options[Math.floor(pick() * question.options.length)];
      if (question.kind === "yesNo") answers[question.id] = score >= 7;
      if (question.kind === "multiple") answers[question.id] = question.options.filter(() => pick() < 0.4);
      if (question.kind === "text" && comment) answers[question.id] = comment;
    }
    list.push({
      id: `r-${list.length + 1}`,
      surveyId,
      clientId: owner.id,
      channel,
      sentAt: channel === "link" ? null : iso(answeredAt - (pick() < 0.4 ? 1 + Math.floor(pick() * 5) : pick() < 0.55 ? 6 + Math.floor(pick() * 16) : 24 + Math.floor(pick() * 60)) * HOUR),
      answeredAt: iso(answeredAt),
      score,
      answers,
      comment,
      themes: themesOf(comment),
      treatmentId: null,
    });
  };

  for (let month = 11; month >= 0; month -= 1) {
    const anchor = new Date(Date.UTC(2026, 9 - month, 1, 12));
    const progress = 11 - month;
    const count = 9 + Math.floor(pick() * 5);
    const promoters = Math.round(count * (0.4 + progress * 0.028));
    const detractors = Math.max(1, Math.round(count * (0.26 - progress * 0.014)));
    const scores = Array.from({ length: count }, (_, index) => (index < promoters ? (pick() < 0.6 ? 10 : 9) : index < promoters + detractors ? Math.floor(pick() * 7) : pick() < 0.5 ? 8 : 7));
    for (let index = scores.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(pick() * (index + 1));
      [scores[index], scores[swap]] = [scores[swap], scores[index]];
    }
    const lastDay = month === 0 ? 21 : new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 0)).getUTCDate();
    for (const score of scores) {
      const owner = clients[Math.floor(pick() * clients.length)];
      const surveyId = owner.project.service === "support" || (owner.project.service === "site" && pick() < 0.25) ? "s-suporte" : progress < 5 && pick() < 0.18 ? "s-kickoff" : progress < 2 ? "s-2025" : "s-entrega";
      const day = 1 + Math.floor(pick() * lastDay);
      const answeredAt = Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), day, 12 + Math.floor(pick() * 11), Math.floor(pick() * 60));
      const channelRoll = pick();
      const channel: NpsChannel = surveyId === "s-suporte" && channelRoll < 0.3 ? "link" : channelRoll < 0.58 ? "email" : "whatsapp";
      const group = groupOf(score);
      const comment = (group === "detractor" && now - answeredAt < 40 * DAY) || pick() < 0.68 ? comments[group][Math.floor(pick() * comments[group].length)] : "";
      add(owner, score, surveyId, answeredAt, channel, comment);
    }
  }

  for (const entry of latest) {
    const owner = clients.find((item) => item.id === entry.clientId);
    if (owner) add(owner, entry.score, "s-entrega", now - entry.hoursAgo * HOUR, entry.channel, entry.comment);
  }

  return list.sort((a, b) => b.answeredAt.localeCompare(a.answeredAt));
}

const responses = buildResponses();

function buildTreatments() {
  const pick = random(77);
  const list: Treatment[] = [];
  const detractors = responses.filter((response) => groupOf(response.score) === "detractor");
  const ongoing: TreatmentStatus[] = ["contacted", "review", "adjustment", "contacted"];
  detractors.forEach((response, index) => {
    const created = Date.parse(response.answeredAt) + 10 * 60_000;
    const age = now - created;
    const status: TreatmentStatus = age < 2 * DAY ? "open" : age < 40 * DAY ? ongoing[index % ongoing.length] : pick() < 0.78 ? "resolved" : "noReply";
    const ownerId = status === "open" && index % 2 === 0 ? null : team[Math.floor(pick() * team.length)].id;
    const owner = team.find((member) => member.id === ownerId);
    const firstContact = status === "open" ? null : Math.min(created + (2 + Math.floor(pick() * 30)) * HOUR, now - 30 * HOUR);
    const events: TreatmentEvent[] = [{ id: `e-${index}-1`, at: iso(created), by: "Specular", kind: "created", text: `Tratativa aberta pela nota ${response.score}.` }];
    if (owner) events.push({ id: `e-${index}-2`, at: iso(created + 20 * 60_000), by: "Marina Lopes", kind: "owner", text: `${owner.name} ficou com a tratativa.` });
    if (firstContact) {
      events.push({ id: `e-${index}-3`, at: iso(firstContact), by: owner?.name ?? "Marina Lopes", kind: "contact", text: "Liguei para o cliente, ouvi o relato e combinei de voltar com um plano até amanhã." });
    }
    if (status === "review" || status === "adjustment" || status === "resolved") {
      events.push({ id: `e-${index}-4`, at: iso((firstContact ?? created) + 6 * HOUR), by: "Rafael Duarte", kind: "note", text: "Revisei o histórico de tarefas: o atraso veio da integração com o pagamento. Vou levantar o que dá para corrigir sem custo." });
    }
    if (status === "adjustment" || status === "resolved") {
      events.push({ id: `e-${index}-5`, at: iso((firstContact ?? created) + 26 * HOUR), by: owner?.name ?? "Caio Mendes", kind: "contact", text: "Ofereci duas semanas de ajustes sem custo e uma revisão do painel com o time do cliente." });
    }
    const closed = status === "resolved" || status === "noReply" ? (firstContact ?? created) + (3 + Math.floor(pick() * 5)) * DAY : null;
    const recovered = status === "resolved" ? pick() < 0.68 : null;
    if (closed) {
      events.push({ id: `e-${index}-6`, at: iso(closed), by: owner?.name ?? "Marina Lopes", kind: "status", text: status === "noReply" ? "Encerrada sem retorno depois de três tentativas." : recovered ? "Resolvida: o cliente saiu satisfeito com o ajuste." : "Resolvida: o cliente segue insatisfeito." });
    }
    const treatment: Treatment = {
      id: `t-${index + 1}`,
      responseId: response.id,
      status,
      ownerId,
      createdAt: iso(created),
      dueAt: iso(created + 24 * HOUR),
      firstContactAt: firstContact ? iso(firstContact) : null,
      closedAt: closed ? iso(closed) : null,
      recovered,
      events,
    };
    response.treatmentId = treatment.id;
    list.push(treatment);
  });
  return list;
}

const treatments = buildTreatments();

const rules: DispatchRule[] = [
  { id: "d-entrega", name: "Pós-entrega por e-mail", active: true, surveyId: "s-entrega", services: ["site", "app", "branding", "ecommerce"], event: "projectDone", delayHours: 48, channel: "email", message: "Como foi o {projeto}? Sua opinião leva um minuto", reminderHours: 72, quietFrom: "21:00", quietTo: "08:00", cooldownDays: 90 },
  { id: "d-aprovacao", name: "Aprovação no WhatsApp", active: true, surveyId: "s-entrega", services: ["site", "app", "ecommerce"], event: "deliveryApproved", delayHours: 24, channel: "whatsapp", message: "Oi, {nome}! A entrega do {projeto} foi aprovada. Pode nos dar uma nota de 0 a 10?", reminderHours: 48, quietFrom: "20:00", quietTo: "09:00", cooldownDays: 60 },
  { id: "d-suporte", name: "Suporte a cada 90 dias", active: true, surveyId: "s-suporte", services: ["support", "site"], event: "supportCheck", delayHours: 2160, channel: "email", message: "Como está o suporte do {projeto}?", reminderHours: null, quietFrom: "21:00", quietTo: "08:00", cooldownDays: 120 },
  { id: "d-cobranca", name: "Depois da última parcela", active: false, surveyId: "s-entrega", services: ["site", "app", "branding", "ecommerce"], event: "chargePaid", delayHours: 6, channel: "email", message: "Projeto quitado. Conta para a gente como foi?", reminderHours: 96, quietFrom: "21:00", quietTo: "08:00", cooldownDays: 90 },
];

function buildSends() {
  const pick = random(404);
  const list: NpsSend[] = [];
  for (const response of responses) {
    if (!response.sentAt) continue;
    const ruleId = response.surveyId === "s-suporte" ? (response.channel === "email" ? "d-suporte" : null) : response.channel === "whatsapp" ? "d-aprovacao" : pick() < 0.15 ? null : "d-entrega";
    list.push({ id: `n-${list.length + 1}`, ruleId, surveyId: response.surveyId, clientId: response.clientId, channel: response.channel, scheduledAt: response.sentAt, sentAt: response.sentAt, status: "answered", reminded: pick() < 0.4, responseId: response.id, error: "" });
  }
  const unanswered = Math.round(list.length * 0.65);
  for (let index = 0; index < unanswered; index += 1) {
    const sentAt = now - (2 + Math.floor(pick() * 360)) * DAY - Math.floor(pick() * 10) * HOUR;
    const owner = clients[Math.floor(pick() * clients.length)];
    const channel: NpsChannel = pick() < 0.6 ? "email" : "whatsapp";
    const roll = pick();
    const status = roll < 0.38 ? "delivered" : roll < 0.7 ? "read" : roll < 0.84 ? "sent" : roll < 0.95 ? "failed" : "cancelled";
    list.push({
      id: `n-${list.length + 1}`,
      ruleId: owner.project.service === "support" ? "d-suporte" : channel === "whatsapp" ? "d-aprovacao" : "d-entrega",
      surveyId: owner.project.service === "support" ? "s-suporte" : "s-entrega",
      clientId: owner.id,
      channel,
      scheduledAt: iso(sentAt),
      sentAt: status === "cancelled" ? null : iso(sentAt),
      status,
      reminded: status !== "cancelled" && pick() < 0.35,
      responseId: null,
      error: status === "failed" ? (channel === "email" ? "O servidor do cliente recusou o e-mail." : "O número não tem WhatsApp.") : "",
    });
  }
  const queue = ["c-ramalho", "c-educa", "c-ferraz", "c-nogueira", "c-prado", "c-viver"];
  queue.forEach((clientId, index) => {
    list.push({ id: `n-${list.length + 1}`, ruleId: index % 3 === 1 ? "d-aprovacao" : "d-entrega", surveyId: "s-entrega", clientId, channel: index % 3 === 1 ? "whatsapp" : "email", scheduledAt: iso(now + (3 + index * 9) * HOUR), sentAt: null, status: "scheduled", reminded: false, responseId: null, error: "" });
  });
  return list.sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt));
}

const sends = buildSends();

/** O NPS de exemplo inteiro, no formato que a consulta do banco vai devolver. */
export function npsSample(): NpsData {
  return { now: NOW, team, clients, surveys, responses, treatments, rules, sends };
}

/** A pesquisa que nasce do "Nova pesquisa": rascunho com a nota de 0 a 10 e um comentário. */
export function newSurvey(name: string): Survey {
  return {
    id: "nova",
    name,
    status: "draft",
    services: ["site", "app", "branding", "ecommerce"],
    intro: "Oi, {nome}! Como foi o {projeto}?",
    questions: [
      { id: "q-nps", kind: "nps", title: "De 0 a 10, quanto você indicaria o nosso estúdio para um amigo?", help: "", required: true, options: [], aspect: "", showTo: [] },
      { id: "q-texto", kind: "text", title: "Quer contar mais alguma coisa?", help: "", required: false, options: [], aspect: "", showTo: [] },
    ],
    thanks,
    testimonial: true,
    publicLink: false,
    accent: "var(--sys-blue)",
    updatedAt: NOW,
    updatedBy: "Você",
  };
}
