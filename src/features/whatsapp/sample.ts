import type { ContactStage, DeliveryStatus, MessageTemplate, QuickReply, TeamMember, WhatsappContact, WhatsappConversation, WhatsappMessage, WhatsappSample } from "./types";

/*
 * Dados de exemplo da caixa de entrada, enquanto a integração com o WhatsApp não existe. As datas são relativas ao
 * instante em que a amostra é montada, para a tela sempre ter conversa de hoje, de ontem e da semana passada.
 */

const MINUTE = 60_000;
const DAY_MINUTES = 24 * 60;

const team: TeamMember[] = [
  { id: "u-ana", name: "Ana Ribeiro", role: "Comercial" },
  { id: "u-bruno", name: "Bruno Lima", role: "Design" },
  { id: "u-carla", name: "Carla Mendes", role: "Atendimento" },
  { id: "u-diego", name: "Diego Souza", role: "Desenvolvimento" },
];

const stages: ContactStage[] = [
  { id: "novo", label: "Novo contato", hue: "var(--sys-gray)" },
  { id: "conversa", label: "Em conversa", hue: "var(--sys-blue)" },
  { id: "proposta", label: "Proposta enviada", hue: "var(--sys-orange)" },
  { id: "negociacao", label: "Negociação", hue: "var(--sys-purple)" },
  { id: "fechado", label: "Fechado", hue: "var(--sys-green)" },
];

const templates: MessageTemplate[] = [
  {
    id: "t-boas-vindas",
    name: "Boas-vindas",
    category: "UTILITY",
    header: "Olá!",
    body: "Oi, {{1}}! Aqui é {{2}}, do estúdio. Vi o seu contato e queria entender melhor o seu projeto. Podemos conversar por aqui?",
    variables: ["primeiro nome", "atendente"],
    footer: "Responda SAIR para não receber mais mensagens",
    buttons: ["Quero conversar", "Agora não"],
  },
  {
    id: "t-retomar",
    name: "Retomar proposta",
    category: "MARKETING",
    body: "Oi, {{1}}! Passando para saber se você conseguiu olhar a proposta de *{{2}}*. Fico à disposição para ajustar o que precisar.",
    variables: ["primeiro nome", "projeto"],
    buttons: ["Ver proposta"],
  },
  {
    id: "t-pagamento",
    name: "Lembrete de pagamento",
    category: "UTILITY",
    body: "Olá, {{1}}! Lembrando que a parcela de {{2}} vence em {{3}}. Qualquer dúvida, é só chamar.",
    variables: ["primeiro nome", "valor", "vencimento"],
  },
  {
    id: "t-entrega",
    name: "Entrega para aprovação",
    category: "UTILITY",
    body: "Oi, {{1}}! A nova versão do seu projeto está pronta para aprovação. É só abrir o link e deixar os comentários: {{2}}",
    variables: ["primeiro nome", "link"],
  },
];

const quickReplies: QuickReply[] = [
  { id: "r-oi", shortcut: "oi", title: "Saudação", text: "Oi, {nome}! Tudo bem? Obrigada por chamar. Como posso ajudar?" },
  { id: "r-prazo", shortcut: "prazo", title: "Prazo de entrega", text: "Nosso prazo médio para um site institucional é de *4 a 6 semanas*, contando da aprovação do briefing." },
  { id: "r-orcamento", shortcut: "orcamento", title: "Pedido de orçamento", text: "Para montar o orçamento, me conta: qual o objetivo do projeto, quantas páginas imagina e se já tem identidade visual?" },
  { id: "r-pagamento", shortcut: "pagamento", title: "Formas de pagamento", text: "Trabalhamos com entrada de 40% na aprovação e o restante na entrega, por boleto, cartão ou transferência." },
  { id: "r-reuniao", shortcut: "reuniao", title: "Agendar reunião", text: "Que tal uma chamada rápida de 30 minutos para alinharmos tudo? Me diz o melhor dia e horário para você." },
  { id: "r-obrigado", shortcut: "obrigado", title: "Agradecimento", text: "Muito obrigada, {nome}! Qualquer coisa, estou por aqui." },
];

