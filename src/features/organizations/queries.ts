import "server-only";
import { requireUser } from "@/features/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getTeamState, type TeamState } from "./service";

export async function getCurrentTeamState(next = "/dashboard"): Promise<TeamState> {
  const user = await requireUser(next);
  const supabase = await createClient();
  return getTeamState(supabase, user.id);
}
