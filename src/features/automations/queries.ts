import "server-only";
import { cacheKey, cacheTtl, cached } from "@/lib/cache";
import { cacheTags } from "@/lib/cache/tags";
import { requireOrganization } from "@/features/organizations/context";
import { getAutomation, listAutomations } from "./service";
import type { Automation } from "./summary";

export async function getAutomations(next = "/automacoes"): Promise<Automation[]> {
  const { supabase, organizationId } = await requireOrganization(next);

  return cached(
    cacheKey(organizationId, "automations:list"),
    { organizationId, tags: [cacheTags.automations], ttl: cacheTtl.list },
    () => listAutomations(supabase, organizationId),
  );
}

export async function getAutomationById(id: string, next = "/automacoes"): Promise<Automation | null> {
  const { supabase, organizationId } = await requireOrganization(next);
  return getAutomation(supabase, organizationId, id);
}
