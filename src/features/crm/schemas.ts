import { z } from "zod";
import { MAX_TAGS } from "@/lib/tags";
import { crmStageValues, crmHues } from "./stages";
import { opportunityTagValues } from "./tags";
import { opportunitySourceValues } from "./summary";

/**
 * O teto de cada campo de texto, num lugar só: é daqui que sai tanto a validação do servidor quanto o
 * `maxLength` do campo na tela, então o campo para de aceitar no mesmo ponto em que o zod recusaria. Os
 * números batem com os `check` da tabela, que é a terceira barreira e a única que vale também no aplicativo.
 */
export const opportunityLimits = {
  title: 120,
  description: 1000,
  clientName: 80,
  company: 80,
  contactName: 80,
  email: 120,
  phone: 30,
  city: 80,
  partnerCode: 40,
  nextStep: 120,
  attribution: 240,
  sourceUrl: 1000,
} as const;

export { MAX_TAGS };

export const temperatureValues = ["cold", "warm", "hot"] as const;

export const crmStageSchema = z.union([z.enum(crmStageValues), z.string().regex(/^(open|won|lost)_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)]);

const isoDay = z.iso.date("Data inválida");
const blank = z.literal("");

/** O que a ficha de oportunidade aceita, na criação e na edição: é o mesmo formulário. */
export const opportunityFormSchema = z.object({
  /** Presente na edição; ausente na criação. */
  id: z.uuid().optional(),
  funnelId: z.uuid().nullable(),
  title: z.string().trim().transform((title) => title || "Nova oportunidade").pipe(z.string().max(opportunityLimits.title, "Título longo demais")),
  description: z.string().trim().max(opportunityLimits.description, "Descrição longa demais"),
  /** Lead novo ainda não é cadastro: o vínculo é opcional e o nome é o que sempre existe. */
  clientId: z.uuid().nullable(),
  clientName: z.string().trim().min(2, "Informe de quem é a oportunidade").max(opportunityLimits.clientName, "Nome longo demais"),
  clientCompany: z.union([blank, z.string().trim().max(opportunityLimits.company, "Nome da empresa longo demais")]),
  contactName: z.union([blank, z.string().trim().max(opportunityLimits.contactName, "Nome longo demais")]),
  contactEmail: z.union([blank, z.email("E-mail inválido").max(opportunityLimits.email)]),
  contactPhone: z.union([blank, z.string().trim().max(opportunityLimits.phone, "Telefone longo demais")]),
  stage: crmStageSchema,
  value: z.number().int().min(0, "O valor não pode ser negativo").max(999999999999),
  temperature: z.enum(temperatureValues),
  probability: z.number().int().min(0, "A chance vai de 0 a 100").max(100, "A chance vai de 0 a 100"),
  city: z.union([blank, z.string().trim().max(opportunityLimits.city, "Cidade longa demais")]),
  state: z.union([blank, z.string().trim().regex(/^[A-Z]{2}$/, "Use a sigla do estado, como SP")]),
  expectedAt: z.union([blank, isoDay]),
  ownerId: z.uuid().nullable(),
  /* Etiqueta é escolha da gama do domínio, e não texto livre (regra de `lib/tags.ts`): o leque só oferece
     essas, e o servidor recusa o resto, que é o que mantém nome e cor iguais em toda a base. */
  tags: z.array(z.enum(opportunityTagValues, { message: "Escolha uma etiqueta da lista" })).max(MAX_TAGS, `No máximo ${MAX_TAGS} etiquetas`),
  source: z.enum(opportunitySourceValues),
  partnerCode: z.union([blank, z.string().trim().max(opportunityLimits.partnerCode, "Código longo demais")]),
  nextStepLabel: z.union([blank, z.string().trim().max(opportunityLimits.nextStep, "Passo longo demais")]),
  nextStepAt: z.union([blank, isoDay]),
  lastTouchAt: z.union([blank, isoDay]).default(""),
  firstResponseMinutes: z.number().int().min(0).max(525600).nullable().default(null),
  averageResponseMinutes: z.number().int().min(0).max(525600).nullable().default(null),
  peopleIds: z.array(z.uuid()).max(50).default([]),
  attribution: z.object({
    campaign: z.string().trim().max(opportunityLimits.attribution).default(""),
    adSet: z.string().trim().max(opportunityLimits.attribution).default(""),
    ad: z.string().trim().max(opportunityLimits.attribution).default(""),
    gclid: z.string().trim().max(opportunityLimits.attribution).default(""),
    ctwaclid: z.string().trim().max(opportunityLimits.attribution).default(""),
    fbclid: z.string().trim().max(opportunityLimits.attribution).default(""),
    sourceId: z.string().trim().max(opportunityLimits.attribution).default(""),
    metaLeadId: z.string().trim().max(opportunityLimits.attribution).default(""),
    sourceUrl: z.union([blank, z.url("URL inválida").max(opportunityLimits.sourceUrl)]).default(""),
    utm: z.object({
      source: z.string().trim().max(opportunityLimits.attribution).default(""),
      medium: z.string().trim().max(opportunityLimits.attribution).default(""),
      campaign: z.string().trim().max(opportunityLimits.attribution).default(""),
      content: z.string().trim().max(opportunityLimits.attribution).default(""),
      term: z.string().trim().max(opportunityLimits.attribution).default(""),
    }).default({ source: "", medium: "", campaign: "", content: "", term: "" }),
  }).default({ campaign: "", adSet: "", ad: "", gclid: "", ctwaclid: "", fbclid: "", sourceId: "", metaLeadId: "", sourceUrl: "", utm: { source: "", medium: "", campaign: "", content: "", term: "" } }),
}).superRefine((value, context) => {
  if (Boolean(value.nextStepLabel) !== Boolean(value.nextStepAt)) {
    context.addIssue({ code: "custom", path: [value.nextStepLabel ? "nextStepAt" : "nextStepLabel"], message: "Preencha o próximo passo e a data juntos" });
  }
});

