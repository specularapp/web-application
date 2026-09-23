import type { SupabaseClient } from "@supabase/supabase-js";
import { shareCredentials, shareToken, shareTokenHash } from "@/lib/security/share-token";
import type { Database } from "@/types/database";
import type { CreateApprovalInput, CreateApprovalVersionInput, SubmitApprovalDecisionInput } from "./schemas";
import type { ApprovalAsset, ApprovalDecision, ApprovalListItem, ApprovalProjectOption, ApprovalRequest, ApprovalVersion, PublicApproval } from "./summary";

type ApprovalClient = SupabaseClient<Database>;
type ServiceResult<T> = { ok: true; data: T } | { ok: false; error: string };

type RequestRow = Database["public"]["Tables"]["approval_requests"]["Row"];
type VersionRow = Database["public"]["Tables"]["approval_versions"]["Row"];
type AssetRow = Database["public"]["Tables"]["approval_assets"]["Row"];
type DecisionRow = Database["public"]["Tables"]["approval_decisions"]["Row"];

type ProjectRow = { id: string; reference: string; name: string; client_id: string | null; hue: string; logo_url: string | null; clients: { name: string } | null };
const projectOf = (row: ProjectRow): ApprovalProjectOption => ({ id: row.id, reference: row.reference, name: row.name, clientId: row.client_id, clientName: row.clients?.name ?? null, hue: row.hue, logoUrl: row.logo_url });
const assetOf = (row: AssetRow): ApprovalAsset => ({ id: row.id, name: row.name, url: row.url, position: row.position });
const decisionOf = (row: DecisionRow): ApprovalDecision => ({ type: row.decision, feedback: row.feedback, respondentName: row.respondent_name, createdAt: row.created_at });
const versionOf = (row: VersionRow, assets: ApprovalAsset[], decision: ApprovalDecision | null): ApprovalVersion => ({ id: row.id, number: row.version_number, title: row.title, notes: row.notes, sourceType: row.source_type, previewUrl: row.preview_url, createdAt: row.created_at, assets, decision });

export async function listApprovalProjects(client: ApprovalClient, organizationId: string): Promise<ApprovalProjectOption[]> {
  const { data } = await client.from("projects").select("id, reference, name, client_id, hue, logo_url, clients(name)").eq("organization_id", organizationId).order("created_at", { ascending: false });
  return ((data ?? []) as unknown as ProjectRow[]).map(projectOf);
}

async function versionMaps(client: ApprovalClient, organizationId: string, approvalIds: string[]) {
  if (!approvalIds.length) return { versions: new Map<string, ApprovalVersion[]>(), assets: new Map<string, ApprovalAsset[]>(), decisions: new Map<string, ApprovalDecision>() };
  const { data: versionRows } = await client
    .from("approval_versions")
    .select("*")
    .eq("organization_id", organizationId)
    .in("approval_id", approvalIds)
    .not("published_at", "is", null)
    .order("version_number", { ascending: false });
  const versionIds = ((versionRows ?? []) as VersionRow[]).map((row) => row.id);
  const [{ data: assetRows }, { data: decisionRows }] = versionIds.length
    ? await Promise.all([
        client.from("approval_assets").select("*").eq("organization_id", organizationId).in("version_id", versionIds).order("position"),
        client.from("approval_decisions").select("*").eq("organization_id", organizationId).in("version_id", versionIds),
      ])
    : [{ data: [] as AssetRow[] }, { data: [] as DecisionRow[] }];
  const assets = new Map<string, ApprovalAsset[]>();
  for (const row of (assetRows ?? []) as AssetRow[]) assets.set(row.version_id, [...(assets.get(row.version_id) ?? []), assetOf(row)]);
  const decisions = new Map<string, ApprovalDecision>();
  for (const row of (decisionRows ?? []) as DecisionRow[]) decisions.set(row.version_id, decisionOf(row));
  const versions = new Map<string, ApprovalVersion[]>();
  for (const row of (versionRows ?? []) as VersionRow[]) versions.set(row.approval_id, [...(versions.get(row.approval_id) ?? []), versionOf(row, assets.get(row.id) ?? [], decisions.get(row.id) ?? null)]);
  return { versions, assets, decisions };
}

