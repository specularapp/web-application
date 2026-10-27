"use server";

import { INVALID_INPUT, guardedAction } from "@/features/organizations/context";
import { searchSchema } from "./schemas";
import { searchEverything } from "./service";
import type { SearchGroup } from "./summary";

export type SearchResult = { ok: true; groups: SearchGroup[] } | { ok: false; error: string };

/** A busca da paleta: o termo nos registros da equipe em vigor, com o teto de requisições de toda ação. */
export async function searchAction(input: unknown): Promise<SearchResult> {
  return guardedAction<SearchResult>(
    "search",
    async ({ supabase, organizationId }) => {
      const parsed = searchSchema.safeParse(input);
      if (!parsed.success) return { ok: false, error: INVALID_INPUT };

      return { ok: true, groups: await searchEverything(supabase, organizationId, parsed.data.term) };
    },
    (error) => ({ ok: false, error }),
  );
}
