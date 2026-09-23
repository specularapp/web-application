import "server-only";
import { isValid, parseISO } from "date-fns";
import { dbMessage } from "@/lib/db/message";
import type { SupabaseClient } from "@supabase/supabase-js";
import { shareCredentials, shareToken, shareTokenHash } from "@/lib/security/share-token";
import type { Database, Json } from "@/types/database";
import type { IntakeFormInput, PublicAnswersInput } from "./schemas";
import type {
  IntakeForm,
  IntakeFormClient,
  IntakeFormListItem,
  IntakeFormProject,
  IntakeFormSubmission,
  IntakeQuestion,
  PublicIntakeForm,
} from "./summary";

export type FormsClient = SupabaseClient<Database>;
export type ServiceResult<T> = { ok: true; data: T } | { ok: false; error: string };

const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && isValid(parseISO(value));
const validWebsite = (value: string) => {
  try {
    const parsed = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    return parsed.hostname.includes(".");
  } catch {
    return false;
  }
};

const columns = `
  id, reference, project_id, client_id, title, description, status, submit_label, success_title,
  success_message, consent_text, expires_at, published_at, created_at, updated_at, share_token_version,
  projects!inner(id, name, reference, logo_url, cover_url, hue),
  clients(id, name, email, avatar_url),
  intake_form_submissions(count)
`;

type FormRow = {
  id: string;
  reference: string;
  project_id: string;
  client_id: string | null;
  title: string;
  description: string;
  status: IntakeForm["status"];
  submit_label: string;
  success_title: string;
  success_message: string;
  consent_text: string;
  expires_at: string;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  share_token_version: number;
  projects: { id: string; name: string; reference: string; logo_url: string | null; cover_url: string | null; hue: string };
  clients: { id: string; name: string; email: string | null; avatar_url: string | null } | null;
  intake_form_submissions: { count: number }[];
};

type QuestionRow = {
  id: string;
  type: IntakeQuestion["type"];
  profile_field: IntakeQuestion["profileField"];
  label: string;
  description: string;
  placeholder: string;
  required: boolean;
  options: Json;
  page: number;
  position: number;
};

function projectOf(row: FormRow): IntakeFormProject {
  return {
    id: row.projects.id,
    name: row.projects.name,
    reference: row.projects.reference,
    logoUrl: row.projects.logo_url,
    coverUrl: row.projects.cover_url,
    hue: row.projects.hue,
  };
}

function clientOf(row: FormRow): IntakeFormClient | null {
  return row.clients
    ? { id: row.clients.id, name: row.clients.name, email: row.clients.email, avatarUrl: row.clients.avatar_url }
    : null;
}

function questionOf(row: QuestionRow): IntakeQuestion {
  return {
    id: row.id,
    type: row.type,
    profileField: row.profile_field,
    label: row.label,
    description: row.description,
    placeholder: row.placeholder,
    required: row.required,
    options: Array.isArray(row.options) ? row.options.filter((option): option is string => typeof option === "string") : [],
    page: row.page,
    position: row.position,
  };
}

function baseOf(row: FormRow): IntakeFormListItem {
  return {
    id: row.id,
    reference: row.reference,
    project: projectOf(row),
    client: clientOf(row),
    title: row.title,
    description: row.description,
    status: row.status,
    expiresAt: row.expires_at,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    responseCount: row.intake_form_submissions[0]?.count ?? 0,
    shareToken: shareToken("form", row.id, row.share_token_version),
  };
}

export async function listIntakeForms(client: FormsClient, organizationId: string): Promise<IntakeFormListItem[]> {
  const { data } = await client
    .from("intake_forms")
    .select(columns)
    .eq("organization_id", organizationId)
    .order("updated_at", { ascending: false });

  return ((data ?? []) as unknown as FormRow[]).map(baseOf);
}

export async function getIntakeForm(client: FormsClient, organizationId: string, id: string): Promise<IntakeForm | null> {
  const [{ data }, questions] = await Promise.all([
    client.from("intake_forms").select(columns).eq("organization_id", organizationId).eq("id", id).maybeSingle(),
    client
      .from("intake_form_questions")
      .select("id, type, profile_field, label, description, placeholder, required, options, page, position")
      .eq("organization_id", organizationId)
      .eq("form_id", id)
      .order("position"),
  ]);
  if (!data) return null;
  const row = data as unknown as FormRow;

  return {
    ...baseOf(row),
    submitLabel: row.submit_label,
    successTitle: row.success_title,
    successMessage: row.success_message,
    consentText: row.consent_text,
    questions: ((questions.data ?? []) as QuestionRow[]).map(questionOf),
  };
}