type JoinedRequest = RequestRow & { projects: ProjectRow; tasks: { id: string; reference: string; title: string } | null };

const requestOf = (row: JoinedRequest, versions: ApprovalVersion[]): ApprovalRequest => ({
  id: row.id,
  reference: row.reference,
  title: row.title,
  description: row.description,
  status: row.status,
  project: projectOf(row.projects),
  task: row.tasks,
  versions,
  createdAt: row.created_at,
  expiresAt: row.expires_at,
  shareToken: shareToken("approval", row.id, row.share_token_version),
});

export async function listApprovals(client: ApprovalClient, organizationId: string): Promise<ApprovalListItem[]> {
  const { data } = await client.from("approval_requests").select("*, projects(id, reference, name, client_id, hue, logo_url, clients(name)), tasks(id, reference, title)").eq("organization_id", organizationId).order("created_at", { ascending: false });
  const rows = (data ?? []) as unknown as JoinedRequest[];
  const maps = await versionMaps(client, organizationId, rows.map((row) => row.id));
  return rows.map((row) => {
    const versions = maps.versions.get(row.id) ?? [];
    const request = requestOf(row, versions);
    const { versions: _versions, ...base } = request;
    return { ...base, latestVersion: versions[0] ?? null, versionCount: versions.length };
  });
}

export async function getApproval(client: ApprovalClient, organizationId: string, id: string): Promise<ApprovalRequest | null> {
  const { data } = await client.from("approval_requests").select("*, projects(id, reference, name, client_id, hue, logo_url, clients(name)), tasks(id, reference, title)").eq("organization_id", organizationId).eq("id", id).maybeSingle();
  if (!data) return null;
  const maps = await versionMaps(client, organizationId, [id]);
  return requestOf(data as unknown as JoinedRequest, maps.versions.get(id) ?? []);
}

export async function createApproval(client: ApprovalClient, organizationId: string, userId: string, input: CreateApprovalInput): Promise<ServiceResult<{ id: string }>> {
  const { data: project } = await client.from("projects").select("id, client_id").eq("organization_id", organizationId).eq("id", input.projectId).maybeSingle();
  if (!project) return { ok: false, error: "Projeto não encontrado." };
  if (input.taskId) {
    const { data: task } = await client.from("tasks").select("id, project_id").eq("organization_id", organizationId).eq("id", input.taskId).maybeSingle();
    if (!task || task.project_id !== input.projectId) return { ok: false, error: "A tarefa não pertence a este projeto." };
  }
  const id = crypto.randomUUID();
  const credentials = shareCredentials("approval", id);
  const { error } = await client.from("approval_requests").insert({ id, organization_id: organizationId, reference: "", project_id: input.projectId, task_id: input.taskId ?? null, client_id: project.client_id, title: input.title, description: input.description, share_token_hash: credentials.hash, created_by: userId });
  return error ? { ok: false, error: error.message } : { ok: true, data: { id } };
}

export async function createApprovalVersion(client: ApprovalClient, organizationId: string, userId: string, input: CreateApprovalVersionInput): Promise<ServiceResult<{ id: string; number: number }>> {
  const { data: request } = await client.from("approval_requests").select("id").eq("organization_id", organizationId).eq("id", input.approvalId).maybeSingle();
  if (!request) return { ok: false, error: "Aprovação não encontrada." };
  const { data: abandoned } = await client
    .from("approval_versions")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("approval_id", input.approvalId)
    .eq("created_by", userId)
    .is("published_at", null);
  const abandonedIds = (abandoned ?? []).map((row) => row.id);
  if (abandonedIds.length) await client.from("approval_versions").delete().eq("organization_id", organizationId).in("id", abandonedIds);

  const { data: latest } = await client.from("approval_versions").select("version_number").eq("approval_id", input.approvalId).order("version_number", { ascending: false }).limit(1).maybeSingle();
  const number = (latest?.version_number ?? 0) + 1;
  const id = crypto.randomUUID();
  const { error } = await client.from("approval_versions").insert({ id, organization_id: organizationId, approval_id: input.approvalId, version_number: number, title: input.title, notes: input.notes, source_type: input.sourceType, preview_url: input.sourceType === "url" ? input.previewUrl : null, published_at: input.sourceType === "url" ? new Date().toISOString() : null, created_by: userId });
  if (error) return { ok: false, error: error.message };
  if (input.sourceType === "url") await client.from("approval_requests").update({ status: "pending" }).eq("organization_id", organizationId).eq("id", input.approvalId);
  return { ok: true, data: { id, number } };
}

