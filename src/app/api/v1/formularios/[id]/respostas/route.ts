import { listIntakeFormSubmissions } from "@/features/forms/service";
import { authorizeDomain } from "@/lib/api/domain";

export async function GET(request: Request, { params }: RouteContext<"/api/v1/formularios/[id]/respostas">) {
  const auth = await authorizeDomain(request, "forms-read");
  if ("response" in auth) return auth.response;
  const { id } = await params;
  return Response.json(await listIntakeFormSubmissions(auth.session.supabase, auth.session.organizationId, id));
}
