import { confirmPaymentMethodSchema, organizationScopeSchema } from "@/features/billing/schemas";
import { confirmPaymentMethod, startPaymentMethodUpdate } from "@/features/billing/service";
import { authorizeRequest, invalidPayload, readJson } from "@/lib/api/v1";

export async function POST(request: Request) {
  const auth = await authorizeRequest(request, "billing-card", "billing");
  if ("response" in auth) return auth.response;

  const parsed = organizationScopeSchema.safeParse(await readJson(request));
  if (!parsed.success) return invalidPayload();

  const result = await startPaymentMethodUpdate(auth.session.supabase, parsed.data.organizationId);
  if (!result.ok) return Response.json({ error: result.error }, { status: 400 });
  return Response.json(result.data);
}

export async function PATCH(request: Request) {
  const auth = await authorizeRequest(request, "billing-card-confirm", "billing");
  if ("response" in auth) return auth.response;

  const parsed = confirmPaymentMethodSchema.safeParse(await readJson(request));
  if (!parsed.success) return invalidPayload();

  const result = await confirmPaymentMethod(auth.session.supabase, parsed.data);
  if (!result.ok) return Response.json({ error: result.error }, { status: 400 });
  return Response.json(result.data);
}
