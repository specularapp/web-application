import { z } from "zod";
import { houseDay } from "@/lib/utils/day";
import { chargeDirectionValues } from "./summary";

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
const dateSchema = z.iso.date("Informe uma data válida");

export const chargeRecurrenceValues = ["none", "monthly", "quarterly", "yearly"] as const;

export const createChargeSchema = z.object({
  /** Para que lado o dinheiro anda: recebida é cobrança, paga é despesa. */
  direction: z.enum(chargeDirectionValues),
  /* Nulo é a **avulsa**: nem tudo que se cobra é de um cliente cadastrado, e obrigar a cadastrar alguém só
     para poder lançar sujaria a base de clientes. O que dá nome a ela é o título, ou `partyName`. */
  clientId: idSchema.nullable(),
  /* A contraparte digitada, para quando ela não é ninguém da base: o fornecedor da despesa, quase sempre, e
     o pagador solto de uma cobrança avulsa. Vazio é não ter contraparte, e aí o título responde por ela. */
  partyName: z.string().trim().max(80, "O nome está longo demais").refine((value) => value.length === 0 || value.length >= 2, "Informe ao menos dois caracteres para o fornecedor"),
  title: z.string().trim().min(2, "Dê um título à cobrança.").max(chargeLimits.title, "O título está longo demais."),
  description: z.string().trim().max(chargeLimits.description, "A descrição está longa demais."),
  amount: z.number().int().min(100, "O valor precisa ser de pelo menos R$ 1,00.").max(chargeLimits.amount, "Confira o valor."),
  installments: z.number().int().min(1).max(chargeLimits.installments, `Até ${chargeLimits.installments} parcelas.`),
  firstDueDate: dateSchema,
  method: z.enum(chargeMethodValues),
  paymentInfo: z.string().trim().max(chargeLimits.paymentInfo, "As instruções estão longas demais."),
  notes: z.string().trim().max(chargeLimits.notes, "As observações estão longas demais."),
  quoteId: idSchema.nullable(),
  /** Com que frequência ela se repete; a próxima nasce quando esta fecha. */
  recurrence: z.enum(chargeRecurrenceValues),
}).superRefine((value, context) => {
  if (value.direction === "outgoing" && !value.clientId && !value.partyName) {
    context.addIssue({ code: "custom", path: ["partyName"], message: "Informe o fornecedor da despesa." });
  }
  if (value.direction === "outgoing" && value.quoteId) {
    context.addIssue({ code: "custom", path: ["quoteId"], message: "Despesa não pode nascer de orçamento." });
  }
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
  /* Movimentação avulsa é dinheiro que já entrou ou já saiu, e nasce confirmada: com data futura ela
     derrubava o caixa de hoje por algo que ainda não aconteceu. O que é para frente se lança como cobrança
     ou despesa, que tem parcela e vencimento. A guarda vale no servidor, e não só na tela, porque a regra
     precisa valer para o aplicativo também (2026-09-22, na varredura). */
  date: dateSchema.refine((value) => value <= houseDay(), "A data não pode ser no futuro."),
  method: z.enum(["pix", "card", "boleto", "transfer"]).nullable(),
});

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;

export const financePeriodValues = ["mes", "trimestre", "ano", "tudo"] as const;

export const financePeriodSchema = z.enum(financePeriodValues).catch("mes");

/** Encerrar a série: a cobrança de agora fica como está, e a próxima não nasce mais. */
export const stopRecurrenceSchema = z.object({ id: idSchema });
