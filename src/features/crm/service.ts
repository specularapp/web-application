import "server-only";
import { format } from "date-fns";
import type { SupabaseClient } from "@supabase/supabase-js";
import { listTeamMembers } from "@/features/organizations/service";
import { slugify } from "@/lib/utils/slug";
import type { Database } from "@/types/database";
import type { CrmQuery } from "./list-options";
import type { OpportunityFormInput } from "./schemas";
import type { CrmStage } from "./stages";
import type {
  CrmPerson,
  Opportunity,
  OpportunityAttribution,
  OpportunitySource,
  OpportunityTemperature,
} from "./summary";
import type { CrmFunnel, CrmOpenCounts, CrmTreeNode, FunnelGlyph } from "./tree";

/** A regra do funil de vendas contra o banco, na mesma forma dos outros domínios. */
export type CrmClient = SupabaseClient<Database>;

export type ServiceResult<T> = { ok: true; data: T } | { ok: false; error: string };

const SAVE_FAILED = "Não foi possível salvar a oportunidade. Tente de novo em instantes.";

/** O quadro carrega as colunas inteiras, então o teto é o que protege a tela de uma base grande. */
const BOARD_LIMIT = 500;

const columns = `
  id, reference, funnel_id, title, description, client_id, client_name, client_company, client_avatar_url,
  contact_name, contact_email, contact_phone, stage, value, temperature, probability, city, state,
  expected_at, entered_at, closed_at, stage_since, first_response_minutes, average_response_minutes,
  owner_id, tags, source, attribution, partner_code, last_touch_at, next_step_label, next_step_at,
  attachments, activity,
  clients(reference),
  crm_funnels(name, reference, slug),
  quotes(id, reference),
  opportunity_people(user_id)
`;

type Row = {
  id: string;
  reference: string;
  funnel_id: string | null;
  title: string;
  description: string;
  client_id: string | null;
  client_name: string;
  client_company: string | null;
  client_avatar_url: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  stage: CrmStage;
  value: number;
  temperature: OpportunityTemperature;
  probability: number;
  city: string | null;
  state: string | null;
  expected_at: string | null;
  entered_at: string;
  closed_at: string | null;
  stage_since: string;
  first_response_minutes: number | null;
  average_response_minutes: number | null;
  owner_id: string | null;
  tags: string[];
  source: OpportunitySource;
  attribution: OpportunityAttribution;
  partner_code: string | null;
  last_touch_at: string | null;
  next_step_label: string | null;
  next_step_at: string | null;
  attachments: number;
  activity: number;
  clients: { reference: string } | null;
  crm_funnels: { name: string; reference: string; slug: string } | null;
  quotes: { id: string; reference: string } | null;
  opportunity_people: { user_id: string }[];
};

const NOBODY: CrmPerson = { name: "Sem responsável", avatarUrl: null };

const minute = (value: string) => value.slice(0, 16);

function toOpportunity(row: Row, people: Map<string, CrmPerson>): Opportunity {
  const owner = (row.owner_id && people.get(row.owner_id)) || NOBODY;
  const others = row.opportunity_people
    .map((entry) => people.get(entry.user_id))
    .filter((person): person is CrmPerson => Boolean(person) && person!.name !== owner.name);

  return {
    id: row.id,
    reference: row.reference,
    partnerCode: row.partner_code ?? undefined,
    title: row.title,
    description: row.description,
    client: {
      id: row.client_id ?? row.id,
      name: row.client_name,
      company: row.client_company ?? undefined,
      reference: row.clients?.reference,
      avatarUrl: row.client_avatar_url,
    },
    contact:
      row.contact_name || row.contact_email || row.contact_phone
        ? {
            name: row.contact_name ?? undefined,
            email: row.contact_email ?? undefined,
            phone: row.contact_phone ?? undefined,
          }
        : undefined,
    funnel: row.crm_funnels
      ? { name: row.crm_funnels.name, reference: row.crm_funnels.reference, slug: row.crm_funnels.slug }
      : null,
    stage: row.stage,
    value: row.value,
    temperature: row.temperature,
    probability: row.probability,
    city: row.city ?? undefined,
    state: row.state ?? undefined,
    expectedAt: row.expected_at ?? row.entered_at.slice(0, 10),
    enteredAt: minute(row.entered_at),
    closedAt: row.closed_at ? minute(row.closed_at) : undefined,
    stageSince: minute(row.stage_since),
    firstResponseMinutes: row.first_response_minutes ?? undefined,
    averageResponseMinutes: row.average_response_minutes ?? undefined,
    owner,
    people: [owner, ...others],
    tags: row.tags,
    source: row.source,
    attribution: Object.keys(row.attribution ?? {}).length > 0 ? row.attribution : undefined,
    lastTouchAt: row.last_touch_at ?? row.entered_at.slice(0, 10),
    nextStep: row.next_step_label && row.next_step_at ? { label: row.next_step_label, at: row.next_step_at } : undefined,
    quote: row.quotes ? { id: row.quotes.id, reference: row.quotes.reference } : undefined,
    attachments: row.attachments,
    activity: row.activity,
  };
}

