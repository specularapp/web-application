import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { shareCredentials, shareTokenHash } from "@/lib/security/share-token";
import type { Database } from "@/types/database";
import type { TaskStageGlyph, TaskStageKind } from "@/features/tasks/stages";
import type { ProjectStatus } from "./summary";

type ProjectsClient = SupabaseClient<Database>;

export type PublicProjectTracking = {
  project: {
    reference: string;
    name: string;
    description: string;
    status: ProjectStatus;
    progress: number;
    startedAt: string;
    dueAt: string | null;
    updatedAt: string;
    coverUrl: string | null;
    logoUrl: string | null;
    hue: string;
    clientName: string | null;
  };
  organization: {
    name: string;
    logoUrl: string | null;
    website: string | null;
    email: string | null;
    phone: string | null;
    city: string | null;
    state: string | null;
  };
  stages: {
    name: string;
    hue: string;
    glyph: TaskStageGlyph;
    kind: TaskStageKind;
    position: number;
    taskCount: number;
  }[];
};

export async function enableProjectTracking(client: ProjectsClient, organizationId: string, id: string) {
  const { data } = await client
    .from("projects")
    .select("tracking_token_version")
    .eq("organization_id", organizationId)
    .eq("id", id)
    .maybeSingle();
  if (!data) return { ok: false as const, error: "Projeto não encontrado." };

  const { token, hash } = shareCredentials("project", id, data.tracking_token_version);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 180);
  const { error } = await client
    .from("projects")
    .update({ tracking_token_hash: hash, tracking_expires_at: expiresAt.toISOString() })
    .eq("organization_id", organizationId)
    .eq("id", id);
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const, token, expiresAt: expiresAt.toISOString() };
}

export async function getProjectTracking(admin: ProjectsClient, token: string): Promise<PublicProjectTracking | null> {
  const { data } = await admin.rpc("project_tracking_by_token", { p_token_hash: shareTokenHash(token) });
  return data ? (data as unknown as PublicProjectTracking) : null;
}

export async function markProjectTrackingViewed(admin: ProjectsClient, token: string) {
  await admin.rpc("mark_project_tracking_viewed", { p_token_hash: shareTokenHash(token) });
}
