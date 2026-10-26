import { flowFromStarter, isFlowStarter } from "./flow-catalog";
import type {
  ContactList,
  EmailBlock,
  EmailCampaign,
  EmailData,
  EmailHue,
  EmailStats,
  EmailTemplate,
  Flow,
  FlowButton,
  FlowChannel,
  FlowEdge,
  FlowStep,
  FlowStepData,
} from "./types";

/*
 * Dados de exemplo do marketing de um estúdio de desenvolvimento e design. Servem só à interface enquanto o
 * domínio não existe no banco: quando existir, as páginas trocam estas constantes pelas consultas.
 */

const SENDER = { name: "Estúdio Linha", email: "contato@estudiolinha.com.br" };

export const sampleContactLists: ContactList[] = [
  { id: "lst-clientes", name: "Clientes ativos", description: "Quem tem projeto ou manutenção em andamento", count: 86, kind: "lista" },
  { id: "lst-leads", name: "Leads do site", description: "Pediram orçamento pelo site nos últimos 90 dias", count: 412, kind: "segmento" },
  { id: "lst-news", name: "Newsletter do estúdio", description: "Assinaram a newsletter no site ou no portfólio", count: 1840, kind: "lista" },
  { id: "lst-inativos", name: "Clientes sem projeto há 6 meses", description: "Já fecharam com o estúdio e estão parados", count: 54, kind: "segmento" },
  { id: "lst-parceiros", name: "Agências parceiras", description: "Agências que terceirizam desenvolvimento", count: 38, kind: "lista" },
  { id: "lst-webinar", name: "Inscritos no webinar", description: "Inscritos no webinar de UX para e-commerce", count: 267, kind: "lista" },
];

let blockCounter = 0;
const id = () => `blk-${(blockCounter += 1)}`;
const heading = (text: string): EmailBlock => ({ id: id(), kind: "heading", text });
const text = (value: string): EmailBlock => ({ id: id(), kind: "text", text: value });
const button = (label: string, href: string): EmailBlock => ({ id: id(), kind: "button", label, href });
const image = (caption: string): EmailBlock => ({ id: id(), kind: "image", caption });
const list = (items: string[]): EmailBlock => ({ id: id(), kind: "list", items });
const quote = (value: string, author: string): EmailBlock => ({ id: id(), kind: "quote", text: value, author });
const divider = (): EmailBlock => ({ id: id(), kind: "divider" });

