import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { listTeamMembers } from "@/features/organizations/service";
import { dbMessage } from "@/lib/db/message";
import type { Database } from "@/types/database";
import type { TaskAccessPerson, TaskAccessTarget } from "./access";

type Client = SupabaseClient<Database>;

const FAILED = "Não foi possível salvar o acesso. Tente de novo em instantes.";

/** As pastas acima de uma pasta, da mais perto à raiz, com o nome de cada uma. */
async function ancestorsOf(client: Client, organizationId: string, folderId: string | null) {
  const { data } = await client.from("project_folders").select("id, name, parent_id").eq("organization_id", organizationId);
  const byId = new Map((data ?? []).map((folder) => [folder.id, folder]));
  const chain: { id: string; name: string }[] = [];
  let at = folderId ? byId.get(folderId) : undefined;
  while (at && chain.length < 32) {
    chain.push({ id: at.id, name: at.name });
    at = at.parent_id ? byId.get(at.parent_id) : undefined;
  }
  return chain;
}

/**
 * As pessoas do cargo só de tarefas, cada uma com o acesso a este alvo: liberado aqui, liberado por uma pasta de
 * cima (que já basta) ou sem acesso.
 */
export async function getTaskAccess(client: Client, organizationId: string, target: TaskAccessTarget): Promise<TaskAccessPerson[]> {
  const members = (await listTeamMembers(client, organizationId)).filter((member) => member.role === "tasks");
  if (members.length === 0) return [];

  let parentFolder: string | null = null;
  if (target.kind === "board") {
    const { data } = await client.from("projects").select("folder_id").eq("organization_id", organizationId).eq("id", target.id).maybeSingle();
    parentFolder = data?.folder_id ?? null;
  } else {
    const { data } = await client.from("project_folders").select("parent_id").eq("organization_id", organizationId).eq("id", target.id).maybeSingle();
    parentFolder = data?.parent_id ?? null;
  }
  const above = await ancestorsOf(client, organizationId, parentFolder);

  const { data: grants } = await client.from("task_access").select("user_id, project_id, folder_id").eq("organization_id", organizationId);
  const direct = new Set((grants ?? []).filter((grant) => (target.kind === "board" ? grant.project_id === target.id : grant.folder_id === target.id)).map((grant) => grant.user_id));
  const inherited = new Map<string, string>();
  for (const folder of [...above].reverse()) {
    for (const grant of grants ?? []) if (grant.folder_id === folder.id && !inherited.has(grant.user_id)) inherited.set(grant.user_id, folder.name);
  }

  return members.map((member) => ({
    userId: member.userId,
    name: member.name || member.email || "Pessoa",
    email: member.email,
    avatarUrl: member.avatarUrl,
    granted: direct.has(member.userId),
    inheritedFrom: inherited.get(member.userId) ?? null,
  }));
}

/** Liga ou desliga o acesso de uma pessoa a uma página ou pasta. */
export async function setTaskAccess(client: Client, organizationId: string, userId: string, target: Pick<TaskAccessTarget, "kind" | "id">, granted: boolean, actorId: string) {
  const column = target.kind === "board" ? "project_id" : "folder_id";
  if (!granted) {
    const { error } = await client.from("task_access").delete().eq("organization_id", organizationId).eq("user_id", userId).eq(column, target.id);
    return error ? { ok: false as const, error: dbMessage(error, FAILED) } : { ok: true as const };
  }

  const { error } = await client.from("task_access").insert({
    organization_id: organizationId,
    user_id: userId,
    created_by: actorId,
    ...(target.kind === "board" ? { project_id: target.id } : { folder_id: target.id }),
  });
  if (error?.code === "23505") return { ok: true as const };
  return error ? { ok: false as const, error: dbMessage(error, FAILED) } : { ok: true as const };
}
