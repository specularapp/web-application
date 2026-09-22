import "server-only";
import { format } from "date-fns";
import type { SupabaseClient } from "@supabase/supabase-js";
import { listTeamMembers } from "@/features/organizations/service";
import { slugify } from "@/lib/utils/slug";
import { diffFields, logRecordEvent, summarize } from "@/features/records/history";
import type { Database, Json } from "@/types/database";
import type { CrmQuery } from "./list-options";
import type { OpportunityFormInput, ConfigureFunnelStagesInput } from "./schemas";
import { crmStageValues, defaultCrmStages, defaultStageDefinition, stageKind, type CrmStage, type CrmStageDefinition, type CrmHue } from "./stages";
import type {
  CrmPerson,
  CrmClientOption,
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

const NOBODY: CrmPerson = { id: "", name: "Sem responsável", avatarUrl: null };

const minute = (value: string) => value.slice(0, 16);

function toOpportunity(row: Row, people: Map<string, CrmPerson>, definitions: CrmStageDefinition[]): Opportunity {
  const owner = (row.owner_id && people.get(row.owner_id)) || NOBODY;
  const others = row.opportunity_people
    .map((entry) => people.get(entry.user_id))
    .filter((person): person is CrmPerson => Boolean(person) && person!.id !== owner.id);

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
    stageLabel: definitions.find((entry) => entry.id === row.stage)?.label ?? defaultStageDefinition(row.stage).label,
    value: row.value,
    temperature: row.temperature,
    probability: row.probability,
    city: row.city ?? undefined,
    state: row.state ?? undefined,
    expectedAt: row.expected_at ?? "",
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
    lastTouchAt: row.last_touch_at ?? "",
    nextStep: row.next_step_label && row.next_step_at ? { label: row.next_step_label, at: row.next_step_at } : undefined,
    quote: row.quotes ? { id: row.quotes.id, reference: row.quotes.reference } : undefined,
    attachments: row.attachments,
    activity: row.activity,
  };
}

async function peopleOf(client: CrmClient, organizationId: string) {
  const members = await listTeamMembers(client, organizationId);
  return new Map<string, CrmPerson>(
    members.map((member) => [member.userId, { id: member.userId, name: member.name || member.email || "Equipe", avatarUrl: member.avatarUrl }]),
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

  const [{ data }, people, definitions] = await Promise.all([
    builder.order("stage_since", { ascending: false }).limit(BOARD_LIMIT),
    peopleOf(client, organizationId),
    listStageDefinitions(client, organizationId),
  ]);

  return ((data ?? []) as unknown as Row[]).map((row) => toOpportunity(row, people, definitions));
}

export async function getOpportunity(
  client: CrmClient,
  organizationId: string,
  id: string,
): Promise<Opportunity | null> {
  if (!/^OPO-\d{4}-\d+$/i.test(id) && !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id)) return null;
  const [{ data }, people, definitions] = await Promise.all([
    client.from("opportunities").select(columns).eq("organization_id", organizationId).eq(/^OPO-/i.test(id) ? "reference" : "id", id.toUpperCase().startsWith("OPO-") ? id.toUpperCase() : id).maybeSingle(),
    peopleOf(client, organizationId),
    listStageDefinitions(client, organizationId),
  ]);

  if (!data) return null;
  return toOpportunity(data as unknown as Row, people, definitions);
}

/** A equipe que o quadro mostra nos seletores de responsável. */
export async function listCrmPeople(client: CrmClient, organizationId: string): Promise<CrmPerson[]> {
  const people = await peopleOf(client, organizationId);
  return [...people.values()];
}

/** Clientes ativos que podem ser vinculados à venda; fornecedores puros não entram no funil comercial. */
export async function listCrmClients(client: CrmClient, organizationId: string): Promise<CrmClientOption[]> {
  const { data } = await client
    .from("clients")
    .select("id, name, company, email, phone, city, avatar_url")
    .eq("organization_id", organizationId)
    .eq("active", true)
    .in("kind", ["customer", "both"])
    .order("name")
    .limit(500);

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    company: row.company ?? undefined,
    email: row.email ?? undefined,
    phone: row.phone ?? undefined,
    city: row.city ?? undefined,
    avatarUrl: row.avatar_url,
  }));
}

/**
 * A arquitetura do menu do CRM: as pastas com os funis nas folhas, mais o balde de quem ainda não foi para
 * funil nenhum. O balde é o funil de identificador nulo, e existe sempre, para lead solto ter lugar.
 */