export const sampleEmailTemplates: EmailTemplate[] = [
  {
    id: "tpl-proposta",
    name: "Follow-up de proposta",
    description: "Lembrete gentil para quem recebeu a proposta e ainda não respondeu",
    category: "relacionamento",
    hue: "blue",
    subject: "{{primeiro_nome}}, ficou alguma dúvida sobre a proposta?",
    preheader: "Posso ajustar escopo, prazo ou forma de pagamento",
    custom: true,
    blocks: [
      heading("Ficou alguma dúvida, {{primeiro_nome}}?"),
      text("Mandei a proposta do projeto na semana passada e queria saber se está tudo claro. Se precisar, ajusto o escopo, o prazo ou a forma de pagamento."),
      button("Rever a proposta", "https://estudiolinha.com.br/proposta"),
      text("Um abraço,\nMarina, do Estúdio Linha"),
    ],
  },
  {
    id: "tpl-boas-vindas",
    name: "Boas-vindas ao novo cliente",
    description: "Primeiro e-mail depois do contrato assinado, com os próximos passos",
    category: "boas-vindas",
    hue: "green",
    subject: "Bem-vindo ao Estúdio Linha, {{primeiro_nome}}",
    preheader: "Os próximos passos do seu projeto",
    blocks: [
      image("Equipe do estúdio"),
      heading("Que bom ter você aqui, {{primeiro_nome}}"),
      text("O contrato está assinado e o projeto da {{empresa}} já tem lugar na nossa agenda. Veja o que acontece nas próximas duas semanas:"),
      list(["Reunião de kickoff para alinhar objetivos", "Acesso ao painel de aprovações", "Primeira entrega de wireframes em 10 dias úteis"]),
      button("Marcar o kickoff", "https://estudiolinha.com.br/agenda"),
    ],
  },
  {
    id: "tpl-newsletter",
    name: "Newsletter mensal",
    description: "Novidades do estúdio, um artigo em destaque e os cases do mês",
    category: "newsletter",
    hue: "blue",
    subject: "O que aprendemos este mês sobre sites que vendem",
    preheader: "Um artigo, dois cases e uma ferramenta que mudou nosso fluxo",
    blocks: [
      heading("Linha do mês"),
      text("Oi, {{primeiro_nome}}! Separamos o que mais deu resultado nos projetos deste mês."),
      image("Artigo em destaque"),
      heading("Cinco ajustes que aumentam a conversão de uma landing page"),
      text("Do tamanho do formulário à prova social acima da dobra: o que testamos em doze projetos e o que ficou."),
      button("Ler o artigo", "https://estudiolinha.com.br/blog/conversao"),
      divider(),
      list(["Case: novo site da Clínica Vitta", "Ferramenta: como usamos o Figma Dev Mode", "Agenda: webinar de UX para e-commerce"]),
    ],
  },
  {
    id: "tpl-case",
    name: "Lançamento de case",
    description: "Mostra um projeto entregue com resultado e depoimento",
    category: "newsletter",
    hue: "purple",
    subject: "Case: como dobramos os agendamentos da Clínica Vitta",
    preheader: "Do diagnóstico ao app no ar em 9 semanas",
    blocks: [
      image("Telas do app da Clínica Vitta"),
      heading("Agendamentos online cresceram 112%"),
      text("A Clínica Vitta perdia pacientes no telefone. Desenhamos um app de agendamento com lembretes automáticos e integração com a agenda da recepção."),
      quote("Hoje metade das consultas é marcada pelo app, fora do horário comercial.", "Dra. Paula Rezende, Clínica Vitta"),
      button("Ver o case completo", "https://estudiolinha.com.br/cases/vitta"),
    ],
  },
  {
    id: "tpl-manutencao",
    name: "Oferta de manutenção",
    description: "Pacote de manutenção com condição especial e prazo",
    category: "oferta",
    hue: "orange",
    subject: "Seu site em dia o ano inteiro, com 30% de desconto",
    preheader: "Condição válida até sexta para clientes do estúdio",
    blocks: [
      heading("Manutenção sem susto"),
      text("Atualizações de segurança, backup diário, ajustes de conteúdo e relatório mensal de desempenho. Tudo num plano só."),
      list(["Até 6 horas de ajustes por mês", "Monitoramento de queda 24 horas", "Relatório de velocidade e SEO"]),
      button("Quero o plano com desconto", "https://estudiolinha.com.br/manutencao"),
      text("Condição válida até sexta-feira para clientes ativos."),
    ],
  },
  {
    id: "tpl-depoimento",
    name: "Pedido de depoimento",
    description: "Pede uma avaliação curta depois da entrega do projeto",
    category: "relacionamento",
    hue: "pink",
    subject: "{{primeiro_nome}}, como foi trabalhar com a gente?",
    preheader: "Leva dois minutos e ajuda muito o estúdio",
    blocks: [
      heading("Seu projeto está no ar"),
      text("Foi muito bom construir isso com a {{empresa}}. Se puder contar em poucas linhas como foi a experiência, a sua opinião ajuda outras empresas a nos conhecerem."),
      button("Deixar o depoimento", "https://estudiolinha.com.br/depoimento"),
    ],
  },
  {
    id: "tpl-webinar",
    name: "Convite para webinar",
    description: "Convite com data, pauta e inscrição",
    category: "evento",
    hue: "teal",
    subject: "Webinar gratuito: UX que vende no e-commerce",
    preheader: "Quinta, 19h, ao vivo e com perguntas no fim",
    blocks: [
      image("Chamada do webinar"),
      heading("UX que vende no e-commerce"),
      text("Uma hora ao vivo com a nossa equipe de design mostrando os padrões de checkout que mais converteram em 2026."),
      list(["Quinta-feira, 30 de outubro, às 19h", "Online e gratuito", "Gravação para os inscritos"]),
      button("Garantir a minha vaga", "https://estudiolinha.com.br/webinar"),
    ],
  },
  {
    id: "tpl-simples",
    name: "E-mail simples",
    description: "Texto direto, sem imagem, como um e-mail pessoal",
    category: "simples",
    hue: "indigo",
    subject: "Uma novidade do estúdio",
    preheader: "",
    blocks: [text("Oi, {{primeiro_nome}}!"), text("Escreva aqui o seu recado."), text("Um abraço,\nEquipe Estúdio Linha")],
  },
];

