"use server";

import { firstIssue, guardAction, revalidateDomain } from "@/features/organizations/context";
import { cacheTags } from "@/lib/cache/tags";
import { startTimerSchema, stopTimerSchema, taskTimeSchema } from "./schemas";
import { listTaskTimeEntries, startTimeEntry, stopTimeEntry } from "./service";
import type { TimeEntry } from "./summary";

export async function startTimerAction(input: unknown) {
  const guard = await guardAction("timer-start");
  if (!guard.ok) return { ok: false as const, error: guard.error };
  const parsed = startTimerSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, ...firstIssue(parsed.error) };
  const result = await startTimeEntry(guard.context.supabase, guard.context.organizationId, guard.context.user.id, parsed.data);
  if (!result.ok) return { ok: false as const, error: result.error };
  await revalidateDomain(guard.context.organizationId, [cacheTags.time], []);
  return result;
}

export async function stopTimerAction(input: unknown) {
  const guard = await guardAction("timer-stop");
  if (!guard.ok) return { ok: false as const, error: guard.error };
  const parsed = stopTimerSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, ...firstIssue(parsed.error) };
  const result = await stopTimeEntry(guard.context.supabase, guard.context.organizationId, guard.context.user.id, parsed.data.id);
  if (!result.ok) return { ok: false as const, error: result.error };
  await revalidateDomain(guard.context.organizationId, [cacheTags.time], []);
  return result;
}

/** Os apontamentos de quem está vendo, numa tarefa: é o registro que a ficha mostra. */
export async function loadTaskTimeAction(input: unknown): Promise<{ ok: true; data: TimeEntry[] } | { ok: false; error: string }> {
  const guard = await guardAction("timer-read");
  if (!guard.ok) return { ok: false, error: guard.error };
  const parsed = taskTimeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) };
  return { ok: true, data: await listTaskTimeEntries(guard.context.supabase, guard.context.organizationId, guard.context.user.id, parsed.data.taskId) };
}
