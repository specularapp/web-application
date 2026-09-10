import { z } from "zod";
import { catalogUnits } from "@/features/catalog/schemas";
import type { QuotePaymentMethod } from "./summary";

export const paymentMethodValues = ["pix", "transfer", "boleto", "card"] as const satisfies readonly QuotePaymentMethod[];

/** Quantas linhas um orçamento aceita. */
export const MAX_LINES = 30;

const int = z.number().int();
const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida");

const lineSchema = z.object({
  id: z.string().trim().min(1),
  catalogItemId: z.string().trim().min(1).nullable(),
  name: z.string().trim().min(2, "Informe o nome do item").max(80, "Nome longo demais"),
  description: z.string().trim().max(240, "Descrição longa demais"),
  quantity: z.number().min(0.01, "Informe a quantidade").max(9999, "Quantidade alta demais"),
  unitPrice: int.min(1, "Informe o valor unitário"),
  unit: z.enum(catalogUnits),
  courtesy: z.enum(["no", "yes", "today"]),
});

/**
 * O que o editor de orçamento aceita, na criação e na edição: é o mesmo formulário. Dinheiro em centavos,
 * datas em `yyyy-MM-dd`. Ao menos uma linha, senão não há o que orçar; validade depois da emissão.
 */
export const quoteFormSchema = z
  .object({
    /** Presente na edição; ausente na criação. */
    id: z.string().trim().min(1).optional(),
    title: z.string().trim().min(3, "Dê um título ao orçamento").max(120, "Título longo demais"),
    clientId: z.string().trim().min(1, "Escolha o cliente"),
    issuedAt: isoDay,
    validUntil: isoDay.nullable(),
    lines: z.array(lineSchema).min(1, "Adicione ao menos um item").max(MAX_LINES, `No máximo ${MAX_LINES} itens`),
    discount: z
      .object({
        kind: z.enum(["percent", "amount"]),
        value: int.min(1, "Informe o desconto"),
      })
      .nullable(),
    installments: int.min(1, "Ao menos uma parcela").max(24, "No máximo 24 parcelas"),
    paymentMethods: z.array(z.enum(paymentMethodValues)).min(1, "Escolha ao menos uma forma de pagamento"),
    cashDiscount: int.min(0, "O desconto não pode ser negativo").max(100, "O desconto vai até 100%"),
    notes: z.string().trim().max(1000, "Observações longas demais"),
    /** Salvar como rascunho ou já marcar como enviado. */
    intent: z.enum(["draft", "send"]),
  })
  .superRefine((data, ctx) => {
    if (data.validUntil && data.validUntil < data.issuedAt) {
      ctx.addIssue({ code: "custom", path: ["validUntil"], message: "A validade não pode ser antes da emissão" });
    }
    if (data.discount?.kind === "percent" && data.discount.value > 100) {
      ctx.addIssue({ code: "custom", path: ["discount", "value"], message: "O desconto vai até 100%" });
    }
  });

export type QuoteFormInput = z.infer<typeof quoteFormSchema>;

/** A resposta do cliente pelo link público: o token e a decisão. */
export const quoteResponseSchema = z.object({
  token: z.string().regex(/^[0-9a-f]{64}$/),
  decision: z.enum(["approve", "decline"]),
});

export type QuoteResponseInput = z.infer<typeof quoteResponseSchema>;
