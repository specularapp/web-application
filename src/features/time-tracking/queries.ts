import "server-only";
import { cookies } from "next/headers";
import { requireOrganization } from "@/features/organizations/context";
import { getActiveTimeEntry } from "./service";
import { TIMER_POSITION_COOKIE, parseTimerPosition } from "./summary";

export async function getTimeTrackerData(next = "/dashboard") {
  const [{ supabase, organizationId, user }, cookieStore] = await Promise.all([requireOrganization(next), cookies()]);
  return {
    active: await getActiveTimeEntry(supabase, organizationId, user.id),
    position: parseTimerPosition(cookieStore.get(TIMER_POSITION_COOKIE)?.value),
  };
}
