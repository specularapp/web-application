import { z } from "zod";

export const feedbackIdSchema = z.uuid();

export const createFeedbackSchema = z.object({
  projectId: z.uuid("Escolha um projeto."),
  title: z.string().trim().min(2, "Informe o título.").max(120),
  prompt: z.string().trim().min(2, "Informe a mensagem.").max(500),
});

export const submitFeedbackSchema = z.object({
  rating: z.number().int().min(1).max(5),
  wouldRecommend: z.boolean(),
  comment: z.string().trim().max(1200).default(""),
  respondentName: z.string().trim().max(80).default("").refine((value) => !value || value.length >= 2, "Informe seu nome completo."),
});

export type CreateFeedbackInput = z.infer<typeof createFeedbackSchema>;
export type SubmitFeedbackInput = z.infer<typeof submitFeedbackSchema>;