async function peopleOf(client: CrmClient, organizationId: string) {
  const members = await listTeamMembers(client, organizationId);
  return new Map<string, CrmPerson>(
    members.map((member) => [member.userId, { name: member.name || member.email || "Equipe", avatarUrl: member.avatarUrl }]),
  );
}

/**
 * As oportunidades que o quadro desenha. Temperatura, previsão e funil viram condição de SQL; a busca e o
 * "parado" continuam onde já estavam, em `buildCrmBoard`, porque as duas dependem de contas que o quadro já
 * faz (e "parado" mistura etapa aberta com dias sem contato). O teto protege a tela de uma base grande: o
 * quadro é kanban e carrega coluna inteira.
 */
export async function listOpportunities(
  client: CrmClient,
  organizationId: string,
  query: CrmQuery,
  funnel?: CrmFunnel,
): Promise<Opportunity[]> {
  let builder = client.from("opportunities").select(columns).eq("organization_id", organizationId);

  if (funnel) {
    if (funnel.reference === null) builder = builder.is("funnel_id", null);
    else builder = builder.eq("funnel_id", funnel.id);
  }
  if (query.temperature !== "todas") builder = builder.eq("temperature", query.temperature);
  if (query.horizon !== "sempre") {
    const limit = new Date();
    limit.setDate(limit.getDate() + Number(query.horizon));
    builder = builder.lte("expected_at", format(limit, "yyyy-MM-dd"));
  }

  const [{ data }, people] = await Promise.all([
    builder.order("stage_since", { ascending: false }).limit(BOARD_LIMIT),
    peopleOf(client, organizationId),
  ]);

  return ((data ?? []) as unknown as Row[]).map((row) => toOpportunity(row, people));
}

export async function getOpportunity(
  client: CrmClient,
  organizationId: string,
  id: string,
): Promise<Opportunity | null> {
  const [{ data }, people] = await Promise.all([
    client.from("opportunities").select(columns).eq("organization_id", organizationId).eq("id", id).maybeSingle(),
    peopleOf(client, organizationId),
  ]);

  if (!data) return null;
  return toOpportunity(data as unknown as Row, people);
}

/** A equipe que o quadro mostra nos seletores de responsável. */
export async function listCrmPeople(client: CrmClient, organizationId: string): Promise<CrmPerson[]> {
  const people = await peopleOf(client, organizationId);
  return [...people.values()];
}

/**
 * A arquitetura do menu do CRM: as pastas com os funis nas folhas, mais o balde de quem ainda não foi para
 * funil nenhum. O balde é o funil de identificador nulo, e existe sempre, para lead solto ter lugar.
 */
export async function getCrmTree(client: CrmClient, organizationId: string): Promise<CrmTreeNode[]> {
  const [folders, funnels, loose] = await Promise.all([
    client.from("crm_folders").select("id, parent_id, name, position").eq("organization_id", organizationId).order("position"),
    client
      .from("crm_funnels")
      .select("id, slug, name, reference, stages, glyph, hue, folder_id")
      .eq("organization_id", organizationId)
      .order("position"),
    client.from("opportunities").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).is("funnel_id", null),
  ]);

  const leaves = new Map<string | null, CrmTreeNode[]>();
  for (const funnel of funnels.data ?? []) {
    const list = leaves.get(funnel.folder_id) ?? [];
    list.push({
      kind: "funnel",
      id: funnel.id,
      slug: funnel.slug,
      name: funnel.name,
      reference: funnel.reference,
      stages: funnel.stages as CrmStage[],
      glyph: funnel.glyph as FunnelGlyph,
      hue: `var(--sys-${funnel.hue})`,
    });
    leaves.set(funnel.folder_id, list);
  }

  const children = (parentId: string | null): CrmTreeNode[] => [
    ...(folders.data ?? [])
      .filter((folder) => folder.parent_id === parentId)
      .map((folder) => ({ kind: "folder" as const, id: folder.id, name: folder.name, children: children(folder.id) })),
    ...(leaves.get(parentId) ?? []),
  ];

  const tree = children(null);

  /* O balde só aparece quando há lead sem funil: uma pasta vazia no menu seria ruído em toda conta nova. */
  if ((loose.count ?? 0) > 0) {
    tree.push({
      kind: "funnel",
      id: "sem-funil",
      slug: "sem-funil",
      name: "Sem funil",
      reference: null,
      stages: ["lead", "contact", "proposal", "negotiation", "won", "lost"],
      glyph: "tray",
      hue: "var(--sys-gray)",
    });
  }

  return tree;
}

