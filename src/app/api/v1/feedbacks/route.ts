import { createFeedbackSchema } from "@/features/feedbacks/schemas";
import { ensureClientFeedback, listClientFeedback } from "@/features/feedbacks/service";
import { authorizeDomain, fromMutation, readPayload } from "@/lib/api/domain";

export async function GET(request: Request) {
  const auth = await authorizeDomain(request, "feedbacks-read");
  if ("response" in auth) return auth.response;
  return Response.json(await listClientFeedback(auth.session.supabase, auth.session.organizationId));
}

export async function POST(request: Request) {
  const auth = await authorizeDomain(request, "feedbacks-write");
  if ("response" in auth) return auth.response;
  const body = await readPayload(request, createFeedbackSchema);
  if ("response" in body) return body.response;
  return fromMutation(await ensureClientFeedback(auth.session.supabase, auth.session.organizationId, auth.session.userId, body.data), auth.session.organizationId, ["feedbacks"]);
}
