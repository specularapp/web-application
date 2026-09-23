import { enableProjectTracking } from "@/features/projects/tracking";
import { authorizeDomain, fromMutation } from "@/lib/api/domain";
import { siteConfig } from "@/lib/metadata";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Context) {
  const auth = await authorizeDomain(request, "project-tracking-write");
  if ("response" in auth) return auth.response;
  const { id } = await params;
  const result = await enableProjectTracking(auth.session.supabase, auth.session.organizationId, id);
  if (!result.ok) return Response.json({ error: result.error }, { status: 400 });
  return fromMutation(
    { ok: true, data: { url: `${siteConfig.url}/acompanhar/${result.token}`, expiresAt: result.expiresAt } },
    auth.session.organizationId,
    ["projects"],
  );
}
