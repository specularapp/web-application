"use server";

import { requireOrganization, revalidateDomain, TOO_MANY } from "@/features/organizations/context";
import { cacheTags, type DomainTag } from "@/lib/cache/tags";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { attachUploadSchema, clearUploadSchema, createUploadSchema, contentTypesOf, type UploadTarget } from "./schemas";
import { attachImage, clearImage, createImageUpload, type ServiceResult } from "./service";

/**
 * A porta da web para a subida de imagem. A regra mora em `service.ts` e é a mesma que `api/v1/imagens`
 * serve ao aplicativo, como a casa exige de toda regra de negócio.
 */

const INVALID = "Confira a imagem escolhida.";

/**
 * De quem é a imagem, para o cache cair junto (2026-09-16, correção). Sem isto a imagem entrava no banco e a
 * tela seguia mostrando a antiga até o cache vencer: o endereço muda na linha, mas quem desenha a lista lê
 * do Redis. Era o "demora para aparecer" que o usuário relatou.
 */
const domainOf: Record<UploadTarget, { tag: DomainTag; path: string }> = {
  "client-avatar": { tag: cacheTags.clients, path: "/clientes" },
  "client-logo": { tag: cacheTags.clients, path: "/clientes" },
  "catalog-image": { tag: cacheTags.catalog, path: "/catalogo" },
  "project-cover": { tag: cacheTags.projects, path: "/projetos" },
  "project-logo": { tag: cacheTags.projects, path: "/projetos" },
};

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

  const attached = await attachImage(supabase, { ...parsed.data, organizationId });
  if (attached.ok) {
    const domain = domainOf[parsed.data.target];
    await revalidateDomain(organizationId, [domain.tag], [domain.path]);
  }
  return attached;
}

export async function clearUploadAction(input: unknown): Promise<ServiceResult<undefined>> {
  const { supabase, user, organizationId } = await requireOrganization();
  if (!(await withinLimit("clear", user.id))) return { ok: false, error: TOO_MANY };

  const parsed = clearUploadSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: INVALID };

  const cleared = await clearImage(supabase, { ...parsed.data, organizationId });
  if (cleared.ok) {
    const domain = domainOf[parsed.data.target];
    await revalidateDomain(organizationId, [domain.tag], [domain.path]);
  }
  return cleared;
}
