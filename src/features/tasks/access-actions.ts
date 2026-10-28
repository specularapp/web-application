"use server";

import { z } from "zod";
import { firstIssue, guardAction, revalidateDomain } from "@/features/organizations/context";
import { cacheTags } from "@/lib/cache/tags";
import type { TaskAccessPerson } from "./access";
import { getTaskAccess, setTaskAccess } from "./access-service";

/* O acesso do cargo só de tarefas (2026-10-28): quem pode ver e mudar é a equipe (a RLS de `task_access` exige
   `can_write`, que o cargo de tarefas não passa). */

const targetSchema = z.object({ kind: z.enum(["board", "folder"]), id: z.uuid(), name: z.string().max(200) });

const toggleSchema = z.object({ kind: z.enum(["board", "folder"]), id: z.uuid(), userId: z.uuid(), granted: z.boolean() });

type Failure = { ok: false; error: string; field?: string };

export async function loadTaskAccessAction(input: unknown): Promise<{ ok: true; people: TaskAccessPerson[] } | Failure> {
  const guard = await guardAction("task-access-load");
  if (!guard.ok) return { ok: false, error: guard.error };

  const parsed = targetSchema.safeParse(input);
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) };

  const { supabase, organizationId } = guard.context;
  return { ok: true, people: await getTaskAccess(supabase, organizationId, parsed.data) };
}

export async function setTaskAccessAction(input: unknown): Promise<{ ok: true } | Failure> {
  const guard = await guardAction("task-access-set");
  if (!guard.ok) return { ok: false, error: guard.error };

  const parsed = toggleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) };

  const { supabase, organizationId, user } = guard.context;
  const result = await setTaskAccess(supabase, organizationId, parsed.data.userId, parsed.data, parsed.data.granted, user.id);
  if (!result.ok) return result;

  await revalidateDomain(organizationId, [cacheTags.projects, cacheTags.tasks], ["/tarefas"]);
  return { ok: true };
}
