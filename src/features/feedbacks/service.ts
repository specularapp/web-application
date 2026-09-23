import type { SupabaseClient } from "@supabase/supabase-js";
import { shareCredentials, shareToken, shareTokenHash } from "@/lib/security/share-token";
import type { Database } from "@/types/database";
import type { CreateFeedbackInput, SubmitFeedbackInput } from "./schemas";
import type { ClientFeedback, FeedbackProjectOption, PublicClientFeedback } from "./summary";

type FeedbackClient = SupabaseClient<Database>;
type ServiceResult<T> = { ok: true; data: T } | { ok: false; error: string };

type FeedbackRow = {
  id: string;
  reference: string;
  title: string;
  prompt: string;
  status: ClientFeedback["status"];
  rating: number | null;
  would_recommend: boolean | null;
  comment: string | null;
  respondent_name: string | null;
  submitted_at: string | null;
  created_at: string;
  share_token_version: number;
  projects: {
    id: string;
    reference: string;
    name: string;
    client_id: string | null;
    hue: string;
    logo_url: string | null;
    clients: { name: string } | null;
  };
};

const projectOf = (row: FeedbackRow["projects"]): FeedbackProjectOption => ({
  id: row.id,
  reference: row.reference,
  name: row.name,
  clientId: row.client_id,
  clientName: row.clients?.name ?? null,
  hue: row.hue,
  logoUrl: row.logo_url,
});

export async function listFeedbackProjects(client: FeedbackClient, organizationId: string): Promise<FeedbackProjectOption[]> {
  const { data } = await client
    .from("projects")
    .select("id, reference, name, client_id, hue, logo_url, clients(name)")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });
  return ((data ?? []) as unknown as FeedbackRow["projects"][]).map(projectOf);
}

export async function listClientFeedback(client: FeedbackClient, organizationId: string): Promise<ClientFeedback[]> {
  const { data } = await client
    .from("client_feedback")
    .select("id, reference, title, prompt, status, rating, would_recommend, comment, respondent_name, submitted_at, created_at, share_token_version, projects(id, reference, name, client_id, hue, logo_url, clients(name))")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });
  return ((data ?? []) as unknown as FeedbackRow[]).map((row) => ({
    id: row.id,
    reference: row.reference,
    title: row.title,
    prompt: row.prompt,
    status: row.status,
    project: projectOf(row.projects),
    rating: row.rating,
    wouldRecommend: row.would_recommend,
    comment: row.comment,
    respondentName: row.respondent_name,
    submittedAt: row.submitted_at,
    createdAt: row.created_at,
    shareToken: shareToken("feedback", row.id, row.share_token_version),
  }));
}

export async function ensureClientFeedback(
  client: FeedbackClient,
  organizationId: string,
  userId: string,
  input: CreateFeedbackInput,
  options: { updateExisting?: boolean } = {},
): Promise<ServiceResult<{ feedback: ClientFeedback; created: boolean }>> {
  const { data: project } = await client
    .from("projects")
    .select("id, reference, name, client_id, hue, logo_url, clients(name)")
    .eq("organization_id", organizationId)
    .eq("id", input.projectId)
    .maybeSingle();
  if (!project) return { ok: false, error: "Projeto não encontrado." };

  const { data: existing } = await client
    .from("client_feedback")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("project_id", input.projectId)
    .maybeSingle();

  if (existing) {
    if (options.updateExisting !== false) {
      const { error } = await client
        .from("client_feedback")
        .update({ title: input.title, prompt: input.prompt })
        .eq("organization_id", organizationId)
        .eq("id", existing.id);
      if (error) return { ok: false, error: error.message };
    }
    const items = await listClientFeedback(client, organizationId);
    const feedback = items.find((item) => item.id === existing.id);
    return feedback ? { ok: true, data: { feedback, created: false } } : { ok: false, error: "Não foi possível carregar a avaliação." };
  }

  const id = crypto.randomUUID();
  const credentials = shareCredentials("feedback", id);
  const { error } = await client.from("client_feedback").insert({
    id,
    organization_id: organizationId,
    reference: "",
    project_id: input.projectId,
    client_id: project.client_id,
    title: input.title,
    prompt: input.prompt,
    share_token_hash: credentials.hash,
    created_by: userId,
  });
  if (error) return { ok: false, error: error.message };
  const items = await listClientFeedback(client, organizationId);
  const feedback = items.find((item) => item.id === id);
  return feedback ? { ok: true, data: { feedback, created: true } } : { ok: false, error: "Não foi possível carregar a avaliação." };
}

export async function getPublicClientFeedback(admin: FeedbackClient, token: string): Promise<PublicClientFeedback | null> {
  const { data } = await admin.rpc("client_feedback_by_token", { p_token_hash: shareTokenHash(token) });
  return data ? (data as unknown as PublicClientFeedback) : null;
}

export async function submitPublicClientFeedback(admin: FeedbackClient, token: string, input: SubmitFeedbackInput): Promise<ServiceResult<string>> {
  const { data, error } = await admin.rpc("submit_client_feedback", {
    p_token_hash: shareTokenHash(token),
    p_rating: input.rating,
    p_would_recommend: input.wouldRecommend,
    p_comment: input.comment,
    p_respondent_name: input.respondentName,
  });
  if (error || !data) return { ok: false, error: error?.message ?? "Não foi possível enviar a avaliação." };
  return { ok: true, data: (data as { feedbackId: string }).feedbackId };
}
