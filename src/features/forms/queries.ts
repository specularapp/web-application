import "server-only";
import { requireOrganization } from "@/features/organizations/context";
import { getIntakeForm, listFormClients, listFormProjects, listIntakeForms, listIntakeFormSubmissions } from "./service";

export async function getFormsScreenData(next = "/formularios") {
  const { supabase, organizationId } = await requireOrganization(next);
  const [forms, projects, clients] = await Promise.all([
    listIntakeForms(supabase, organizationId),
    listFormProjects(supabase, organizationId),
    listFormClients(supabase, organizationId),
  ]);
  return { forms, projects, clients };
}

export async function getFormEditorData(id?: string, next = "/formularios/novo") {
  const { supabase, organizationId } = await requireOrganization(next);
  const [form, projects, clients] = await Promise.all([
    id ? getIntakeForm(supabase, organizationId, id) : Promise.resolve(null),
    listFormProjects(supabase, organizationId),
    listFormClients(supabase, organizationId),
  ]);
  return { form, projects, clients };
}

export async function getFormResponsesData(id: string, next = `/formularios/${id}/respostas`) {
  const { supabase, organizationId } = await requireOrganization(next);
  const [form, submissions] = await Promise.all([
    getIntakeForm(supabase, organizationId, id),
    listIntakeFormSubmissions(supabase, organizationId, id),
  ]);
  return { form, submissions };
}