const template = (templateId: string) => sampleEmailTemplates.find((item) => item.id === templateId) ?? sampleEmailTemplates[0];

const stats = (recipients: number, deliveredShare: number, opensShare: number, clicksShare: number, unsubscribes: number, spam: number, links: [string, string, number][]): EmailStats => {
  const delivered = Math.round(recipients * deliveredShare);
  const opens = Math.round(delivered * opensShare);
  const clicks = Math.round(delivered * clicksShare);
  const curve = [0.28, 0.17, 0.14, 0.1, 0.08, 0.09, 0.09, 0.05];
  return {
    recipients,
    delivered,
    opens,
    clicks,
    bounces: recipients - delivered,
    unsubscribes,
    spam,
    links: links.map(([label, url, share]) => ({ label, url, clicks: Math.round(clicks * share) })),
    hourly: curve.map((share) => Math.round(opens * share)),
  };
};

const campaign = (
  input: Pick<EmailCampaign, "id" | "name" | "status" | "audience" | "updatedAt" | "createdBy"> & {
    templateId: string;
    subject?: string;
    sentAt?: string;
    scheduledAt?: string;
    stats?: EmailStats;
    hue?: EmailHue;
  },
): EmailCampaign => {
  const base = template(input.templateId);
  return {
    id: input.id,
    name: input.name,
    subject: input.subject ?? base.subject,
    preheader: base.preheader,
    fromName: SENDER.name,
    fromEmail: SENDER.email,
    audience: input.audience,
    status: input.status,
    scheduledAt: input.scheduledAt ?? null,
    sentAt: input.sentAt ?? null,
    updatedAt: input.updatedAt,
    createdBy: input.createdBy,
    templateId: base.id,
    hue: input.hue ?? base.hue,
    blocks: base.blocks.map((block) => ({ ...block, id: `${input.id}-${block.id}` })),
    stats: input.stats ?? null,
  };
};

