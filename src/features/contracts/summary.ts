/**
 * Onde o contrato está, do rascunho à assinatura: é o que decide a etiqueta do cartão e o que a lista filtra.
 * `partial` é o meio do caminho, quando uma das partes já assinou e a outra ainda não.
 */
export type ContractStatus = "draft" | "sent" | "partial" | "signed" | "cancelled";

/**
 * De onde o contrato nasceu (decisão de 2026-09-14, a pedido): de um PDF anexado, em que a pessoa marca onde
 * cada parte assina; de um modelo pronto da casa, em que só o necessário é editado; ou do zero, no editor.
 */
export type ContractSource = "pdf" | "template" | "scratch";

/**
 * O tipo do trabalho que o contrato cobre: é a etiqueta colorida no topo do cartão, como na referência, e a
 * família dos modelos prontos. Lista fechada, com o rótulo e o matiz em `labels.ts`.
 */
export type ContractKind = "landing" | "institutional" | "ecommerce" | "app" | "branding" | "uiux" | "maintenance" | "content" | "other";

/**
 * O estilo do documento escrito no editor (sobre a referência de editor de notas do usuário, o "Theme Style"):
 * a cor que tinge os títulos e o fio da folha. Papel continua branco; só o acento muda.
 */
export type ContractTheme = "plain" | "blue" | "green" | "yellow" | "purple";

export type ContractPerson = { name: string; avatarUrl: string | null };

/** Quem contratou: o rosto, o nome e a empresa quando há, para o cartão e para o documento. */
export type ContractClient = {
  id: string;
  name: string;
  company?: string;
  avatarUrl: string | null;
};

/**
 * Uma das partes que assinam: quem emite, pela equipe, e quem contrata. O e-mail é para onde o convite de
 * assinatura vai; o `token` é a credencial do endereço público **dessa parte**, e não do contrato, para uma
 * parte não conseguir assinar pela outra; `signedAt` é o registro da assinatura no sistema, em ISO com hora,
 * e `signatureUrl` é o traço desenhado por ela, em PNG embutido.
 */
export type ContractParty = ContractPerson & {
  id: string;
  role: "issuer" | "client";
  email: string;
  token: string;
  viewedAt: string | null;
  signedAt: string | null;
  signatureUrl: string | null;
};

/** O projeto ao qual o contrato se liga, com o endereço do site quando há: é a ficha pequena do cartão. */
export type ContractProject = { id: string; name: string; url: string | null };

/** O orçamento aprovado de que o contrato nasceu, quando nasceu de um. */
export type ContractQuote = { id: string; number: string; title: string; amount: number };

/**
 * Um nó do documento escrito no editor, no formato do ProseMirror que o Tiptap grava: é o que vai para o
 * banco e o que a tela, a página pública e o PDF desenham, cada um do seu jeito. Declarado aqui, e não
 * importado do Tiptap, para o servidor desenhar o documento sem carregar o editor. O zod de `schemas.ts` é
 * quem diz quais tipos entram.
 */
export type DocMark = { type: string; attrs?: Record<string, unknown> };

export type DocNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: DocNode[];
  marks?: DocMark[];
  text?: string;
};

/** O arquivo do contrato anexado em PDF: só o que a tela precisa saber; os bytes vivem no store. */
export type ContractFile = {
  name: string;
  /** Em bytes. */
  size: number;
  pages: number;
};

/**
 * Onde uma parte assina num PDF anexado: a página (a partir de 1) e a caixa em frações da página, de 0 a 1,
 * para valer em qualquer escala em que a página seja desenhada.
 */
export type SignatureField = {
  id: string;
  partyId: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ContractEventKind = "created" | "sent" | "resent" | "viewed" | "signed" | "cancelled";

/** Um registro da linha do tempo do contrato: o quê, quem e quando (ISO com hora). */
export type ContractEvent = {
  id: string;
  kind: ContractEventKind;
  /** Quem fez, quando foi uma pessoa: o nome da parte ou de quem da equipe agiu. */
  actor: string | null;
  at: string;
};

/**
 * Um contrato como a listagem o mostra (2026-09-14, sobre uma referência de grade de cartões do usuário): o
 * tipo em etiqueta, a situação, o título e a descrição, o projeto ou o orçamento a que se liga, as duas
 * partes e a data que importa na situação em que está. O `reference` é o identificador que a pessoa lê e
 * fala (`CTR-2026-0007`), no padrão de `lib/utils/reference.ts`. O documento em si é `body` (escrito no
 * editor) ou `file` mais `fields` (PDF anexado com os campos de assinatura).
 */
export type Contract = {
  id: string;
  reference: string;
  title: string;
  kind: ContractKind;
  /** O que o contrato cobre, em até cem caracteres: a linha sob o título no cartão. */
  description: string;
  source: ContractSource;
  status: ContractStatus;
  /** Nulo enquanto o rascunho não escolheu quem contrata. */
  client: ContractClient | null;
  /** Quem da equipe responde pelo contrato e assina por ela. */
  owner: ContractPerson;
  parties: ContractParty[];
  project: ContractProject | null;
  quote: ContractQuote | null;
  /** O valor do contrato em centavos; nulo quando o documento não fixa valor. */
  amount: number | null;
  /** O documento escrito no editor; nulo no PDF anexado. */
  body: DocNode | null;
  theme: ContractTheme;
  /** O modelo de que nasceu, quando nasceu de um. */
  templateId: string | null;
  /** O PDF anexado; nulo no documento escrito. */
  file: ContractFile | null;
  fields: SignatureField[];
  /** Quantos dias o convite de assinatura vale depois do envio. */
  expiresInDays: number;
  /** Datas em `yyyy-MM-dd`; a assinatura, quando completa, em ISO com hora. */
  createdAt: string;
  sentAt: string | null;
  /** Até quando o convite de assinatura vale; nulo sem prazo ou antes do envio. */
  expiresAt: string | null;
  signedAt: string | null;
  events: ContractEvent[];
};
