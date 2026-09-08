import { z } from "zod";

/** O que a ficha de cliente aceita, na criação e na edição: é o mesmo formulário. */
export const clientFormSchema = z.object({
  /** Presente na edição; ausente na criação. */
  id: z.string().trim().min(1).optional(),
  name: z.string().trim().min(2, "Informe o nome do cliente").max(80, "Nome longo demais"),
  company: z.string().trim().max(80, "Nome da empresa longo demais"),
  role: z.string().trim().max(80, "Área longa demais"),
  email: z.union([z.literal(""), z.email("E-mail inválido").max(120)]),
  /** Só dígitos, com DDD: fixo tem 10 e celular tem 11. */
  phone: z.union([z.literal(""), z.string().regex(/^\d{10,11}$/, "Telefone incompleto")]),
  website: z.string().trim().max(120, "Endereço longo demais"),
  city: z.string().trim().max(80, "Cidade longa demais"),
  about: z.string().trim().max(1000, "Anotação longa demais"),
  tags: z.array(z.string().trim().min(1).max(30, "Etiqueta longa demais")).max(12, "No máximo 12 etiquetas"),
  active: z.boolean(),
  favorite: z.boolean(),
});

export type ClientFormInput = z.infer<typeof clientFormSchema>;

/** Os clientes marcados para excluir de uma vez: ao menos um, e não mais que uma página. */
export const clientIdsSchema = z.array(z.string().trim().min(1)).min(1).max(100);