export async function listFormProjects(client: FormsClient, organizationId: string): Promise<IntakeFormProject[]> {
  const { data } = await client
    .from("projects")
    .select("id, name, reference, logo_url, cover_url, hue")
    .eq("organization_id", organizationId)
    .order("name");
  return (data ?? []).map((project) => ({
    id: project.id,
    name: project.name,
    reference: project.reference,
    logoUrl: project.logo_url,
    coverUrl: project.cover_url,
    hue: project.hue,
  }));
}

export async function listFormClients(client: FormsClient, organizationId: string): Promise<IntakeFormClient[]> {
  const { data } = await client
    .from("clients")
    .select("id, name, email, avatar_url")
    .eq("organization_id", organizationId)
    .in("kind", ["customer", "both"])
    .eq("active", true)
    .order("name");
  return (data ?? []).map((entry) => ({ id: entry.id, name: entry.name, email: entry.email, avatarUrl: entry.avatar_url }));
}

export async function saveIntakeForm(
  client: FormsClient,
  organizationId: string,
  userId: string,
  input: IntakeFormInput,
): Promise<ServiceResult<{ id: string; token: string }>> {
  const id = input.id ?? crypto.randomUUID();
  const existing = input.id
    ? await client.from("intake_forms").select("share_token_version, published_at").eq("organization_id", organizationId).eq("id", id).maybeSingle()
    : null;
  if (input.id && !existing?.data) return { ok: false, error: "Formulário não encontrado." };

  const version = existing?.data?.share_token_version ?? 1;
  const credentials = shareCredentials("form", id, version);
  const values = {
    organization_id: organizationId,
    project_id: input.projectId,
    client_id: input.clientId,
    title: input.title,
    description: input.description,
    status: input.status,
    submit_label: input.submitLabel,
    success_title: input.successTitle,
    success_message: input.successMessage,
    consent_text: input.consentText,
    expires_at: input.expiresAt,
    published_at: input.status === "published" ? existing?.data?.published_at ?? new Date().toISOString() : null,
    closed_at: input.status === "closed" ? new Date().toISOString() : null,
  };

  if (input.id) {
    const { error } = await client.from("intake_forms").update(values).eq("organization_id", organizationId).eq("id", id);
    if (error) return { ok: false, error: dbMessage(error, "Não foi possível concluir a operação. Tente de novo em instantes.") };
  } else {
    const { error } = await client.from("intake_forms").insert({
      ...values,
      id,
      reference: "",
      share_token_hash: credentials.hash,
      share_token_version: version,
      created_by: userId,
    });
    if (error) return { ok: false, error: dbMessage(error, "Não foi possível concluir a operação. Tente de novo em instantes.") };
  }

  const { error: removed } = await client
    .from("intake_form_questions")
    .delete()
    .eq("organization_id", organizationId)
    .eq("form_id", id);
  if (removed) return { ok: false, error: removed.message };

  const { error: questionsError } = await client.from("intake_form_questions").insert(
    input.questions.map((question, position) => ({
      id: question.id ?? crypto.randomUUID(),
      organization_id: organizationId,
      form_id: id,
      type: question.type,
      profile_field: question.profileField,
      label: question.label,
      description: question.description,
      placeholder: question.placeholder,
      required: question.required,
      options: question.options,
      page: question.page,
      position,
    })),
  );
  if (questionsError) return { ok: false, error: questionsError.message };

  return { ok: true, data: { id, token: credentials.token } };
}

export async function deleteIntakeForm(client: FormsClient, organizationId: string, id: string): Promise<ServiceResult<undefined>> {
  const { error } = await client.from("intake_forms").delete().eq("organization_id", organizationId).eq("id", id);
  return error ? { ok: false, error: dbMessage(error, "Não foi possível concluir a operação. Tente de novo em instantes.") } : { ok: true, data: undefined };
}

type SubmissionRow = {
  id: string;
  answers: Json;
  respondent_name: string | null;
  respondent_email: string | null;
  respondent_phone: string | null;
  consent_text: string;
  consented_at: string;
  created_at: string;
  clients: { id: string; name: string; email: string | null; avatar_url: string | null } | null;
};

const answersOf = (value: Json): Record<string, string | string[]> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string | string[]] =>
      typeof entry[1] === "string" || (Array.isArray(entry[1]) && entry[1].every((item) => typeof item === "string")),
    ),
  );
};