type MessageSeed = Omit<WhatsappMessage, "id" | "at"> & { minutesAgo: number };

function conversation(
  base: number,
  data: Omit<WhatsappConversation, "messages" | "windowExpiresAt" | "waitingSince" | "contact"> & {
    contact: Omit<WhatsappContact, "createdAt"> & { createdDaysAgo: number };
    waitingMinutes?: number;
    messages: MessageSeed[];
  },
): WhatsappConversation {
  const at = (minutesAgo: number) => new Date(base - minutesAgo * MINUTE).toISOString();
  const messages = data.messages.map(({ minutesAgo, ...message }, index) => ({ ...message, id: `${data.id}-m${index + 1}`, at: at(minutesAgo) }));
  const lastFromContact = data.messages.filter((message) => message.author === "contact").at(-1);
  const { createdDaysAgo, ...contact } = data.contact;
  return {
    ...data,
    contact: { ...contact, createdAt: at(createdDaysAgo * DAY_MINUTES) },
    messages,
    waitingSince: data.waitingMinutes === undefined ? null : at(data.waitingMinutes),
    windowExpiresAt: lastFromContact ? at(lastFromContact.minutesAgo - DAY_MINUTES) : null,
  };
}

const fromContact = (minutesAgo: number, text: string, extra: Partial<MessageSeed> = {}): MessageSeed => ({ minutesAgo, author: "contact", kind: "text", text, ...extra });

const fromTeam = (minutesAgo: number, text: string, authorName: string, status: DeliveryStatus = "read", extra: Partial<MessageSeed> = {}): MessageSeed => ({
  minutesAgo,
  author: "agent",
  authorName,
  kind: "text",
  text,
  status,
  ...extra,
});

