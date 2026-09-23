import "server-only";
import { requireOrganization } from "@/features/organizations/context";
import { listClientFeedback, listFeedbackProjects } from "./service";

export async function getFeedbacksScreenData(next = "/feedbacks") {
  const { supabase, organizationId } = await requireOrganization(next);
  const [feedbacks, projects] = await Promise.all([
    listClientFeedback(supabase, organizationId),
    listFeedbackProjects(supabase, organizationId),
  ]);
  return { feedbacks, projects };
}
