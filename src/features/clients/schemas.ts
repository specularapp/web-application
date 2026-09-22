import { z } from "zod";
import { MAX_TAGS } from "@/lib/tags";
import { clientTagValues } from "./tags";
import { clientKindValues } from "./summary";

/**
 * O teto de cada campo de texto, num lugar só: é daqui que sai tanto a validação do servidor quanto o
 * `maxLength` do campo na tela (a pedido, 2026-09-10), então o campo para de aceitar no mesmo ponto em que o
 * zod recusaria, e um nome sem fim não chega a quebrar o cartão nem a ficha. Dois números para a mesma regra
 * é como eles saem de sincronia.
 */
export const clientLimits = {
  name: 80,
  company: 80,
  role: 80,
  email: 120,
  website: 120,
  city: 80,
  about: 1000,
} as const;

/* O teto de etiquetas é o mesmo em todo domínio e mora em `lib/tags.ts`. Segue saindo daqui para quem já o
   importava desta feature. */
export { MAX_TAGS };

/** O que a ficha de cliente aceita, na criação e na edição: é o mesmo formulário. */
export const clientFormSchema = z.object({
  /** Presente na edição; ausente na criação. */
  id: z.string().trim().min(1).optional(),
  kind: z.enum(clientKindValues).default("customer"),
  name: z.string().trim().min(2, "Informe o nome do contato").max(clientLimits.name, "Nome longo demais"),
  company: z.string().trim().max(clientLimits.company, "Nome da empresa longo demais"),
  role: z.string().trim().max(clientLimits.role, "Área longa demais"),
  email: z.union([z.literal(""), z.email("E-mail inválido").max(clientLimits.email)]),
  /** Só dígitos, com DDD: fixo tem 10 e celular tem 11. */
  phone: z.union([z.literal(""), z.string().regex(/^\d{10,11}$/, "Telefone incompleto")]),
  website: z.string().trim().max(clientLimits.website, "Endereço longo demais"),
  city: z.string().trim().max(clientLimits.city, "Cidade longa demais"),
  about: z.string().trim().max(clientLimits.about, "Anotação longa demais"),
  /* Etiqueta é escolha da gama do domínio, e não texto livre (regra de `lib/tags.ts`): o leque só oferece
     essas, e o servidor recusa o resto, que é o que mantém nome e cor iguais em toda a base. */
  tags: z.array(z.enum(clientTagValues, { message: "Escolha uma etiqueta da lista" })).max(MAX_TAGS, `No máximo ${MAX_TAGS} etiquetas`),
  active: z.boolean(),
  favorite: z.boolean(),
});

export type ClientFormInput = z.infer<typeof clientFormSchema>;

/** Os clientes marcados para excluir de uma vez: ao menos um, e não mais que uma página. */
export const clientIdsSchema = z.array(z.string().trim().min(1)).min(1).max(100);

/** Um dos dois interruptores do leque, ligado ou desligado. */
export const clientFlagSchema = z.object({
  id: z.uuid(),
  flag: z.enum(["active", "favorite"]),
  value: z.boolean(),
});