export function buildWhatsappSample(now: Date): WhatsappSample {
  const base = now.getTime();

  const conversations: WhatsappConversation[] = [
    conversation(base, {
      id: "c-mariana",
      status: "aberta",
      assigneeId: "u-ana",
      unread: 2,
      pinned: false,
      starred: false,
      contact: {
        id: "p-mariana",
        name: "Mariana Costa",
        phone: "5511987654321",
        email: "mariana@estudiolumen.com.br",
        company: "Estúdio Lumen",
        role: "Sócia",
        city: "São Paulo, SP",
        tags: ["Lead quente", "Site"],
        source: "instagram",
        origin: { campaign: "Sites para arquitetura", utmSource: "instagram", utmMedium: "stories", device: "iPhone", location: "São Paulo, SP" },
        stage: "proposta",
        createdDaysAgo: 9,
      },
      messages: [
        fromContact(1630, "Oi! Vocês fazem site para escritório de arquitetura?"),
        fromTeam(1622, "Oi, Mariana! Fazemos sim 😊 Temos alguns projetos de arquitetura no portfólio. Me conta um pouco do escritório?", "Ana Ribeiro"),
        fromContact(1610, "Somos um estúdio pequeno, três arquitetas. Queremos um site que mostre os projetos com fotos grandes"),
        fromContact(1609, "E que seja fácil de atualizar, a gente publica obra nova todo mês"),
        fromTeam(1600, "Perfeito. Dá para fazer com um painel simples para vocês subirem as obras. Vou montar uma proposta e te mando amanhã.", "Ana Ribeiro"),
        fromTeam(185, "Mariana, segue a proposta. O *investimento* e o _cronograma_ estão na página 3.", "Ana Ribeiro", "read", { kind: "document", attachment: { name: "Proposta Estúdio Lumen.pdf", size: 1_840_000 } }),
        fromContact(12, "Oi, Ana! Vi a proposta, gostei bastante", { replyTo: { id: "c-mariana-m6", text: "Mariana, segue a proposta.", author: "agent", kind: "document" } }),
        fromContact(6, "Consegue incluir uma versão em inglês? Temos clientes de fora"),
      ],
    }),
    conversation(base, {
      id: "c-rafael",
      status: "aberta",
      assigneeId: null,
      unread: 1,
      pinned: false,
      starred: false,
      waitingMinutes: 25,
      contact: {
        id: "p-rafael",
        name: "Rafael Nunes",
        phone: "5521998761234",
        company: "Nunes Advocacia",
        city: "Rio de Janeiro, RJ",
        tags: [],
        source: "anuncio",
        origin: { campaign: "Sites profissionais", ad: "Carrossel escritórios", utmSource: "meta", utmMedium: "cpc", device: "Android", location: "Rio de Janeiro, RJ" },
        stage: "novo",
        createdDaysAgo: 0,
      },
      messages: [fromContact(25, "Olá! Vi o anúncio de vocês. Vocês fazem site para escritório de advocacia? Qual o valor médio?")],
    }),
    conversation(base, {
      id: "c-juliana",
      status: "aberta",
      assigneeId: "u-bruno",
      unread: 0,
      pinned: true,
      starred: false,
      contact: {
        id: "p-juliana",
        name: "Juliana Ferreira",
        phone: "5531991237788",
        email: "contato@doceatelie.com",
        company: "Doce Ateliê",
        role: "Proprietária",
        city: "Belo Horizonte, MG",
        tags: ["Identidade visual", "Lead quente"],
        source: "indicacao",
        stage: "negociacao",
        createdDaysAgo: 21,
      },
      messages: [
        fromContact(3000, "Bruno, separei o logo atual e umas referências que eu gosto"),
        fromContact(2998, "Logo atual", { kind: "image", attachment: { name: "logo-atual.jpg", size: 420_000 } }),
        fromTeam(2950, "Ótimo, Juliana! Já dá para ver o caminho. Vou seguir com *três rotas* de identidade e te apresento na quinta.", "Bruno Lima"),
        fromContact(95, "Bruno, ficou lindo! Gostei muito da rota 2"),
        fromTeam(88, "Que bom! Vou refinar a rota 2 com as cores que você comentou e mando a versão final até sexta.", "Bruno Lima", "read"),
      ],
    }),
    conversation(base, {
      id: "c-pedro",
      status: "aguardando",
      assigneeId: "u-ana",
      unread: 0,
      pinned: false,
      starred: true,
      contact: {
        id: "p-pedro",
        name: "Pedro Almeida",
        phone: "5541996541122",
        email: "pedro@almeidaeng.com.br",
        company: "Almeida Engenharia",
        role: "Diretor",
        city: "Curitiba, PR",
        tags: ["Orçamento enviado", "Aplicativo"],
        source: "site",
        origin: { landingPage: "/servicos/aplicativos", device: "Windows", location: "Curitiba, PR" },
        stage: "proposta",
        createdDaysAgo: 18,
      },
      messages: [
        fromContact(5800, "Precisamos de um app para os engenheiros registrarem as visitas de obra com foto"),
        fromTeam(5790, "Entendi, Pedro. Funciona offline? Muitas obras não têm sinal.", "Ana Ribeiro"),
        fromContact(5780, "Precisa funcionar offline sim"),
        fromTeam(5700, "Combinado. Te mando a proposta ainda esta semana.", "Ana Ribeiro"),
        {
          minutesAgo: 1500,
          author: "agent",
          authorName: "Retomar proposta",
          kind: "template",
          text: "Oi, Pedro! Passando para saber se você conseguiu olhar a proposta de *App de vistorias*. Fico à disposição para ajustar o que precisar.",
          status: "delivered",
          template: { buttons: ["Ver proposta"] },
        },
      ],
    }),
    conversation(base, {
      id: "c-camila",
      status: "aberta",
      assigneeId: "u-carla",
      unread: 0,
      pinned: false,
      starred: false,
      contact: {
        id: "p-camila",
        name: "Camila Rocha",
        phone: "5511976543210",
        email: "camila@rochaimoveis.com.br",
        company: "Rocha Imóveis",
        city: "Campinas, SP",
        tags: ["Cliente", "Manutenção"],
        source: "organico",
        stage: "fechado",
        createdDaysAgo: 140,
      },
      messages: [
        fromTeam(1450, "Camila, a atualização do plugin de imóveis foi feita. Pode conferir?", "Carla Mendes"),
        fromContact(140, "", { kind: "audio", attachment: { name: "audio.ogg", size: 96_000, duration: 47 } }),
        fromContact(138, "O formulário de contato parou de chegar no e-mail desde ontem"),
      ],
    }),
    conversation(base, {
      id: "c-lucas",
      status: "resolvida",
      assigneeId: "u-diego",
      unread: 0,
      pinned: false,
      starred: false,
      contact: {
        id: "p-lucas",
        name: "Lucas Martins",
        phone: "5551993452211",
        email: "lucas@lucasmartins.dev",
        role: "Desenvolvedor",
        city: "Porto Alegre, RS",
        tags: ["Parceiro"],
        source: "indicacao",
        stage: "fechado",
        createdDaysAgo: 300,
      },
      messages: [
        fromContact(8700, "Diego, terminei a integração da API de pagamentos. Subi na branch de homologação"),
        fromTeam(8650, "Valeu, Lucas! Vou testar hoje à tarde e te dou retorno.", "Diego Souza"),
        fromTeam(8400, "Testado e aprovado ✅ Pode fechar a fatura do mês.", "Diego Souza"),
        fromContact(8390, "Show! Obrigado 🙌"),
      ],
    }),
    conversation(base, {
      id: "c-beatriz",
      status: "aberta",
      assigneeId: "u-ana",
      unread: 0,
      pinned: true,
      starred: false,
      contact: {
        id: "p-beatriz",
        name: "Beatriz Santos",
        phone: "5571992223344",
        email: "financeiro@clinicabemestar.com.br",
        company: "Clínica Bem Estar",
        role: "Gerente administrativa",
        city: "Salvador, BA",
        tags: ["Cliente", "Aguarda pagamento"],
        source: "site",
        origin: { landingPage: "/contato", utmSource: "google", utmMedium: "organic", device: "Mac", location: "Salvador, BA" },
        stage: "fechado",
        createdDaysAgo: 45,
      },
      messages: [
        fromContact(400, "Ana, pode me mandar o boleto da segunda parcela? Não chegou no e-mail"),
        fromTeam(380, "Claro, Beatriz! Segue o boleto atualizado.", "Ana Ribeiro", "read", { kind: "document", attachment: { name: "Boleto parcela 2.pdf", size: 210_000 } }),
        { minutesAgo: 370, author: "agent", authorName: "Ana Ribeiro", kind: "note", text: "Financeiro pediu para conferir se o pagamento cai até sexta. Se não cair, ligar para ela." },
        fromContact(40, "Recebi, obrigada! Pago amanhã cedo"),
        fromTeam(35, "Perfeito, obrigada! 😊", "Ana Ribeiro", "delivered"),
      ],
    }),
    conversation(base, {
      id: "c-thiago",
      status: "aberta",
      assigneeId: null,
      unread: 3,
      pinned: false,
      starred: false,
      waitingMinutes: 130,
      contact: {
        id: "p-thiago",
        name: "Thiago Oliveira",
        phone: "5561981112233",
        company: "FitLab Academia",
        city: "Brasília, DF",
        tags: ["Lead quente", "Aplicativo"],
        source: "site",
        origin: { landingPage: "/servicos/aplicativos", utmSource: "google", utmMedium: "cpc", campaign: "Apps sob medida", device: "iPhone", location: "Brasília, DF" },
        stage: "novo",
        createdDaysAgo: 0,
      },
      messages: [
        fromContact(130, "Boa tarde! Tenho uma rede com 4 academias e quero um app para os alunos agendarem aula"),
        fromContact(129, "Precisa ter pagamento da mensalidade dentro do app também"),
        fromContact(127, "Vocês conseguem me passar uma ideia de prazo e valor?"),
      ],
    }),
    conversation(base, {
      id: "c-fernanda",
      status: "aberta",
      assigneeId: "u-bruno",
      unread: 0,
      pinned: false,
      starred: false,
      contact: {
        id: "p-fernanda",
        name: "Fernanda Lima",
        phone: "5585987776655",
        email: "fernanda@caferaiz.com.br",
        company: "Café Raiz",
        city: "Fortaleza, CE",
        tags: ["Identidade visual"],
        source: "instagram",
        stage: "conversa",
        createdDaysAgo: 6,
      },
      messages: [
        fromContact(1400, "Bruno, as embalagens precisam sair até o fim do mês para a gráfica"),
        fromTeam(1380, "Combinado, Fernanda. Vou priorizar as embalagens esta semana.", "Bruno Lima"),
        fromTeam(55, "Fernanda, segue a prévia das embalagens", "Bruno Lima", "failed", { kind: "image", text: "Prévia das embalagens", attachment: { name: "embalagens-v1.png", size: 2_300_000 } }),
      ],
    }),
    conversation(base, {
      id: "c-gustavo",
      status: "resolvida",
      assigneeId: "u-carla",
      unread: 0,
      pinned: false,
      starred: false,
      contact: {
        id: "p-gustavo",
        name: "Gustavo Pereira",
        phone: "5547991234567",
        email: "gustavo@pereiramoveis.com.br",
        company: "Pereira Móveis",
        city: "Joinville, SC",
        tags: ["Cliente"],
        source: "indicacao",
        stage: "fechado",
        createdDaysAgo: 200,
      },
      messages: [
        fromContact(17400, "Carla, o site está fora do ar?"),
        fromTeam(17380, "Oi, Gustavo! Era uma renovação do domínio. Já resolvemos, pode conferir.", "Carla Mendes"),
        fromContact(17360, "Voltou! Valeu pela agilidade"),
      ],
    }),
    conversation(base, {
      id: "c-larissa",
      status: "aberta",
      assigneeId: "u-ana",
      unread: 1,
      pinned: false,
      starred: true,
      contact: {
        id: "p-larissa",
        name: "Larissa Carvalho",
        phone: "5581994445566",
        email: "larissa@carvalhoeventos.com",
        company: "Carvalho Eventos",
        city: "Recife, PE",
        tags: ["Suporte", "Cliente"],
        source: "organico",
        stage: "fechado",
        createdDaysAgo: 90,
      },
      messages: [
        fromTeam(3100, "Larissa, publicamos a página do evento de dezembro. Segue o link: carvalhoeventos.com/dezembro", "Ana Ribeiro"),
        fromContact(2900, "Ana, dá para trocar a foto do topo por uma mais clara? Mandei no e-mail"),
      ],
    }),
    conversation(base, {
      id: "c-andre",
      status: "resolvida",
      assigneeId: null,
      unread: 0,
      pinned: false,
      starred: false,
      contact: {
        id: "p-andre",
        name: "André Barbosa",
        phone: "5562993332211",
        company: "Barbosa Contabilidade",
        city: "Goiânia, GO",
        tags: ["Lead frio"],
        source: "anuncio",
        origin: { campaign: "Sites profissionais", utmSource: "meta", utmMedium: "cpc" },
        stage: "conversa",
        createdDaysAgo: 40,
      },
      messages: [
        fromContact(51000, "Oi, quanto custa um site simples?"),
        fromTeam(50900, "Oi, André! Depende do que você precisa. Posso te fazer umas perguntas rápidas?", "Carla Mendes"),
        fromContact(50000, "Vou ver com meu sócio e retorno"),
      ],
    }),
  ];

  return { now: now.toISOString(), me: "u-ana", team, conversations, templates, quickReplies, stages };
}
