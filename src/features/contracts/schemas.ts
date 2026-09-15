import { z } from "zod";
import type { ContractKind, ContractTheme, DocNode } from "./summary";

export const contractKindValues = ["landing", "institutional", "ecommerce", "app", "branding", "uiux", "maintenance", "content", "other"] as const satisfies readonly ContractKind[];
export const contractThemeValues = ["plain", "blue", "green", "yellow", "purple"] as const satisfies readonly ContractTheme[];
export const contractSourceValues = ["pdf", "template", "scratch"] as const;

/** Os tetos dos campos de texto, num lugar só: o zod do servidor e o `maxLength` da tela saem daqui. */
export const contractLimits = {
  title: 90,
  description: 100,
  email: 120,
  signerName: 80,
  /** O traço da assinatura em PNG embutido: 200 KB é dez vezes o que um traço a dedo ocupa. */
  signature: 200_000,
  /** O documento escrito, em nós: um contrato longo tem algumas centenas. */
  nodes: 4_000,
  /** O PDF anexado, em bytes. */
  file: 10 * 1024 * 1024,
} as const;

/** A validade do convite de assinatura, em dias: entre um dia e três meses, quinze por padrão. */
export const expiryLimits = { min: 1, max: 90, default: 15 } as const;

/* Os tipos de nó e de marca que o documento aceita: é a mesma lista que o editor oferece e que o desenho da
   tela e do PDF conhecem. Nó fora da lista é recusado no servidor, e não ignorado, porque o documento é o
   contrato. */
const nodeTypes = ["doc", "paragraph", "heading", "text", "bulletList", "orderedList", "listItem", "blockquote", "horizontalRule", "hardBreak"] as const;
const markTypes = ["bold", "italic", "underline", "strike", "link"] as const;

const markSchema = z.object({
  type: z.enum(markTypes),
  attrs: z.record(z.string(), z.unknown()).optional(),
});

export const docNodeSchema: z.ZodType<DocNode> = z.lazy(() =>
  z.object({
    type: z.enum(nodeTypes),
    attrs: z.record(z.string(), z.unknown()).optional(),
    content: z.array(docNodeSchema).optional(),
    marks: z.array(markSchema).optional(),
    text: z.string().max(20_000).optional(),
  }),
);

/** Quantos nós o documento tem, para o teto valer sobre o todo e não só sobre a raiz. */
export function countNodes(node: DocNode): number {
  return 1 + (node.content?.reduce((sum, child) => sum + countNodes(child), 0) ?? 0);
}

const bodySchema = docNodeSchema.refine((node) => node.type === "doc", "O documento precisa começar pela raiz").refine((node) => countNodes(node) <= contractLimits.nodes, "Documento longo demais");

/** Onde cada parte assina num PDF, em frações da página: dentro de 0 a 1 e com tamanho mínimo legível. */
export const signatureFieldSchema = z.object({
  id: z.string().trim().min(1).max(40),
  partyId: z.string().trim().min(1).max(40),
  page: z.number().int().min(1).max(500),
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  width: z.number().min(0.05).max(1),
  height: z.number().min(0.02).max(1),
});

/** O que pode ser criado sem ninguém escolher nada ainda: a origem e, no modelo, qual. */
export const createContractSchema = z.object({
  source: z.enum(["template", "scratch"]),
  templateId: z.string().trim().min(1).max(60).optional(),
  kind: z.enum(contractKindValues).optional(),
});

/**
 * A ficha do rascunho, salva a cada pausa do editor: quem contrata, a que se liga, o documento e as partes.
 * Só rascunho aceita isto; documento enviado não muda por baixo de quem vai assinar.
 */
export const saveContractSchema = z.object({
  id: z.string().trim().min(1),
  title: z.string().trim().max(contractLimits.title, "Título longo demais"),
  kind: z.enum(contractKindValues),
  description: z.string().trim().max(contractLimits.description, "Descrição longa demais"),
  theme: z.enum(contractThemeValues),
  clientId: z.string().trim().max(60).nullable(),
  projectId: z.string().trim().max(60).nullable(),
  quoteId: z.string().trim().max(60).nullable(),
  expiresInDays: z.number().int().min(expiryLimits.min).max(expiryLimits.max),
  /** O e-mail de cada parte, pelo papel: é para onde o convite vai. */
  emails: z.object({
    issuer: z.string().trim().max(contractLimits.email),
    client: z.string().trim().max(contractLimits.email),
  }),
  body: bodySchema.nullable(),
  fields: z.array(signatureFieldSchema).max(40),
});

export type SaveContractInput = z.infer<typeof saveContractSchema>;

/** Só o id, para enviar, reenviar, cancelar e carregar. */
export const contractIdSchema = z.object({ id: z.string().trim().min(1) });

/**
 * A assinatura de uma parte, pela página pública: o token dela, o nome como assina e o traço em PNG embutido.
 * O traço é obrigatório, porque assinatura sem traço é só um clique.
 */
export const signContractSchema = z.object({
  token: z.string().trim().min(8).max(120),
  name: z.string().trim().min(2, "Escreva seu nome como assina").max(contractLimits.signerName, "Nome longo demais"),
  signature: z
    .string()
    .max(contractLimits.signature, "Assinatura grande demais")
    .regex(/^data:image\/png;base64,[A-Za-z0-9+/=]+$/, "Assinatura inválida"),
});

export type SignContractInput = z.infer<typeof signContractSchema>;

/** O pedido de reescrita por IA no editor: o trecho e o que fazer com ele. */
export const rewriteModes = ["grammar", "formal", "direct", "shorter"] as const;

export type RewriteMode = (typeof rewriteModes)[number];

export const rewriteSchema = z.object({
  text: z.string().trim().min(3, "Selecione um trecho").max(4_000, "Trecho longo demais"),
  mode: z.enum(rewriteModes),
});