export const sampleEmailCampaigns: EmailCampaign[] = [
  campaign({
    id: "em-01",
    name: "Newsletter de outubro",
    status: "sent",
    audience: ["lst-news"],
    templateId: "tpl-newsletter",
    sentAt: "2026-10-02T13:00:00.000Z",
    updatedAt: "2026-10-02T12:41:00.000Z",
    createdBy: "Marina Costa",
    stats: stats(1812, 0.982, 0.395, 0.049, 6, 1, [
      ["Ler o artigo", "https://estudiolinha.com.br/blog/conversao", 0.54],
      ["Case: Clínica Vitta", "https://estudiolinha.com.br/cases/vitta", 0.27],
      ["Inscrição no webinar", "https://estudiolinha.com.br/webinar", 0.19],
    ]),
  }),
  campaign({
    id: "em-02",
    name: "Case: app da Clínica Vitta",
    status: "sent",
    audience: ["lst-news", "lst-leads"],
    templateId: "tpl-case",
    sentAt: "2026-10-14T14:30:00.000Z",
    updatedAt: "2026-10-14T13:58:00.000Z",
    createdBy: "Bianca Lima",
    stats: stats(2028, 0.976, 0.421, 0.067, 9, 2, [
      ["Ver o case completo", "https://estudiolinha.com.br/cases/vitta", 0.78],
      ["Falar com o estúdio", "https://estudiolinha.com.br/contato", 0.22],
    ]),
  }),
  campaign({
    id: "em-03",
    name: "Pacote de manutenção com desconto",
    status: "sent",
    audience: ["lst-clientes", "lst-inativos"],
    templateId: "tpl-manutencao",
    sentAt: "2026-10-20T12:00:00.000Z",
    updatedAt: "2026-10-20T11:20:00.000Z",
    createdBy: "Thiago Alves",
    stats: stats(124, 0.992, 0.613, 0.145, 1, 0, [["Quero o plano com desconto", "https://estudiolinha.com.br/manutencao", 1]]),
  }),
  campaign({
    id: "em-04",
    name: "Convite: webinar de UX para e-commerce",
    status: "sent",
    audience: ["lst-news", "lst-leads"],
    templateId: "tpl-webinar",
    sentAt: "2026-09-24T15:00:00.000Z",
    updatedAt: "2026-09-24T14:12:00.000Z",
    createdBy: "Bianca Lima",
    stats: stats(2014, 0.979, 0.366, 0.081, 12, 3, [["Garantir a minha vaga", "https://estudiolinha.com.br/webinar", 1]]),
  }),
  campaign({
    id: "em-05",
    name: "Newsletter de setembro",
    status: "sent",
    audience: ["lst-news"],
    templateId: "tpl-newsletter",
    subject: "Três sites que redesenhamos e o que mudou nos números",
    sentAt: "2026-09-03T13:00:00.000Z",
    updatedAt: "2026-09-03T12:30:00.000Z",
    createdBy: "Marina Costa",
    stats: stats(1764, 0.98, 0.341, 0.038, 8, 2, [
      ["Ler o artigo", "https://estudiolinha.com.br/blog/redesign", 0.61],
      ["Ver os cases", "https://estudiolinha.com.br/cases", 0.39],
    ]),
  }),
  campaign({
    id: "em-06",
    name: "Pedido de depoimento do trimestre",
    status: "sent",
    audience: ["lst-clientes"],
    templateId: "tpl-depoimento",
    sentAt: "2026-09-30T17:00:00.000Z",
    updatedAt: "2026-09-30T16:40:00.000Z",
    createdBy: "Marina Costa",
    stats: stats(86, 1, 0.71, 0.27, 0, 0, [["Deixar o depoimento", "https://estudiolinha.com.br/depoimento", 1]]),
  }),
  campaign({
    id: "em-07",
    name: "Lembrete: webinar começa amanhã",
    status: "scheduled",
    audience: ["lst-webinar"],
    templateId: "tpl-webinar",
    subject: "Amanhã às 19h: UX que vende no e-commerce",
    scheduledAt: "2026-10-29T12:00:00.000Z",
    updatedAt: "2026-10-23T18:05:00.000Z",
    createdBy: "Bianca Lima",
  }),
  campaign({
    id: "em-08",
    name: "Newsletter de novembro",
    status: "scheduled",
    audience: ["lst-news"],
    templateId: "tpl-newsletter",
    subject: "Novembro no estúdio: design system em 3 semanas",
    scheduledAt: "2026-11-04T13:00:00.000Z",
    updatedAt: "2026-10-24T20:15:00.000Z",
    createdBy: "Marina Costa",
  }),
  campaign({
    id: "em-09",
    name: "Reativação: novidades do estúdio",
    status: "draft",
    audience: ["lst-inativos"],
    templateId: "tpl-simples",
    subject: "Faz tempo, {{primeiro_nome}}! Olha o que mudou por aqui",
    updatedAt: "2026-10-24T15:32:00.000Z",
    createdBy: "Thiago Alves",
  }),
  campaign({
    id: "em-10",
    name: "Boas-vindas: Padaria Grão Fino",
    status: "draft",
    audience: [],
    templateId: "tpl-boas-vindas",
    updatedAt: "2026-10-22T10:08:00.000Z",
    createdBy: "Rafael Souza",
  }),
  campaign({
    id: "em-11",
    name: "Redesign para agências parceiras",
    status: "draft",
    audience: ["lst-parceiros"],
    templateId: "tpl-manutencao",
    subject: "Terceirize o front-end dos seus clientes com prazo garantido",
    hue: "purple",
    updatedAt: "2026-10-19T09:44:00.000Z",
    createdBy: "Thiago Alves",
  }),
];

export const sampleEmailData: EmailData = {
  campaigns: sampleEmailCampaigns,
  templates: sampleEmailTemplates,
  lists: sampleContactLists,
  sender: SENDER,
  author: "Marina Costa",
};

/* ------------------------------------------------ fluxos ----------------------------------------------- */

