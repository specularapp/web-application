import type { CrmStage } from "./stages";

/**
 * Aberta, ganha ou perdida. **Não é campo do modelo**: sai da etapa em que a oportunidade está, por
 * `crmStatus` em `labels.ts`, pelo mesmo motivo das tarefas. Guardar os dois lado a lado faria a etiqueta
 * dizer uma coisa e a coluna outra assim que alguém movesse o cartão.
 */
export type OpportunityStatus = "open" | "won" | "lost";

/**
 * O quanto a venda está quente: o que na tarefa é prioridade, aqui é temperatura. Não é a mesma coisa com
 * outro nome: prioridade é escolha de quem organiza a fila, e temperatura é leitura do interesse de quem
 * está do outro lado, que é o que decide para quem se liga primeiro.
 */
export type OpportunityTemperature = "cold" | "warm" | "hot";

/** Por onde a oportunidade chegou, que é o que diz qual caminho de aquisição está dando retorno. */
export const opportunitySourceValues = [
  "whatsapp",
  "indicacao",
  "site",
  "instagram",
  "google",
  "facebook",
  "evento",
  "prospeccao",
  "telefone",
  "outro",
] as const;

export type OpportunitySource = (typeof opportunitySourceValues)[number];

export type CrmPerson = { id: string; name: string; avatarUrl: string | null };

/** Cadastro que pode ser ligado a uma oportunidade, sem levar a ficha inteira para o quadro. */
export type CrmClientOption = {
  id: string;
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  city?: string;
  avatarUrl: string | null;
};

/** Quem está do outro lado, já com o identificador do cadastro, que é por onde se chega à ficha dele. */
export type OpportunityClient = {
  id: string;
  name: string;
  /** A empresa, quando a pessoa fala por uma. */
  company?: string;
  /** O identificador do cliente, `CLI-2026-0026`, quando ele já é cadastro; lead novo ainda não é. */
  reference?: string;
  avatarUrl: string | null;
};

/**
 * Com quem se fala do outro lado, que nem sempre é quem assina: numa construtora quem responde o WhatsApp é
 * o atendimento, e quem decide é outro. Os três campos são opcionais porque lead novo costuma chegar só com
 * um deles.
 */
export type OpportunityContact = {
  name?: string;
  email?: string;
  /** Telefone com máscara, como a pessoa lê: `(21) 99100-1742`. */
  phone?: string;
};

/**
 * De onde a venda veio, com o rastro inteiro da campanha (2026-09-15, a pedido, sobre a ficha do CRM que o
 * usuário usa hoje): sem isto não dá para dizer qual anúncio trouxe qual venda, que é o que fecha a conta do
 * marketing. Tudo opcional: venda de indicação não tem nenhum destes, e venda de anúncio tem quase todos.
 */
export type OpportunityAttribution = {
  campaign?: string;
  /** O conjunto de anúncios, que é o nível do meio nas plataformas. */
  adSet?: string;
  ad?: string;
  /** Identificador de clique do Google Ads. */
  gclid?: string;
  /** Identificador de clique do anúncio que abre conversa no WhatsApp. */
  ctwaclid?: string;
  /** Identificador de clique do Facebook e do Instagram. */
  fbclid?: string;
  sourceId?: string;
  /** O identificador do formulário de lead da Meta. */
  metaLeadId?: string;
  /** A página em que a pessoa estava quando pediu contato. */
  sourceUrl?: string;
  utm?: {
    source?: string;
    medium?: string;
    campaign?: string;
    content?: string;
    term?: string;
  };
};

/** O funil a que a oportunidade pertence, na mesma forma do projeto de uma tarefa. */
export type OpportunityFunnel = {
  name: string;
  /** O identificador do funil, `FUN-2026-0002`, que é como as duas pontas se encontram. */
  reference: string;
  /** O endereço do quadro dele: `/crm/<slug>`. */
  slug: string;
};

/** O que ficou combinado de fazer a seguir, que é a única coisa que tira uma venda do lugar. */
export type OpportunityNextStep = {
  label: string;
  /** Quando, no formato `yyyy-MM-dd`. */
  at: string;
};

export type Opportunity = {
  id: string;
  /** O identificador que a pessoa lê e fala: `OPO-2026-0007`. */
  reference: string;
  /** O código do parceiro que trouxe a venda, quando ela veio por um. */
  partnerCode?: string;
  title: string;
  description: string;
  client: OpportunityClient;
  contact?: OpportunityContact;
  /** Nulo é o balde de quem ainda não foi para funil nenhum. */
  funnel: OpportunityFunnel | null;
  stage: CrmStage;
  stageLabel?: string;
  /** Quanto vale, em centavos, como todo dinheiro do produto. */
  value: number;
  temperature: OpportunityTemperature;
  /** A chance de fechar, de 0 a 100, que multiplicada pelo valor dá o previsto ponderado do funil. */
  probability: number;
  /** Onde a obra é, que é o que decide equipe e deslocamento. */
  city?: string;
  /** A sigla do estado, como `SP`. */
  state?: string;
  /** Quando deve fechar, no formato `yyyy-MM-dd`. */
  expectedAt: string;
  /** Quando ela entrou no funil, com hora: `yyyy-MM-dd'T'HH:mm`. */
  enteredAt: string;
  /** Quando ela fechou, ganhando ou perdendo; ausente enquanto está em aberto. */
  closedAt?: string;
  /** Quando ela chegou na etapa em que está, com hora: é daqui que sai o tempo parado nela. */
  stageSince: string;
  /** Quantos minutos até alguém responder a primeira vez; ausente é que ninguém respondeu ainda. */
  firstResponseMinutes?: number;
  /** A média de minutos de resposta na conversa inteira. */
  averageResponseMinutes?: number;
  /** Quem responde pela venda. */
  owner: CrmPerson;
  /** Quem mais está envolvido, com o responsável na frente. */
  people: CrmPerson[];
  tags: string[];
  source: OpportunitySource;
  attribution?: OpportunityAttribution;
  /** O último contato de verdade, no formato `yyyy-MM-dd`: é o que separa venda andando de venda esquecida. */
  lastTouchAt: string;
  nextStep?: OpportunityNextStep;
  /** O orçamento que saiu desta oportunidade, quando já saiu. */
  quote?: { id: string; reference: string };
  /** Quantos anexos e quantos registros de histórico ela tem, para o cartão contar sem carregar os dois. */
  attachments: number;
  activity: number;
};
