import { z } from "zod";

export const questionTypeSchema = z.enum(["short_text", "long_text", "email", "phone", "single_choice", "multiple_choice", "date"]);
export const profileFieldSchema = z.enum(["name", "email", "phone", "company", "role", "city", "website", "about"]);
export const formStatusSchema = z.enum(["draft", "published", "closed"]);

export const intakeQuestionSchema = z
  .object({
    id: z.uuid().optional(),
    type: questionTypeSchema,
    profileField: profileFieldSchema.nullable(),
    label: z.string().trim().min(2, "Escreva a pergunta.").max(160),
    description: z.string().trim().max(500).default(""),
    placeholder: z.string().trim().max(120).default(""),
    required: z.boolean(),
    options: z.array(z.string().trim().min(1).max(100)).max(30),
    page: z.number().int().min(0).max(59).default(0),
  })
  .superRefine((question, context) => {
    if ((question.type === "single_choice" || question.type === "multiple_choice") && question.options.length < 2) {
      context.addIssue({ code: "custom", path: ["options"], message: "Adicione ao menos duas opções." });
    }
    if (question.profileField === "email" && question.type !== "email") {
      context.addIssue({ code: "custom", path: ["profileField"], message: "O e-mail precisa usar o tipo E-mail." });
    }
    if (question.profileField === "phone" && question.type !== "phone") {
      context.addIssue({ code: "custom", path: ["profileField"], message: "O telefone precisa usar o tipo Telefone." });
    }
    if (question.profileField && ["name", "company", "role", "city", "website"].includes(question.profileField) && question.type !== "short_text") {
      context.addIssue({ code: "custom", path: ["profileField"], message: "Este campo do cliente precisa usar uma resposta curta." });
    }
    if (question.profileField === "about" && question.type !== "short_text" && question.type !== "long_text") {
      context.addIssue({ code: "custom", path: ["profileField"], message: "Sobre o cliente precisa usar uma resposta de texto." });
    }
  });

export const intakeFormSchema = z
  .object({
    id: z.uuid().optional(),
    projectId: z.uuid("Escolha o projeto."),
    clientId: z.uuid().nullable().default(null),
    title: z.string().trim().min(2, "Dê um nome ao formulário.").max(120),
    description: z.string().trim().max(1200).default(""),
    status: formStatusSchema.default("draft"),
    submitLabel: z.string().trim().min(2).max(40),
    successTitle: z.string().trim().min(2).max(80),
    successMessage: z.string().trim().min(2).max(500),
    consentText: z.string().trim().min(20, "Explique como as informações serão usadas.").max(1000),
    expiresAt: z.iso.datetime(),
    questions: z.array(intakeQuestionSchema).min(1, "Adicione ao menos uma pergunta.").max(60),
  })
  .superRefine((form, context) => {
    const used = new Set<string>();
    form.questions.forEach((question, index) => {
      if (!question.profileField) return;
      if (used.has(question.profileField)) {
        context.addIssue({ code: "custom", path: ["questions", index, "profileField"], message: "Este campo do cliente já está ligado a outra pergunta." });
      }
      used.add(question.profileField);
    });
  });

export const formIdSchema = z.uuid();

export const publicAnswersSchema = z.object({
  answers: z.record(z.string(), z.union([z.string(), z.array(z.string())])),
  consent: z.literal(true, { error: "É preciso aceitar o uso das informações para enviar." }),
});

export type IntakeFormInput = z.infer<typeof intakeFormSchema>;
export type PublicAnswersInput = z.infer<typeof publicAnswersSchema>;