export async function prepareApprovalAsset(client: ApprovalClient, organizationId: string, versionId: string, contentType: string): Promise<ServiceResult<{ path: string; token: string }>> {
  const { data } = await client.from("approval_versions").select("id, approval_id").eq("organization_id", organizationId).eq("id", versionId).maybeSingle();
  if (!data) return { ok: false, error: "Versão não encontrada." };
  const extension = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/avif": "avif" }[contentType];
  if (!extension) return { ok: false, error: "Formato de imagem inválido." };
  const path = `${organizationId}/aprovacoes/${data.approval_id}/${versionId}-${crypto.randomUUID()}.${extension}`;
  const { data: prepared, error } = await client.storage.from("approval-files").createSignedUploadUrl(path);
  return error || !prepared ? { ok: false, error: "Não foi possível preparar o envio." } : { ok: true, data: { path: prepared.path, token: prepared.token } };
}

export async function attachApprovalAsset(client: ApprovalClient, organizationId: string, input: { versionId: string; path: string; name: string; position: number }): Promise<ServiceResult<ApprovalAsset>> {
  if (!input.path.startsWith(`${organizationId}/`)) return { ok: false, error: "Caminho de arquivo inválido." };
  const { data: version } = await client.from("approval_versions").select("id").eq("organization_id", organizationId).eq("id", input.versionId).maybeSingle();
  if (!version) return { ok: false, error: "Versão não encontrada." };
  const { data: publicData } = client.storage.from("approval-files").getPublicUrl(input.path);
  const { data, error } = await client.from("approval_assets").insert({ organization_id: organizationId, version_id: input.versionId, name: input.name, url: publicData.publicUrl, position: input.position }).select("*").single();
  if (error || !data) return { ok: false, error: error?.message ?? "Não foi possível anexar a imagem." };
  return { ok: true, data: assetOf(data) };
}

export async function publishApprovalVersion(client: ApprovalClient, organizationId: string, userId: string, versionId: string): Promise<ServiceResult<{ id: string }>> {
  const { data: version } = await client
    .from("approval_versions")
    .select("id, approval_id, source_type, created_by, published_at")
    .eq("organization_id", organizationId)
    .eq("id", versionId)
    .maybeSingle();
  if (!version || version.source_type !== "images" || version.created_by !== userId) return { ok: false, error: "Versão não encontrada." };
  if (version.published_at) return { ok: true, data: { id: version.id } };
  const { count } = await client
    .from("approval_assets")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("version_id", versionId);
  if (!count) return { ok: false, error: "Envie ao menos uma imagem antes de publicar." };
  const { error } = await client.from("approval_versions").update({ published_at: new Date().toISOString() }).eq("organization_id", organizationId).eq("id", versionId);
  if (error) return { ok: false, error: error.message };
  await client.from("approval_requests").update({ status: "pending" }).eq("organization_id", organizationId).eq("id", version.approval_id);
  return { ok: true, data: { id: version.id } };
}

export async function getPublicApproval(admin: ApprovalClient, token: string): Promise<PublicApproval | null> {
  const { data } = await admin.rpc("approval_by_token", { p_token_hash: shareTokenHash(token) });
  return data ? (data as unknown as PublicApproval) : null;
}

export async function submitPublicApprovalDecision(admin: ApprovalClient, token: string, input: SubmitApprovalDecisionInput): Promise<ServiceResult<string>> {
  const { data, error } = await admin.rpc("submit_approval_decision", { p_token_hash: shareTokenHash(token), p_version_id: input.versionId, p_decision: input.decision, p_feedback: input.feedback, p_respondent_name: input.respondentName });
  if (error || !data) return { ok: false, error: error?.message ?? "Não foi possível registrar a decisão." };
  return { ok: true, data: (data as { approvalId: string }).approvalId };
}