export type OpportunityFormInput = z.infer<typeof opportunityFormSchema>;

/** Arrastar o cartão de coluna: a oportunidade e a etapa de destino, e nada além. */
export const opportunityMoveSchema = z.object({
  id: z.uuid(),
  stage: crmStageSchema,
});

export const opportunityIdSchema = z.uuid();

/* Pastas e funis, pelo leque do menu lateral (2026-09-17). */
export const crmFolderLimits = { name: 60 } as const;

export const saveCrmFolderSchema = z.object({
  /** Presente ao renomear; ausente ao criar. */
  id: z.uuid().optional(),
  name: z.string().trim().min(1, "Dê um nome à pasta").max(crmFolderLimits.name, "Nome longo demais"),
  parentId: z.uuid().nullable().default(null),
  hue: z.enum(crmHues).optional(),
});

export const crmFolderIdSchema = z.uuid();

export const funnelLimits = { name: 60 } as const;

export const saveFunnelSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(2, "Dê um nome ao funil").max(funnelLimits.name, "Nome longo demais"),
  folderId: z.uuid().nullable().default(null),
  glyph: z.enum(["funnel", "storefront", "megaphone", "handshake", "target", "buildings", "tray"]).optional(),
  hue: z.enum(crmHues).optional(),
});

export const funnelIdSchema = z.uuid();

/** As etapas do funil, na ordem das colunas: ao menos uma, sem repetir, e só do catálogo. */
export const funnelStagesSchema = z.object({
  id: z.uuid(),
  stages: z
    .array(crmStageSchema)
    .min(1, "O funil precisa de ao menos uma etapa")
    .max(40)
    .refine((list) => new Set(list).size === list.length, "Etapa repetida"),
});

/** Para onde o funil vai: uma pasta, ou a raiz quando é nulo. */
export const moveFunnelSchema = z.object({ id: z.uuid(), folderId: z.uuid().nullable() });

export const configureFunnelStagesSchema = z.object({
  id: z.uuid(),
  stages: z.array(z.object({ id: crmStageSchema, label: z.string().trim().min(1, "Nomeie a etapa").max(60), hue: z.enum(crmHues) })).min(1, "Mantenha ao menos uma etapa").max(40)
    .refine((entries) => new Set(entries.map((entry) => entry.id)).size === entries.length, "Etapa repetida")
    .refine((entries) => new Set(entries.map((entry) => entry.label.toLocaleLowerCase("pt-BR"))).size === entries.length, "Use nomes diferentes nas etapas"),
  replacements: z.record(crmStageSchema, crmStageSchema).default({}),
});
export type ConfigureFunnelStagesInput = z.infer<typeof configureFunnelStagesSchema>;
