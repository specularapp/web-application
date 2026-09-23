import "server-only";
import { requireOrganization } from "@/features/organizations/context";
import { getApproval, listApprovalProjects, listApprovals } from "./service";

export async function getApprovalsScreenData(next = "/aprovacoes") {
  const { supabase, organizationId } = await requireOrganization(next);
  const [approvals, projects] = await Promise.all([listApprovals(supabase, organizationId), listApprovalProjects(supabase, organizationId)]);
  return { approvals, projects };
}

export async function getApprovalScreenData(id: string, next = `/aprovacoes/${id}`) {
  const { supabase, organizationId } = await requireOrganization(next);
  return getApproval(supabase, organizationId, id);
}
