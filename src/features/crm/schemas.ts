import { z } from "zod";
import { MAX_TAGS } from "@/lib/tags";
import { crmStageValues } from "./stages";
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
} as const;

export { MAX_TAGS };

export const temperatureValues = ["cold", "warm", "hot"] as const;

const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida");
const blank = z.literal("");

/** O que a ficha de oportunidade aceita, na criação e na edição: é o mesmo formulário. */
export const opportunityFormSchema = z.object({
  /** Presente na edição; ausente na criação. */
  id: z.uuid().optional(),
  funnelId: z.uuid().nullable(),
  title: z.string().trim().min(2, "Dê um título à oportunidade").max(opportunityLimits.title, "Título longo demais"),
  description: z.string().trim().max(opportunityLimits.description, "Descrição longa demais"),
  /** Lead novo ainda não é cadastro: o vínculo é opcional e o nome é o que sempre existe. */
  clientId: z.uuid().nullable(),
  clientName: z.string().trim().min(2, "Informe de quem é a oportunidade").max(opportunityLimits.clientName, "Nome longo demais"),
  clientCompany: z.union([blank, z.string().trim().max(opportunityLimits.company, "Nome da empresa longo demais")]),
  contactName: z.union([blank, z.string().trim().max(opportunityLimits.contactName, "Nome longo demais")]),
  contactEmail: z.union([blank, z.email("E-mail inválido").max(opportunityLimits.email)]),
  contactPhone: z.union([blank, z.string().trim().max(opportunityLimits.phone, "Telefone longo demais")]),
  stage: z.enum(crmStageValues),
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
});

export type OpportunityFormInput = z.infer<typeof opportunityFormSchema>;

/** Arrastar o cartão de coluna: a oportunidade e a etapa de destino, e nada além. */
export const opportunityMoveSchema = z.object({
  id: z.uuid(),
  stage: z.enum(crmStageValues),
});

export const opportunityIdSchema = z.uuid();