export async function getCrmTree(client: CrmClient, organizationId: string): Promise<CrmTreeNode[]> {
  const [folders, funnels, loose, definitions] = await Promise.all([
    client.from("crm_folders").select("id, parent_id, name, position, hue").eq("organization_id", organizationId).order("position"),
    client
      .from("crm_funnels")
      .select("id, slug, name, reference, stages, glyph, hue, folder_id")
      .eq("organization_id", organizationId)
      .order("position"),
    client.from("opportunities").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).is("funnel_id", null),
    listStageDefinitions(client, organizationId),
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
      stageDefinitions: funnel.stages.map((id) => definitions.find((entry) => entry.id === id) ?? defaultStageDefinition(id)),
      glyph: funnel.glyph as FunnelGlyph,
      hue: `var(--sys-${funnel.hue})`,
    });
    leaves.set(funnel.folder_id, list);
  }

  const children = (parentId: string | null): CrmTreeNode[] => [
    ...(folders.data ?? [])
      .filter((folder) => folder.parent_id === parentId)
      .map((folder) => ({ kind: "folder" as const, id: folder.id, name: folder.name, hue: `var(--sys-${folder.hue})`, children: children(folder.id) })),
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
      stages: [...defaultCrmStages, ...definitions.map((entry) => entry.id)],
      stageDefinitions: definitions,
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
): Promise<ServiceResult<Opportunity>> {
  const closing = stageKind(input.stage) !== "open";

  const [members, selectedClient, funnel] = await Promise.all([
    listTeamMembers(client, organizationId),
    input.clientId
      ? client.from("clients").select("id, name, company, email, phone, city, avatar_url").eq("organization_id", organizationId).eq("id", input.clientId).in("kind", ["customer", "both"]).maybeSingle()
      : Promise.resolve({ data: null }),
    input.funnelId
      ? client.from("crm_funnels").select("id, stages").eq("organization_id", organizationId).eq("id", input.funnelId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  if (input.clientId && !selectedClient.data) return { ok: false, error: "O cliente escolhido não está disponível." };
  if (input.funnelId && !funnel.data) return { ok: false, error: "O funil escolhido não está disponível." };
  if (funnel.data && !(funnel.data.stages as string[]).includes(input.stage)) return { ok: false, error: "A etapa não pertence ao funil escolhido." };
  const memberIds = new Set(members.map((member) => member.userId));
  if (input.ownerId && !memberIds.has(input.ownerId)) return { ok: false, error: "O responsável não faz parte desta equipe." };
  if (input.peopleIds.some((id) => !memberIds.has(id))) return { ok: false, error: "Um dos envolvidos não faz parte desta equipe." };
  const linked = selectedClient.data;

  const cleanObject = <T extends Record<string, unknown>>(object: T) =>
    Object.fromEntries(Object.entries(object).filter(([, value]) => value !== "" && value !== undefined));
  const attribution = cleanObject({ ...input.attribution, utm: cleanObject(input.attribution.utm) });
  if (Object.keys(attribution.utm as object).length === 0) delete attribution.utm;

  const values = {
    organization_id: organizationId,
    funnel_id: input.funnelId,
    title: input.title,
    description: input.description,
    client_id: input.clientId,
    client_name: linked?.name ?? input.clientName,
    client_company: (linked?.company ?? input.clientCompany) || null,
    client_avatar_url: linked?.avatar_url ?? null,
    contact_name: input.contactName || null,
    contact_email: (input.contactEmail || linked?.email)?.toLowerCase() || null,
    contact_phone: input.contactPhone || linked?.phone || null,
    stage: input.stage,
    value: input.value,
    temperature: input.temperature,
    probability: input.probability,
    city: input.city || linked?.city || null,
    state: input.state || null,
    expected_at: input.expectedAt || null,
    owner_id: input.ownerId,
    tags: input.tags,
    source: input.source,
    partner_code: input.partnerCode || null,
    attribution: attribution as Json,
    last_touch_at: input.lastTouchAt || null,
    first_response_minutes: input.firstResponseMinutes,
    average_response_minutes: input.averageResponseMinutes,
    next_step_label: input.nextStepLabel || null,
    next_step_at: input.nextStepAt || null,
    closed_at: closing ? new Date().toISOString() : null,
  };

  if (input.id) {
    const { data: before } = await client
      .from("opportunities")
      .select("title, description, client_name, client_company, contact_name, contact_email, contact_phone, stage, value, temperature, probability, city, state, expected_at, owner_id, tags, source, attribution, partner_code, last_touch_at, next_step_label, next_step_at, closed_at")
      .eq("organization_id", organizationId)
      .eq("id", input.id)
      .maybeSingle();

    if (closing && before?.closed_at) values.closed_at = before.closed_at;

    const { data, error } = await client
      .from("opportunities")
      .update(values)
      .eq("id", input.id)
      .eq("organization_id", organizationId)
      .select("id")
      .maybeSingle();

    if (error || !data) return { ok: false, error: error?.message || SAVE_FAILED };

    const changes = diffFields(before, values, opportunityHistoryLabels);
    if (changes.length > 0) {
      await logRecordEvent(client, organizationId, { recordType: "opportunity", recordId: data.id, action: "updated", summary: summarize(changes), changes });
    }

    const peopleIds = [...new Set([...(input.ownerId ? [input.ownerId] : []), ...input.peopleIds])];
    await client.from("opportunity_people").delete().eq("organization_id", organizationId).eq("opportunity_id", data.id);
    if (peopleIds.length > 0) {
      const peopleWrite = await client.from("opportunity_people").insert(peopleIds.map((userId) => ({ organization_id: organizationId, opportunity_id: data.id, user_id: userId })));
      if (peopleWrite.error) return { ok: false, error: peopleWrite.error.message };
    }
    const opportunity = await getOpportunity(client, organizationId, data.id);
    return opportunity ? { ok: true, data: opportunity } : { ok: false, error: SAVE_FAILED };
  }

  const { data, error } = await client.from("opportunities").insert(values).select("id").single();
  if (error || !data) return { ok: false, error: error?.message || SAVE_FAILED };

  await logRecordEvent(client, organizationId, { recordType: "opportunity", recordId: data.id, action: "created", summary: `Abriu a oportunidade ${input.title}` });

  const peopleIds = [...new Set([...(input.ownerId ? [input.ownerId] : []), ...input.peopleIds])];
  if (peopleIds.length > 0) {
    const peopleWrite = await client.from("opportunity_people").insert(peopleIds.map((userId) => ({ organization_id: organizationId, opportunity_id: data.id, user_id: userId })));
    if (peopleWrite.error) return { ok: false, error: peopleWrite.error.message };
  }
  const opportunity = await getOpportunity(client, organizationId, data.id);
  return opportunity ? { ok: true, data: opportunity } : { ok: false, error: SAVE_FAILED };
}

/* Os nomes que a pessoa lê no histórico da oportunidade. */
const opportunityHistoryLabels = {
  title: "título",
  description: "descrição",
  client_name: "cliente",
  client_company: "empresa",
  contact_name: "contato",
  contact_email: "e-mail",
  contact_phone: "telefone",
  stage: "etapa",
  value: "valor",
  temperature: "temperatura",
  probability: "chance",
  city: "cidade",
  state: "estado",
  expected_at: "previsão",
  owner_id: "responsável",
  tags: "etiquetas",
  source: "origem",
  attribution: "atribuição",
  partner_code: "código do parceiro",
  last_touch_at: "último contato",
  next_step_label: "próximo passo",
  next_step_at: "data do próximo passo",
} as const;

/** Mover o cartão de coluna: a única escrita que o quadro faz ao arrastar. */
export async function moveOpportunity(
  client: CrmClient,
  organizationId: string,
  id: string,
  stage: CrmStage,
): Promise<ServiceResult<undefined>> {
  const closing = stageKind(stage) !== "open";
  const { error } = await client
    .from("opportunities")
    .update({ stage, closed_at: closing ? new Date().toISOString() : null, last_touch_at: format(new Date(), "yyyy-MM-dd") })
    .eq("id", id)
    .eq("organization_id", organizationId);

  if (error) return { ok: false, error: error.message };

  /* Só os desfechos entram no histórico: mover de coluna é o gesto mais frequente do funil e encheria a linha
     do tempo com o que a própria coluna já conta. Ganhar e perder são a coisa mais decisiva que se faz. */
  if (closing) {
    await logRecordEvent(client, organizationId, {
      recordType: "opportunity",
      recordId: id,
      action: "updated",
      summary: stageKind(stage) === "won" ? "Marcou como ganha" : "Marcou como perdida",
      changes: [{ field: "stage", label: "etapa", from: null, to: stage }],
    });
  }

  return { ok: true, data: undefined };
}

export async function deleteOpportunity(
  client: CrmClient,
  organizationId: string,
  id: string,
): Promise<ServiceResult<undefined>> {
  const { error } = await client.from("opportunities").delete().eq("organization_id", organizationId).eq("id", id);
  if (error) return { ok: false, error: error.message };

  await logRecordEvent(client, organizationId, { recordType: "opportunity", recordId: id, action: "deleted", summary: "Excluiu a oportunidade" });

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

/**
 * Uma cópia da oportunidade, na primeira etapa do funil dela. É o caminho de quem atende o mesmo cliente
 * por duas frentes, e de quem perdeu uma venda e vai tentar de novo do começo.
 *
 * O que **não** vem junto: o desfecho, as datas de fechamento e o orçamento ligado. Uma cópia nasce em
 * aberto, e herdar "ganha" faria a conta do funil contar duas vezes o mesmo dinheiro.
 */
export async function duplicateOpportunity(
  client: CrmClient,
  organizationId: string,
  id: string,
): Promise<ServiceResult<{ id: string }>> {
  const { data: source } = await client
    .from("opportunities")
    .select(
      "funnel_id, title, description, client_id, client_name, client_company, contact_name, contact_email, contact_phone, stage, value, temperature, probability, city, state, expected_at, owner_id, tags, source, partner_code",
    )
    .eq("organization_id", organizationId)
    .eq("id", id)
    .maybeSingle();

  if (!source) return { ok: false, error: "Essa oportunidade não está mais no funil." };

  /* A cópia entra na primeira etapa do funil, e não na etapa da original: copiar uma venda ganha para
     recomeçá-la e deixá-la em "ganha" seria contar o mesmo dinheiro duas vezes. */
  const { data: funnel } = source.funnel_id
    ? await client.from("crm_funnels").select("stages").eq("id", source.funnel_id).maybeSingle()
    : { data: null };

  const stage = funnel?.stages?.find((entry) => stageKind(entry) === "open") ?? funnel?.stages?.[0] ?? "lead";
  const { title, ...fields } = source;

  const { data, error } = await client
    .from("opportunities")
    .insert({ ...fields, organization_id: organizationId, title: `${title} (cópia)`, stage, closed_at: stageKind(stage) === "open" ? null : new Date().toISOString() })
    .select("id")
    .single();

  if (error || !data) return { ok: false, error: error?.message || SAVE_FAILED };
  return { ok: true, data: { id: data.id } };
}

/* ------------------------------------------------------------------------------------------------------ */
/* Pastas e funis: criar, renomear, apagar e arrumar etapas (2026-09-17, a pedido do leque do menu lateral). */
/* ------------------------------------------------------------------------------------------------------ */

/** Cria uma pasta do funil, ou renomeia a que veio com id. A posição nasce no fim do nível. */
export async function saveCrmFolder(
  client: CrmClient,
  organizationId: string,
  input: { id?: string; name: string; parentId: string | null; hue?: CrmHue },
): Promise<ServiceResult<{ id: string }>> {
  if (input.id) {
    const { data, error } = await client
      .from("crm_folders")
      .update({ name: input.name, ...(input.hue && { hue: input.hue }) })
      .eq("id", input.id)
      .eq("organization_id", organizationId)
      .select("id")
      .maybeSingle();

    if (error || !data) return { ok: false, error: error?.message || SAVE_FAILED };
    return { ok: true, data: { id: data.id } };
  }

  /* Quantas já existem no mesmo nível, para a nova entrar no fim. `is` só aceita nulo, e `eq` não acha nulo. */
  const level = client.from("crm_folders").select("id", { count: "exact", head: true }).eq("organization_id", organizationId);
  const { count } = await (input.parentId ? level.eq("parent_id", input.parentId) : level.is("parent_id", null));

  const { data, error } = await client
    .from("crm_folders")
    .insert({ organization_id: organizationId, name: input.name, hue: input.hue ?? "blue", parent_id: input.parentId, position: count ?? 0 })
    .select("id")
    .single();

  if (error || !data) return { ok: false, error: error?.message || SAVE_FAILED };
  return { ok: true, data: { id: data.id } };
}

/** Apaga a pasta. Os funis dentro dela voltam para a raiz: o vínculo é `set null`, pasta é só organização. */
export async function deleteCrmFolder(client: CrmClient, organizationId: string, id: string): Promise<ServiceResult<undefined>> {
  const { error } = await client.from("crm_folders").delete().eq("id", id).eq("organization_id", organizationId);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: undefined };
}

/**
 * Cria um funil, ou renomeia o que veio com id. O novo nasce com as etapas padrão e dentro da pasta pedida;
 * o slug sai do nome e é único na organização, porque é ele que vira endereço.
 */
export async function saveFunnel(
  client: CrmClient,
  organizationId: string,
  input: { id?: string; name: string; folderId: string | null; glyph?: FunnelGlyph; hue?: CrmHue },
): Promise<ServiceResult<{ id: string; slug: string }>> {
  if (input.id) {
    const { data, error } = await client
      .from("crm_funnels")
      .update({ name: input.name, ...(input.hue && { hue: input.hue }), ...(input.glyph && { glyph: input.glyph }) })
      .eq("id", input.id)
      .eq("organization_id", organizationId)
      .select("id, slug")
      .maybeSingle();

    if (error || !data) return { ok: false, error: error?.message || SAVE_FAILED };
    return { ok: true, data: { id: data.id, slug: data.slug } };
  }

  const { count } = await client.from("crm_funnels").select("id", { count: "exact", head: true }).eq("organization_id", organizationId);

  const { data, error } = await client
    .from("crm_funnels")
    .insert({
      organization_id: organizationId,
      name: input.name,
      slug: await uniqueFunnelSlug(client, organizationId, input.name),
      folder_id: input.folderId,
      glyph: input.glyph ?? "funnel",
      hue: input.hue ?? "blue",
      stages: defaultCrmStages,
      position: count ?? 0,
    })
    .select("id, slug")
    .single();

  if (error || !data) return { ok: false, error: error?.message || SAVE_FAILED };
  return { ok: true, data: { id: data.id, slug: data.slug } };
}

/**
 * Apaga um funil. As oportunidades dele **não** somem: o vínculo é `set null`, então elas caem no balde
 * "Sem funil" e continuam contando. Apagar o quadro não é apagar as vendas que estavam nele.
 */
export async function deleteFunnel(client: CrmClient, organizationId: string, id: string): Promise<ServiceResult<undefined>> {
  const { error } = await client.from("crm_funnels").delete().eq("id", id).eq("organization_id", organizationId);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: undefined };
}

/**
 * As etapas de um funil, na ordem das colunas. Uma oportunidade numa etapa que saiu fica onde está no banco
 * e some do quadro até a etapa voltar; o gatilho do banco cuida de as novas só entrarem em etapa que existe.
 */
export async function setFunnelStages(
  client: CrmClient,
  organizationId: string,
  id: string,
  stages: CrmStage[],
): Promise<ServiceResult<undefined>> {
  const definitions = await listStageDefinitions(client, organizationId);
  return configureFunnelStages(client, organizationId, { id, stages: stages.map((stage) => definitions.find((entry) => entry.id === stage) ?? defaultStageDefinition(stage)), replacements: {} });
}

/** Move um funil para uma pasta, ou para a raiz quando ela é nula. */
export async function moveFunnel(client: CrmClient, organizationId: string, input: { id: string; folderId: string | null }): Promise<ServiceResult<undefined>> {
  const { error } = await client.from("crm_funnels").update({ folder_id: input.folderId }).eq("id", input.id).eq("organization_id", organizationId);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: undefined };
}

export async function listStageDefinitions(client: CrmClient, organizationId: string): Promise<CrmStageDefinition[]> {
  const { data, error } = await client.from("crm_stage_definitions").select("id,label,hue").eq("organization_id", organizationId);
  if (error) throw new Error("Não foi possível carregar as etapas");
  return data ?? [];
}
export async function configureFunnelStages(client: CrmClient, organizationId: string, input: ConfigureFunnelStagesInput): Promise<ServiceResult<undefined>> {
  const renamed = new Map<string, string>();
  const stages = input.stages.map((stage) => {
    const defaults = defaultStageDefinition(stage.id);
    if (!crmStageValues.some((id) => id === stage.id) || (stage.label === defaults.label && stage.hue === defaults.hue)) return stage;
    const id = stageKind(stage.id) + "_" + crypto.randomUUID();
    renamed.set(stage.id, id);
    return { ...stage, id };
  });
  const replacements = Object.fromEntries(Object.entries(input.replacements).map(([from, to]) => [from, renamed.get(to) ?? to]));
  for (const [from, to] of renamed) replacements[from] = to;
  const { error } = await client.rpc("configure_funnel_stages", { p_organization_id: organizationId, p_funnel_id: input.id, p_stages: stages, p_replacements: replacements });
  return error ? { ok: false, error: error.message } : { ok: true, data: undefined };
}