export async function saveOpportunity(
  client: CrmClient,
  organizationId: string,
  input: OpportunityFormInput,
): Promise<ServiceResult<{ id: string }>> {
  const closing = input.stage === "won" || input.stage === "lost";

  const values = {
    organization_id: organizationId,
    funnel_id: input.funnelId,
    title: input.title,
    description: input.description,
    client_id: input.clientId,
    client_name: input.clientName,
    client_company: input.clientCompany || null,
    contact_name: input.contactName || null,
    contact_email: input.contactEmail ? input.contactEmail.toLowerCase() : null,
    contact_phone: input.contactPhone || null,
    stage: input.stage,
    value: input.value,
    temperature: input.temperature,
    probability: input.probability,
    city: input.city || null,
    state: input.state || null,
    expected_at: input.expectedAt || null,
    owner_id: input.ownerId,
    tags: input.tags,
    source: input.source,
    partner_code: input.partnerCode || null,
    next_step_label: input.nextStepLabel || null,
    next_step_at: input.nextStepAt || null,
    closed_at: closing ? new Date().toISOString() : null,
  };

  if (input.id) {
    const { data, error } = await client
      .from("opportunities")
      .update(values)
      .eq("id", input.id)
      .eq("organization_id", organizationId)
      .select("id")
      .maybeSingle();

    if (error || !data) return { ok: false, error: error?.message || SAVE_FAILED };
    return { ok: true, data: { id: data.id } };
  }

  const { data, error } = await client.from("opportunities").insert(values).select("id").single();
  if (error || !data) return { ok: false, error: error?.message || SAVE_FAILED };
  return { ok: true, data: { id: data.id } };
}

/** Mover o cartão de coluna: a única escrita que o quadro faz ao arrastar. */
export async function moveOpportunity(
  client: CrmClient,
  organizationId: string,
  id: string,
  stage: CrmStage,
): Promise<ServiceResult<undefined>> {
  const closing = stage === "won" || stage === "lost";
  const { error } = await client
    .from("opportunities")
    .update({ stage, closed_at: closing ? new Date().toISOString() : null, last_touch_at: format(new Date(), "yyyy-MM-dd") })
    .eq("id", id)
    .eq("organization_id", organizationId);

  if (error) return { ok: false, error: error.message };
  return { ok: true, data: undefined };
}

export async function deleteOpportunity(
  client: CrmClient,
  organizationId: string,
  id: string,
): Promise<ServiceResult<undefined>> {
  const { error } = await client.from("opportunities").delete().eq("organization_id", organizationId).eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: undefined };
}

/** O endereço do quadro de um funil não repete, como o do projeto. */
export async function uniqueFunnelSlug(client: CrmClient, organizationId: string, name: string) {
  const base = slugify(name, 60) || "funil";
  const { data } = await client.from("crm_funnels").select("slug").eq("organization_id", organizationId).like("slug", `${base}%`);
  const taken = new Set((data ?? []).map((row) => row.slug));
  if (!taken.has(base)) return base;

  let suffix = 2;
  while (taken.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

/** Quantas oportunidades em aberto cada funil tem, contadas no banco, pelo mesmo motivo das tarefas. */
export async function getCrmOpenCounts(client: CrmClient, organizationId: string): Promise<CrmOpenCounts> {
  const { data } = await client.rpc("opportunity_open_counts", { p_organization_id: organizationId });

  const byFunnel: Record<string, number> = {};
  let loose = 0;
  for (const row of data ?? []) {
    if (row.funnel_id) byFunnel[row.funnel_id] = row.total;
    else loose += row.total;
  }

  return { byFunnel, loose };
}