const step = (stepId: string, title: string, x: number, y: number, data: FlowStepData): FlowStep => ({ id: stepId, title, x, y, data });
const edge = (from: string, port: string, to: string): FlowEdge => ({ id: `${from}-${port}-${to}`, from, port, to });
const buttons = (...labels: string[]): FlowButton[] => labels.map((label, index) => ({ id: `b${index + 1}`, label }));
const message = (channel: FlowChannel, texts: string[], options: { buttons?: FlowButton[]; waitReply?: boolean; subject?: string } = {}): FlowStepData => ({
  kind: "message",
  message: { channel, texts, buttons: options.buttons ?? [], waitReply: options.waitReply ?? false, ...(options.subject ? { subject: options.subject } : {}) },
});

export const sampleFlows: Flow[] = [
  {
    id: "fl-portfolio",
    name: "Comentou PORTFÓLIO, recebe no direct",
    folder: "Instagram",
    status: "live",
    entered: 684,
    completed: 512,
    updatedAt: "2026-10-23T16:20:00.000Z",
    publishedAt: "2026-10-01T12:00:00.000Z",
    createdBy: "Bianca Lima",
    steps: [
      step("t", "Quando", 0, 160, { kind: "trigger", triggers: [{ id: "t1", kind: "ig-comment", value: "PORTFÓLIO", publicReplies: ["Te mandei no direct!", "Olha o seu direct", "Enviado, confere lá"] }] }),
      step("c", "Segue o perfil?", 400, 160, { kind: "condition", match: "all", rules: [{ id: "r1", field: "Segue o perfil", operator: "is", value: "Sim" }] }),
      step("m1", "Envia o portfólio", 800, 0, message("instagram", ["Oi, {{primeiro_nome}}! Aqui está o portfólio completo do estúdio: {{link_portfolio}}", "Quer que eu te mande uma estimativa para o seu projeto?"], { buttons: buttons("Quero um orçamento", "Só olhando") })),
      step("m2", "Pede para seguir", 800, 400, message("instagram", ["Quase lá, {{primeiro_nome}}! Me segue aqui e toca no botão que eu libero o link."], { buttons: buttons("Já segui") })),
      step("ai", "Qualifica o projeto", 1220, -60, { kind: "ai", goal: "Entender o tipo de projeto, o prazo e a faixa de investimento, e oferecer a agenda", handoff: "Pedir para falar com uma pessoa" }),
      step("a", "Cria a oportunidade", 1640, -60, {
        kind: "actions",
        actions: [
          { id: "a1", kind: "add-tag", value: "lead-instagram" },
          { id: "a2", kind: "create-opportunity", value: "Funil comercial, Novo contato" },
          { id: "a3", kind: "notify-team", value: "Lead do portfólio pronto para proposta" },
        ],
      }),
      step("d", "Espera 2 dias", 1220, 240, { kind: "delay", delay: { mode: "for", amount: 2, unit: "dias" } }),
      step("m3", "Lembrete gentil", 1640, 240, message("instagram", ["Oi de novo, {{primeiro_nome}}! Viu algum projeto que tem a ver com o seu? Se quiser, te mostro como ficaria."])),
    ],
    edges: [edge("t", "next", "c"), edge("c", "yes", "m1"), edge("c", "no", "m2"), edge("m2", "btn:b1", "c"), edge("m1", "btn:b1", "ai"), edge("ai", "done", "a"), edge("m1", "btn:b2", "d"), edge("d", "next", "m3")],
    stats: {
      t: { sent: 684, clicked: 0, ports: { next: 684 } },
      c: { sent: 812, clicked: 0, ports: { yes: 655, no: 157 } },
      m1: { sent: 655, clicked: 498, ports: { "btn:b1": 214, "btn:b2": 284 } },
      m2: { sent: 157, clicked: 128, ports: { "btn:b1": 128 } },
      ai: { sent: 214, clicked: 0, ports: { done: 162, handoff: 41 } },
      a: { sent: 162, clicked: 0, ports: {} },
      d: { sent: 284, clicked: 0, ports: { next: 279 } },
      m3: { sent: 279, clicked: 36, ports: {} },
    },
  },
  {
    id: "fl-site",
    name: "Palavra SITE no direct",
    folder: "Instagram",
    status: "live",
    entered: 231,
    completed: 148,
    updatedAt: "2026-10-21T11:05:00.000Z",
    publishedAt: "2026-09-12T12:00:00.000Z",
    createdBy: "Marina Costa",
    steps: [
      step("t", "Quando", 0, 120, { kind: "trigger", triggers: [{ id: "t1", kind: "ig-dm-keyword", value: "SITE, ORÇAMENTO, PREÇO", publicReplies: [] }] }),
      step("m1", "Pergunta o negócio", 400, 120, message("instagram", ["Oi, {{primeiro_nome}}! Que bom que você quer um site novo.", "Me conta rapidinho: é para qual negócio?"], { waitReply: true })),
      step("ai", "Entende o escopo", 820, 0, { kind: "ai", goal: "Descobrir páginas, integrações e prazo e propor uma call de 20 minutos", handoff: "Pedir para falar com uma pessoa" }),
      step("i", "Coleta o e-mail", 1240, 0, { kind: "input", question: "Para onde eu mando a proposta? Pode ser o seu melhor e-mail.", field: "email", saveAs: "email", retry: "Esse e-mail parece incompleto. Pode conferir?" }),
      step("a", "Leva para o funil", 1660, 0, {
        kind: "actions",
        actions: [
          { id: "a1", kind: "create-opportunity", value: "Funil comercial, Proposta" },
          { id: "a2", kind: "assign", value: "Thiago Alves" },
        ],
      }),
      step("d", "Espera 1 dia", 820, 320, { kind: "delay", delay: { mode: "for", amount: 1, unit: "dias" } }),
      step("m2", "Retoma a conversa", 1240, 320, message("instagram", ["{{primeiro_nome}}, ainda quer conversar sobre o site? Separei três projetos parecidos com o que você procura."], { buttons: buttons("Quero ver") })),
    ],
    edges: [edge("t", "next", "m1"), edge("m1", "reply", "ai"), edge("m1", "noreply", "d"), edge("ai", "done", "i"), edge("i", "reply", "a"), edge("d", "next", "m2"), edge("m2", "btn:b1", "ai")],
    stats: {
      t: { sent: 231, clicked: 0, ports: { next: 231 } },
      m1: { sent: 231, clicked: 0, ports: { reply: 176, noreply: 55 } },
      ai: { sent: 198, clicked: 0, ports: { done: 157, handoff: 29 } },
      i: { sent: 157, clicked: 0, ports: { reply: 148, noreply: 9 } },
      a: { sent: 148, clicked: 0, ports: {} },
      d: { sent: 55, clicked: 0, ports: { next: 55 } },
      m2: { sent: 55, clicked: 22, ports: { "btn:b1": 22 } },
    },
  },
  {
    id: "fl-whatsapp",
    name: "Orçamento pelo WhatsApp",
    folder: "WhatsApp",
    status: "live",
    entered: 402,
    completed: 271,
    updatedAt: "2026-10-18T09:30:00.000Z",
    publishedAt: "2026-08-28T12:00:00.000Z",
    createdBy: "Thiago Alves",
    steps: [
      step("t", "Quando", 0, 140, { kind: "trigger", triggers: [{ id: "t1", kind: "wa-keyword", value: "orçamento, site, app, logo", publicReplies: [] }] }),
      step("m1", "Escolha do serviço", 400, 140, message("whatsapp", ["Olá, {{primeiro_nome}}! Aqui é do Estúdio Linha.", "Para montar o seu orçamento, qual serviço você procura?"], { buttons: buttons("Site", "Aplicativo", "Identidade visual") })),
      step("i", "Coleta o e-mail", 820, 140, { kind: "input", question: "Perfeito! Qual o seu e-mail para eu mandar a estimativa e os cases?", field: "email", saveAs: "email", retry: "Não consegui ler esse e-mail. Pode mandar de novo?" }),
      step("a", "Cria a oportunidade", 1240, 60, {
        kind: "actions",
        actions: [
          { id: "a1", kind: "set-field", value: "servico = escolha do botão" },
          { id: "a2", kind: "create-opportunity", value: "Funil comercial, Novo contato" },
          { id: "a3", kind: "notify-team", value: "Pedido de orçamento no WhatsApp" },
        ],
      }),
      step("m2", "Confirma o recebimento", 1660, 60, message("whatsapp", ["Recebido! Em até um dia útil a Marina te manda a estimativa. Enquanto isso, dá uma olhada no portfólio: {{link_portfolio}}"])),
      step("j", "Vai para o fluxo do site", 1240, 340, { kind: "jump", flowId: "fl-site" }),
    ],
    edges: [edge("t", "next", "m1"), edge("m1", "btn:b1", "i"), edge("m1", "btn:b2", "i"), edge("m1", "btn:b3", "i"), edge("i", "reply", "a"), edge("i", "noreply", "j"), edge("a", "next", "m2")],
    stats: {
      t: { sent: 402, clicked: 0, ports: { next: 402 } },
      m1: { sent: 402, clicked: 344, ports: { "btn:b1": 201, "btn:b2": 88, "btn:b3": 55 } },
      i: { sent: 344, clicked: 0, ports: { reply: 271, noreply: 73 } },
      a: { sent: 271, clicked: 0, ports: { next: 271 } },
      m2: { sent: 271, clicked: 64, ports: {} },
      j: { sent: 73, clicked: 0, ports: {} },
    },
  },
  {
    id: "fl-formulario",
    name: "Lead do formulário do site",
    folder: "Site",
    status: "live",
    entered: 96,
    completed: 61,
    updatedAt: "2026-10-12T14:45:00.000Z",
    publishedAt: "2026-09-01T12:00:00.000Z",
    createdBy: "Marina Costa",
    steps: [
      step("t", "Quando", 0, 120, { kind: "trigger", triggers: [{ id: "t1", kind: "site-form", value: "Contato do site", publicReplies: [] }] }),
      step("m1", "E-mail de boas-vindas", 400, 120, message("email", ["Oi, {{primeiro_nome}}! Recebemos o seu contato e já estamos olhando o que você mandou.", "Quer adiantar? Escolha um horário para conversarmos: {{link_agenda}}"], { subject: "Recebemos o seu contato, {{primeiro_nome}}" })),
      step("d", "Espera 2 dias", 820, 120, { kind: "delay", delay: { mode: "for", amount: 2, unit: "dias" } }),
      step("c", "Marcou conversa?", 1240, 120, { kind: "condition", match: "any", rules: [{ id: "r1", field: "Etiqueta", operator: "has-tag", value: "reuniao-marcada" }] }),
      step("m2", "Chama no WhatsApp", 1660, 260, message("whatsapp", ["Oi, {{primeiro_nome}}! Aqui é a Marina, do Estúdio Linha. Vi o seu pedido pelo site. Posso te ligar amanhã?"], { buttons: buttons("Pode ligar", "Prefiro por mensagem") })),
    ],
    edges: [edge("t", "next", "m1"), edge("m1", "next", "d"), edge("d", "next", "c"), edge("c", "no", "m2")],
    stats: {
      t: { sent: 96, clicked: 0, ports: { next: 96 } },
      m1: { sent: 96, clicked: 41, ports: { next: 96 } },
      d: { sent: 96, clicked: 0, ports: { next: 96 } },
      c: { sent: 96, clicked: 0, ports: { yes: 47, no: 49 } },
      m2: { sent: 49, clicked: 31, ports: { "btn:b1": 19, "btn:b2": 12 } },
    },
  },
  {
    id: "fl-story",
    name: "Resposta ao story de bastidores",
    folder: "Instagram",
    status: "paused",
    entered: 58,
    completed: 31,
    updatedAt: "2026-10-05T19:10:00.000Z",
    publishedAt: "2026-09-20T12:00:00.000Z",
    createdBy: "Bianca Lima",
    steps: [
      step("t", "Quando", 0, 100, { kind: "trigger", triggers: [{ id: "t1", kind: "ig-story-reply", value: "", publicReplies: [] }] }),
      step("m1", "Agradece a resposta", 400, 100, message("instagram", ["Valeu por responder o story, {{primeiro_nome}}!", "Quer ver como esse projeto ficou por dentro?"], { buttons: buttons("Quero ver", "Agora não") })),
      step("m2", "Manda o case", 820, 0, message("instagram", ["Aqui está o case completo, com o antes e o depois: {{link_portfolio}}"])),
    ],
    edges: [edge("t", "next", "m1"), edge("m1", "btn:b1", "m2")],
    stats: {
      t: { sent: 58, clicked: 0, ports: { next: 58 } },
      m1: { sent: 58, clicked: 39, ports: { "btn:b1": 31, "btn:b2": 8 } },
      m2: { sent: 31, clicked: 12, ports: {} },
    },
  },
  {
    id: "fl-reativacao",
    name: "Reativar clientes antigos",
    folder: "Relacionamento",
    status: "draft",
    entered: 0,
    completed: 0,
    updatedAt: "2026-10-24T17:50:00.000Z",
    publishedAt: null,
    createdBy: "Thiago Alves",
    steps: [
      step("t", "Quando", 0, 160, { kind: "trigger", triggers: [{ id: "t1", kind: "tag-added", value: "inativo-6-meses", publicReplies: [] }] }),
      step("r", "Teste de abordagem", 400, 160, {
        kind: "randomizer",
        variants: [
          { id: "va", label: "A", weight: 50 },
          { id: "vb", label: "B", weight: 50 },
        ],
      }),
      step("m1", "Abordagem pela novidade", 820, 20, message("whatsapp", ["Oi, {{primeiro_nome}}! Lançamos um plano de manutenção que cuida do site da {{empresa}} o ano inteiro. Quer conhecer?"], { buttons: buttons("Quero conhecer") })),
      step("m2", "Abordagem pelo resultado", 820, 320, message("whatsapp", ["Oi, {{primeiro_nome}}! Fizemos um diagnóstico rápido do site da {{empresa}} e achamos três melhorias fáceis. Posso te mandar?"], { buttons: buttons("Pode mandar") })),
    ],
    edges: [edge("t", "next", "r"), edge("r", "var:va", "m1"), edge("r", "var:vb", "m2")],
    stats: {},
  },
  {
    id: "fl-depoimento",
    name: "Pós-entrega: pedir depoimento",
    folder: "Relacionamento",
    status: "paused",
    entered: 23,
    completed: 14,
    updatedAt: "2026-09-29T10:00:00.000Z",
    publishedAt: "2026-08-15T12:00:00.000Z",
    createdBy: "Marina Costa",
    steps: [
      step("t", "Quando", 0, 120, { kind: "trigger", triggers: [{ id: "t1", kind: "tag-added", value: "projeto-entregue", publicReplies: [] }] }),
      step("d", "Espera 7 dias", 400, 120, { kind: "delay", delay: { mode: "for", amount: 7, unit: "dias" } }),
      step("m1", "Pede o depoimento", 820, 120, message("whatsapp", ["Oi, {{primeiro_nome}}! O projeto está no ar faz uma semana. Como está sendo?", "Se puder deixar um depoimento curto, ajuda muito o estúdio."], { buttons: buttons("Deixar depoimento", "Agora não") })),
      step("a", "Marca como promotor", 1240, 40, { kind: "actions", actions: [{ id: "a1", kind: "add-tag", value: "promotor" }] }),
    ],
    edges: [edge("t", "next", "d"), edge("d", "next", "m1"), edge("m1", "btn:b1", "a")],
    stats: {
      t: { sent: 23, clicked: 0, ports: { next: 23 } },
      d: { sent: 23, clicked: 0, ports: { next: 23 } },
      m1: { sent: 23, clicked: 17, ports: { "btn:b1": 14, "btn:b2": 3 } },
      a: { sent: 14, clicked: 0, ports: {} },
    },
  },
];

/** Nome e endereço de cada fluxo, para o passo que leva a outro fluxo. */
export const sampleFlowOptions = sampleFlows.map(({ id, name }) => ({ id, name }));

/** O fluxo de exemplo pelo endereço, ou o rascunho que nasce de um modelo em `/marketing/fluxos/novo`. */
export function findSampleFlow(flowId: string, starter?: string): Flow | null {
  if (flowId === "novo") return flowFromStarter(isFlowStarter(starter) ? starter : "blank");
  return sampleFlows.find((flow) => flow.id === flowId) ?? null;
}
