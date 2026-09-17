import { z } from "zod";

/**
 * O zod do financeiro: o que chega das janelas de nova cobrança, de pagamento de parcela e de nova
 * movimentação, e do link público, é entrada de usuário e é fechado aqui, no servidor.
 */

export const chargeLimits = {
  title: 90,
  description: 160,
  notes: 500,
  paymentInfo: 200,
  installments: 24,
  /** R$ 1.000.000,00 em centavos: acima disso é erro de digitação. */
  amount: 100_000_000,
} as const;

export const chargeMethodValues = ["pix", "boleto", "transfer", "card"] as const;

/* Todo identificador de registro é o uuid que a tabela gera: fechar no formato aqui recusa o palpite antes
   de ele virar consulta. */
const idSchema = z.uuid();
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data.");

export const createChargeSchema = z.object({
  clientId: idSchema.nullable().refine((value) => value !== null, { message: "Escolha o cliente." }),
  title: z.string().trim().min(2, "Dê um título à cobrança.").max(chargeLimits.title, "O título está longo demais."),
  description: z.string().trim().max(chargeLimits.description, "A descrição está longa demais."),
  amount: z.number().int().min(100, "O valor precisa ser de pelo menos R$ 1,00.").max(chargeLimits.amount, "Confira o valor."),
  installments: z.number().int().min(1).max(chargeLimits.installments, `Até ${chargeLimits.installments} parcelas.`),
  firstDueDate: dateSchema,
  method: z.enum(chargeMethodValues),
  paymentInfo: z.string().trim().max(chargeLimits.paymentInfo, "As instruções estão longas demais."),
  notes: z.string().trim().max(chargeLimits.notes, "As observações estão longas demais."),
  quoteId: idSchema.nullable(),
});

export type CreateChargeInput = z.infer<typeof createChargeSchema>;

export const chargeIdSchema = z.object({ id: idSchema });

export const installmentRefSchema = z.object({ id: idSchema, installmentId: idSchema });

export const payInstallmentSchema = installmentRefSchema.extend({
  method: z.enum(chargeMethodValues).nullable(),
  /** `yyyy-MM-dd`; sem ela, hoje. */
  paidOn: dateSchema.nullable(),
});

export type PayInstallmentInput = z.infer<typeof payInstallmentSchema>;

export const reportPaymentSchema = z.object({ token: z.string().regex(/^[0-9a-f]{64}$/), installmentId: idSchema });

export const transactionLimits = { title: 80, description: 120, amount: 100_000_000 } as const;

export const createTransactionSchema = z.object({
  kind: z.enum(["income", "expense"]),
  title: z.string().trim().min(2, "Diga de quem veio ou para onde foi.").max(transactionLimits.title),
  description: z.string().trim().max(transactionLimits.description),
  amount: z.number().int().min(1, "Informe o valor.").max(transactionLimits.amount, "Confira o valor."),
  date: dateSchema,
  method: z.enum(["pix", "card", "boleto", "transfer"]).nullable(),
});

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;

export const financePeriodValues = ["mes", "trimestre", "ano", "tudo"] as const;

export const financePeriodSchema = z.enum(financePeriodValues).catch("mes");
