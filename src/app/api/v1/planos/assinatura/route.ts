import {
  confirmSubscriptionSchema,
  organizationScopeSchema,
  startSubscriptionSchema,
} from "@/features/billing/schemas";
import {
  cancelSubscription,
  confirmSubscription,
  resumeSubscription,
  startSubscription,
} from "@/features/billing/service";
import { authorizeRequest, invalidPayload, readJson } from "@/lib/api/v1";

export async function POST(request: Request) {
  const auth = await authorizeRequest(request, "billing-start", "billing");
  if ("response" in auth) return auth.response;

  const parsed = startSubscriptionSchema.safeParse(await readJson(request));
  if (!parsed.success) return invalidPayload();

  const email = typeof auth.session.claims.email === "string" ? auth.session.claims.email : null;
  const result = await startSubscription(auth.session.supabase, parsed.data, { email });

  if (!result.ok) return Response.json({ error: result.error }, { status: 400 });
  return Response.json(result.data);
}

export async function PATCH(request: Request) {
  const auth = await authorizeRequest(request, "billing-confirm", "billing");
  if ("response" in auth) return auth.response;

  const parsed = confirmSubscriptionSchema.safeParse(await readJson(request));
  if (!parsed.success) return invalidPayload();

  const result = await confirmSubscription(auth.session.supabase, parsed.data);
  if (!result.ok) return Response.json({ error: result.error }, { status: 400 });
  return Response.json(result.data);
}

export async function DELETE(request: Request) {
  const auth = await authorizeRequest(request, "billing-cancel", "billing");
  if ("response" in auth) return auth.response;

  const parsed = organizationScopeSchema.safeParse(await readJson(request));
  if (!parsed.success) return invalidPayload();

  const result = await cancelSubscription(auth.session.supabase, parsed.data.organizationId);
  if (!result.ok) return Response.json({ error: result.error }, { status: 400 });
  return Response.json(result.data);
}

// Retomar é recolocar em vigor a assinatura que estava marcada para cair no fim do período.
export async function PUT(request: Request) {
  const auth = await authorizeRequest(request, "billing-resume", "billing");
  if ("response" in auth) return auth.response;

  const parsed = organizationScopeSchema.safeParse(await readJson(request));
  if (!parsed.success) return invalidPayload();

  const result = await resumeSubscription(auth.session.supabase, parsed.data.organizationId);
  if (!result.ok) return Response.json({ error: result.error }, { status: 400 });
  return Response.json(result.data);
}
