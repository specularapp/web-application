import "server-only";
import { requireUser } from "@/features/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getTeamState, listTeams, type TeamOption, type TeamState } from "./service";

export async function getCurrentTeamState(next = "/dashboard"): Promise<TeamState> {
  const user = await requireUser(next);
  const supabase = await createClient();
  return getTeamState(supabase, user.id);
}

export async function getTeamOptions(next = "/dashboard"): Promise<TeamOption[]> {
  const user = await requireUser(next);
  const supabase = await createClient();
  return listTeams(supabase, user.id);
}
