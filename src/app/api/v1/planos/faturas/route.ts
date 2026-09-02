import { listInvoices, resolveOrganization } from "@/features/billing/service";
import { authorizeRequest } from "@/lib/api/v1";

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, "billing-invoices", "billing");
  if ("response" in auth) return auth.response;

  const organizationId = await resolveOrganization(auth.session.supabase, auth.session.userId);
  if (!organizationId) return Response.json({ error: "Time não encontrado" }, { status: 404 });

  return Response.json(await listInvoices(auth.session.supabase, organizationId));
}
