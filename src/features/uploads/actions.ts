"use server";

import { requireOrganization, TOO_MANY } from "@/features/organizations/context";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { attachUploadSchema, clearUploadSchema, createUploadSchema, contentTypesOf } from "./schemas";
import { attachImage, clearImage, createImageUpload, type ServiceResult } from "./service";

/**
 * A porta da web para a subida de imagem. A regra mora em `service.ts` e é a mesma que `api/v1/imagens`
 * serve ao aplicativo, como a casa exige de toda regra de negócio.
 */

const INVALID = "Confira a imagem escolhida.";

/* Assinar um endereço é barato, mas é escrita no Storage do outro lado: o limite existe para uma aba aberta
   não virar uma fila de arquivos órfãos. Mesma régua das outras ações da casa. */
async function withinLimit(operation: string, userId: string) {
  const { allowed } = await checkRateLimit("action", `imagem-${operation}:${userId}`, crypto.randomUUID());
  return allowed;
}

export async function createUploadAction(input: unknown): Promise<ServiceResult<{ path: string; token: string }>> {
  const { supabase, user, organizationId } = await requireOrganization();
  if (!(await withinLimit("create", user.id))) return { ok: false, error: TOO_MANY };

  const parsed = createUploadSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: INVALID };

  /* O avatar de cliente aceita menos tipos que o resto, porque o balde dele aceita menos: conferir aqui
     evita a subida inteira para o Storage recusar no fim. */
  if (!contentTypesOf(parsed.data.target).safeParse(parsed.data.contentType).success) {
    return { ok: false, error: "Envie a imagem em PNG, JPG ou WEBP." };
  }

  return createImageUpload(supabase, { ...parsed.data, organizationId });
}

export async function attachUploadAction(input: unknown): Promise<ServiceResult<string>> {
  const { supabase, user, organizationId } = await requireOrganization();
  if (!(await withinLimit("attach", user.id))) return { ok: false, error: TOO_MANY };

  const parsed = attachUploadSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: INVALID };

  return attachImage(supabase, { ...parsed.data, organizationId });
}

export async function clearUploadAction(input: unknown): Promise<ServiceResult<undefined>> {
  const { supabase, user, organizationId } = await requireOrganization();
  if (!(await withinLimit("clear", user.id))) return { ok: false, error: TOO_MANY };

  const parsed = clearUploadSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: INVALID };

  return clearImage(supabase, { ...parsed.data, organizationId });
}
