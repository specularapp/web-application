import { publicAnswersSchema } from "@/features/forms/schemas";
import { getPublicIntakeForm, submitPublicIntakeForm } from "@/features/forms/service";
import { readJson } from "@/lib/api/v1";
import { checkRateLimit, clientIp, rateLimitHeaders } from "@/lib/security/rate-limit";
import { isShareToken } from "@/lib/security/share-token";
import { createAdminClient } from "@/lib/supabase/server";

type Context = { params: Promise<{ token: string }> };

export async function GET(request: Request, { params }: Context) {
  const { token } = await params;
  if (!isShareToken(token)) return Response.json({ error: "Formulário não encontrado" }, { status: 404 });
  const limit = await checkRateLimit("publicLink", `form-api-load:${clientIp(request.headers)}`, crypto.randomUUID());
  if (!limit.allowed) return Response.json({ error: "Muitas tentativas" }, { status: 429, headers: rateLimitHeaders(limit) });
  const form = await getPublicIntakeForm(createAdminClient(), token);
  return form ? Response.json(form, { headers: rateLimitHeaders(limit) }) : Response.json({ error: "Formulário não encontrado" }, { status: 404 });
}

export async function POST(request: Request, { params }: Context) {
  const { token } = await params;
  if (!isShareToken(token)) return Response.json({ error: "Formulário não encontrado" }, { status: 404 });
  const limit = await checkRateLimit("publicForm", `form-api-submit:${token.slice(0, 12)}:${clientIp(request.headers)}`, crypto.randomUUID());
  if (!limit.allowed) return Response.json({ error: "Muitas tentativas" }, { status: 429, headers: rateLimitHeaders(limit) });
  const parsed = publicAnswersSchema.safeParse(await readJson(request));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message || "Respostas inválidas" }, { status: 400 });
  const result = await submitPublicIntakeForm(createAdminClient(), token, parsed.data);
  return result.ok ? Response.json(result.data, { headers: rateLimitHeaders(limit) }) : Response.json({ error: result.error }, { status: 400 });
}
