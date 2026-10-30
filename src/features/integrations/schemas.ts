import { z } from "zod";
import { DEFAULT_RATE_LIMIT, apiScopeIds, webhookEventIds } from "./catalog";

const unique = <T>(list: T[]) => [...new Set(list)];

export const integrationIdSchema = z.object({ id: z.uuid() });

export const apiKeyInputSchema = z.object({
  name: z.string().trim().min(2, "Dê um nome à chave, como o do sistema que vai usá-la.").max(60, "O nome passa de 60 letras."),
  description: z.string().trim().max(500, "A descrição pode ter até 500 caracteres.").default(""),
  scopes: z.array(z.enum(apiScopeIds)).min(1, "Marque ao menos uma permissão para a chave.").max(32).transform(unique),
  enabled: z.boolean().default(true),
  expiresAt: z.iso.datetime({ offset: true }).nullable().default(null),
  rateLimit: z.number().int().min(1, "O limite mínimo é 1 chamada por minuto.").max(1000, "O limite máximo é 1.000 chamadas por minuto.").default(DEFAULT_RATE_LIMIT),
  allowedIps: z
    .array(z.union([z.ipv4(), z.ipv6()], { error: "Informe endereços IPv4 ou IPv6 válidos, um por linha." }))
    .max(20, "Use até 20 endereços.")
    .transform(unique)
    .default([]),
});

export const updateApiKeySchema = apiKeyInputSchema.extend({ id: z.uuid() });

export const apiKeyEnabledSchema = z.object({ id: z.uuid(), enabled: z.boolean() });

export const apiRequestsQuerySchema = z.object({ keyId: z.uuid().optional() });

export const webhookInputSchema = z.object({
  description: z.string().trim().max(80, "A descrição passa de 80 letras.").default(""),
  url: z.string().trim().min(1, "Informe o endereço que vai receber os eventos.").max(500, "O endereço é longo demais."),
  events: z.array(z.enum(webhookEventIds)).min(1, "Marque ao menos um evento.").transform(unique),
  active: z.boolean().default(true),
});

export const updateWebhookSchema = webhookInputSchema.extend({ id: z.uuid() });

export type ApiKeyInput = z.infer<typeof apiKeyInputSchema>;
export type WebhookInput = z.infer<typeof webhookInputSchema>;
