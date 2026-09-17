import { z } from "zod";
import { aiScopeIds } from "./scope";

/** O teto de uma pergunta: o bastante para um pedido longo sem virar um envio gigante ao modelo. */
export const aiLimits = { question: 4000, title: 200 } as const;

const scopeIds = aiScopeIds as unknown as [string, ...string[]];

/** O que o compositor manda ao servidor: a pergunta, as fontes e em qual conversa ela entra. */
export const askAiSchema = z.object({
  question: z.string().trim().min(1, "Escreva a pergunta").max(aiLimits.question, "Pergunta longa demais"),
  scope: z.array(z.enum(scopeIds)).max(aiScopeIds.length),
  conversationId: z.uuid().nullable(),
  /** As últimas trocas, para a resposta manter o fio sem reenviar a conversa inteira. */
  history: z
    .array(z.object({ role: z.enum(["person", "assistant"]), text: z.string().max(aiLimits.question) }))
    .max(20)
    .default([]),
});

export type AskAiInput = z.infer<typeof askAiSchema>;

export const conversationIdSchema = z.uuid();

export const renameConversationSchema = z.object({
  id: z.uuid(),
  title: z.string().trim().min(1, "Dê um nome à conversa").max(aiLimits.title, "Nome longo demais"),
});
