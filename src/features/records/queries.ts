import "server-only";
import { cacheKey, cacheTtl, cached } from "@/lib/cache";
import { cacheTags } from "@/lib/cache/tags";
import { requireOrganization } from "@/features/organizations/context";
import type { AppRecord } from "./records";
import { listAppRecords } from "./service";

/**
 * O índice da casa: sete leituras somadas, que a busca e o vincular registro consultam. Guardado por um
 * minuto, porque é o tipo de leitura em que ninguém percebe atraso e que apareceria em toda abertura do
 * quadro de tarefas.
 */
export async function getAppRecords(next = "/tarefas"): Promise<AppRecord[]> {
  const { supabase, organizationId } = await requireOrganization(next);

  return cached(
    cacheKey(organizationId, "records"),
    { organizationId, tags: [cacheTags.records], ttl: cacheTtl.records },
    () => listAppRecords(supabase, organizationId),
  );
}
