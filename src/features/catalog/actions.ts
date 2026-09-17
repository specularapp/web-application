"use server";

import { firstIssue, guardAction, revalidateDomain } from "@/features/organizations/context";
import { cacheTags } from "@/lib/cache/tags";
import { catalogFormSchema, catalogIdsSchema } from "./schemas";
import { deleteCatalogItems, getCatalogItem, saveCatalogItem } from "./service";
import type { CatalogItem } from "./summary";

export type CatalogSaveResult = { ok: true; id: string } | { ok: false; error: string; field?: string };
export type CatalogDeleteResult = { ok: true; deleted: number } | { ok: false; error: string };

/** A ficha completa de um item, buscada quando a gaveta abre. */
export async function loadCatalogItemAction(id: string): Promise<CatalogItem | null> {
  const guard = await guardAction("catalog-load");
  if (!guard.ok) return null;

  return getCatalogItem(guard.context.supabase, guard.context.organizationId, id);
}

/**
 * Salva a ficha de produto ou serviço, criando ou editando: é o mesmo formulário e a mesma regra. O campo
 * com problema volta pelo caminho dele ("duration.max", "stock.quantity"), para o formulário acender o
 * campo certo.
 */
export async function saveCatalogItemAction(input: unknown): Promise<CatalogSaveResult> {
  const guard = await guardAction("catalog-save");
  if (!guard.ok) return { ok: false, error: guard.error };

  const parsed = catalogFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) };

  const { supabase, organizationId, user } = guard.context;
  const saved = await saveCatalogItem(supabase, organizationId, user.id, parsed.data);
  if (!saved.ok) return { ok: false, error: saved.error };

  await revalidateDomain(guard.context.organizationId, [cacheTags.catalog], ["/catalogo"]);
  return { ok: true, id: saved.data.id };
}

export async function deleteCatalogItemsAction(input: unknown): Promise<CatalogDeleteResult> {
  const guard = await guardAction("catalog-delete");
  if (!guard.ok) return { ok: false, error: guard.error };

  const parsed = catalogIdsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Escolha ao menos um item." };

  const removed = await deleteCatalogItems(guard.context.supabase, guard.context.organizationId, parsed.data);
  if (!removed.ok) return { ok: false, error: removed.error };

  await revalidateDomain(guard.context.organizationId, [cacheTags.catalog], ["/catalogo"]);
  return { ok: true, deleted: removed.data.deleted };
}