export async function listIntakeFormSubmissions(
  client: FormsClient,
  organizationId: string,
  formId: string,
): Promise<IntakeFormSubmission[]> {
  const { data } = await client
    .from("intake_form_submissions")
    .select("id, answers, respondent_name, respondent_email, respondent_phone, consent_text, consented_at, created_at, clients(id, name, email, avatar_url)")
    .eq("organization_id", organizationId)
    .eq("form_id", formId)
    .order("created_at", { ascending: false });

  return ((data ?? []) as unknown as SubmissionRow[]).map((row) => ({
    id: row.id,
    client: row.clients
      ? { id: row.clients.id, name: row.clients.name, email: row.clients.email, avatarUrl: row.clients.avatar_url }
      : null,
    respondentName: row.respondent_name,
    respondentEmail: row.respondent_email,
    respondentPhone: row.respondent_phone,
    answers: answersOf(row.answers),
    consentText: row.consent_text,
    consentedAt: row.consented_at,
    createdAt: row.created_at,
  }));
}

export async function getPublicIntakeForm(admin: FormsClient, token: string): Promise<PublicIntakeForm | null> {
  const { data } = await admin.rpc("intake_form_by_token", { p_token_hash: shareTokenHash(token) });
  if (!data) return null;
  return data as unknown as PublicIntakeForm;
}

function cleanPublicAnswers(form: PublicIntakeForm, input: PublicAnswersInput): ServiceResult<Record<string, string | string[]>> {
  const answers: Record<string, string | string[]> = {};
  for (const question of form.questions) {
    const raw = input.answers[question.id];
    const empty = raw === undefined || raw === "" || (Array.isArray(raw) && raw.length === 0);
    if (question.required && empty) return { ok: false, error: `Responda: ${question.label}` };
    if (empty) continue;

    if (question.type === "multiple_choice") {
      if (!Array.isArray(raw) || raw.some((value) => !question.options.includes(value))) {
        return { ok: false, error: `Confira: ${question.label}` };
      }
      answers[question.id] = raw;
      continue;
    }
    if (Array.isArray(raw)) return { ok: false, error: `Confira: ${question.label}` };
    const value = raw.trim();
    if (question.type === "short_text" && value.length > 160) return { ok: false, error: `Resuma a resposta em: ${question.label}` };
    if (question.type === "long_text" && value.length > 5000) return { ok: false, error: `Resuma a resposta em: ${question.label}` };
    if (question.type === "email" && (value.length > 120 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value))) return { ok: false, error: "Informe um e-mail válido." };
    if (question.type === "phone") {
      const digits = value.replace(/\D/g, "");
      if (digits.length < 10 || digits.length > 11) return { ok: false, error: "Informe um telefone com DDD." };
      answers[question.id] = digits;
      continue;
    }
    if (question.type === "single_choice" && !question.options.includes(value)) return { ok: false, error: `Escolha uma opção em: ${question.label}` };
    if (question.type === "date" && !validDate(value)) return { ok: false, error: `Informe uma data válida em: ${question.label}` };
    if (question.profileField === "name" && (value.length < 2 || value.length > 80)) return { ok: false, error: "Informe o nome completo." };
    if (["company", "role", "city"].includes(question.profileField ?? "") && value.length > 80) return { ok: false, error: `Resuma a resposta em: ${question.label}` };
    if (question.profileField === "website" && (value.length > 120 || !validWebsite(value))) return { ok: false, error: "Informe um site válido." };
    if (question.profileField === "about" && value.length > 1000) return { ok: false, error: `Resuma a resposta em: ${question.label}` };
    answers[question.id] = value;
  }
  return { ok: true, data: answers };
}

export async function submitPublicIntakeForm(
  admin: FormsClient,
  token: string,
  input: PublicAnswersInput,
): Promise<ServiceResult<{ submissionId: string; organizationId: string }>> {
  const form = await getPublicIntakeForm(admin, token);
  if (!form) return { ok: false, error: "Este formulário não está mais disponível." };
  const cleaned = cleanPublicAnswers(form, input);
  if (!cleaned.ok) return cleaned;

  const { data, error } = await admin.rpc("submit_intake_form", {
    p_token_hash: shareTokenHash(token),
    p_answers: cleaned.data,
    p_consent: input.consent,
  });
  if (error || !data) return { ok: false, error: dbMessage(error, "Não foi possível enviar as respostas.") };
  const result = data as { submissionId: string; organizationId: string };
  return { ok: true, data: result };
}
