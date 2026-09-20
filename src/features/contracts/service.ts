import "server-only";
import { addDays, format } from "date-fns";
import type { SupabaseClient } from "@supabase/supabase-js";
import { dispatchAutomationEvent } from "@/features/automations/service";
import { getIssuer, listTeamMembers } from "@/features/organizations/service";
import { quoteTotals } from "@/features/quotes/totals";
import { siteConfig } from "@/lib/metadata";
import { shareCredentials, shareTokenHash } from "@/lib/security/share-token";
import { formatMoney } from "@/lib/utils/format";
import { logRecordEvent } from "@/features/records/history";
import type { Database, Json } from "@/types/database";
import type { ContractsListPage, ContractsQuery } from "./list-options";
import type { SaveContractInput } from "./schemas";
import type {
  Contract,
  ContractEvent,
  ContractKind,
  ContractParty,
  ContractSource,
  ContractStatus,
  ContractTheme,
  DocNode,
} from "./summary";
import { blankDocument, findTemplate, type TemplateContext } from "./templates";

/** A regra de contratos contra o banco, na mesma forma dos outros domínios. */
export type ContractsClient = SupabaseClient<Database>;

export type ServiceResult<T> = { ok: true; data: T } | { ok: false; error: string };
export type SaveResult = { ok: true; contract: Contract } | { ok: false; error: string; field?: string };
export type SendResult = { ok: true; contract: Contract; reminder: boolean } | { ok: false; error: string };
export type SignResult =
  | { ok: true; contract: Contract; party: ContractParty; completed: boolean; organizationId: string }
  | { ok: false; error: string };

/** O balde do Storage onde o PDF anexado e as assinaturas vivem. */
export const CONTRACT_BUCKET = "contract-files";

const columns = `
  id, reference, title, kind, description, source, status, client_id, owner_id, project_id, quote_id,
  amount, body, theme, template_id, file_name, file_size, file_pages, file_path, expires_in_days,
  created_at, sent_at, expires_at, signed_at, cancelled_at,
  clients(id, name, company, avatar_url),
  projects(id, name, url),
  quotes(id, reference, title, discount_kind, discount_value, quote_lines(quantity, unit_price, courtesy)),
  contract_parties(id, role, name, email, avatar_url, token_version, viewed_at, signed_at, signature_url, position),
  contract_signature_fields(id, party_id, page, x, y, width, height),
  contract_events(id, kind, actor, at)
`;

type PartyRow = {
  id: string;
  role: "issuer" | "client";
  name: string;
  email: string;
  avatar_url: string | null;
  token_version: number;
  viewed_at: string | null;
  signed_at: string | null;
  signature_url: string | null;
  position: number;
};

type Row = {
  id: string;
  reference: string;
  title: string;
  kind: ContractKind;
  description: string;
  source: ContractSource;
  status: ContractStatus;
  client_id: string | null;
  owner_id: string | null;
  project_id: string | null;
  quote_id: string | null;
  amount: number | null;
  body: DocNode | null;
  theme: ContractTheme;
  template_id: string | null;
  file_name: string | null;
  file_size: number | null;
  file_pages: number | null;
  file_path: string | null;
  expires_in_days: number;
  created_at: string;
  sent_at: string | null;
  expires_at: string | null;
  signed_at: string | null;
  cancelled_at: string | null;
  clients: { id: string; name: string; company: string | null; avatar_url: string | null } | null;
  projects: { id: string; name: string; url: string | null } | null;
  quotes: {
    id: string;
    reference: string;
    title: string;
    discount_kind: "percent" | "amount" | null;
    discount_value: number | null;
    quote_lines: { quantity: number | string; unit_price: number; courtesy: "no" | "yes" | "today" }[];
  } | null;
  contract_parties: PartyRow[];
  contract_signature_fields: { id: string; party_id: string; page: number; x: number; y: number; width: number; height: number }[];
  contract_events: { id: string; kind: ContractEvent["kind"]; actor: string | null; at: string }[];
};

const day = (value: string) => value.slice(0, 10);

const quoteAmount = (quote: NonNullable<Row["quotes"]>) =>
  quoteTotals({
    lines: quote.quote_lines.map((line) => ({ quantity: Number(line.quantity), unitPrice: line.unit_price, courtesy: line.courtesy })),
    discount: quote.discount_kind && quote.discount_value !== null ? { kind: quote.discount_kind, value: quote.discount_value } : null,
    installments: 1,
    cashDiscount: 0,
  }).total;

function toParty(row: PartyRow): ContractParty {
  return {
    id: row.id,
    role: row.role,
    name: row.name,
    email: row.email,
    avatarUrl: row.avatar_url,
    // O token não é guardado: sai do segredo do servidor mais o id da parte e a versão dela.
    token: shareCredentials("contract", row.id, row.token_version).token,
    viewedAt: row.viewed_at,
    signedAt: row.signed_at,
    signatureUrl: row.signature_url,
  };
}

function toContract(row: Row, owner: { name: string; avatarUrl: string | null }): Contract {
  return {
    id: row.id,
    reference: row.reference,
    title: row.title,
    kind: row.kind,
    description: row.description,
    source: row.source,
    status: row.status,
    client: row.clients
      ? { id: row.clients.id, name: row.clients.name, company: row.clients.company ?? undefined, avatarUrl: row.clients.avatar_url }
      : null,
    owner,
    parties: [...row.contract_parties].sort((a, b) => a.position - b.position).map(toParty),
    project: row.projects ? { id: row.projects.id, name: row.projects.name, url: row.projects.url } : null,
    quote: row.quotes
      ? { id: row.quotes.id, number: row.quotes.reference, title: row.quotes.title, amount: quoteAmount(row.quotes) }
      : null,
    amount: row.amount,
    body: row.body,
    theme: row.theme,
    templateId: row.template_id,
    file:
      row.file_name && row.file_size !== null && row.file_pages !== null
        ? { name: row.file_name, size: row.file_size, pages: row.file_pages }
        : null,
    fields: row.contract_signature_fields.map((field) => ({
      id: field.id,
      partyId: field.party_id,
      page: field.page,
      x: field.x,
      y: field.y,
      width: field.width,
      height: field.height,
    })),
    expiresInDays: row.expires_in_days,
    createdAt: day(row.created_at),
    sentAt: row.sent_at ? day(row.sent_at) : null,
    expiresAt: row.expires_at ? day(row.expires_at) : null,
    signedAt: row.signed_at,
    events: [...row.contract_events]
      .sort((a, b) => a.at.localeCompare(b.at))
      .map((entry) => ({ id: entry.id, kind: entry.kind, actor: entry.actor, at: entry.at })),
  };
}

const NOBODY = { name: "Equipe", avatarUrl: null };

async function ownersOf(client: ContractsClient, organizationId: string) {
  const members = await listTeamMembers(client, organizationId);
  return new Map(members.map((member) => [member.userId, { name: member.name || member.email || "Equipe", avatarUrl: member.avatarUrl }]));
}

/**
 * A página da grade, filtrada e cortada **no banco**. Situação, origem e tipo são colunas, e a busca compara
 * título e descrição, então tudo o que a barra oferece vira condição de SQL: a tela nunca carrega a base
 * inteira para mostrar doze cartões. As contagens por situação saem de uma consulta leve à parte, sobre a
 * base toda, porque é isso que o menu de filtros diz.
 */
export async function listContracts(
  client: ContractsClient,
  organizationId: string,
  query: ContractsQuery,
): Promise<ContractsListPage> {
  let builder = client.from("contracts").select(columns, { count: "exact" }).eq("organization_id", organizationId);

  if (query.search) {
    const term = query.search.replace(/[%,()]/g, " ").trim();
    builder = builder.or([`title.ilike.%${term}%`, `description.ilike.%${term}%`, `reference.ilike.%${term}%`].join(","));
  }
  if (query.status !== "todos") builder = builder.eq("status", query.status);
  if (query.source !== "todas") builder = builder.eq("source", query.source);
  if (query.kind !== "todos") builder = builder.eq("kind", query.kind);

  const start = (query.page - 1) * query.pageSize;
  const [page, owners, all] = await Promise.all([
    builder.order("created_at", { ascending: false }).range(start, start + query.pageSize - 1),
    ownersOf(client, organizationId),
    client.from("contracts").select("status").eq("organization_id", organizationId),
  ]);

  const counts: Record<ContractStatus, number> = { draft: 0, sent: 0, partial: 0, signed: 0, cancelled: 0 };
  for (const row of all.data ?? []) counts[row.status as ContractStatus] += 1;

  const rows = (page.data ?? []) as unknown as Row[];

  return {
    items: rows.map((row) => toContract(row, (row.owner_id && owners.get(row.owner_id)) || NOBODY)),
    total: page.count ?? rows.length,
    counts,
  };
}

export async function getContract(client: ContractsClient, organizationId: string, id: string): Promise<Contract | null> {
  const [{ data }, owners] = await Promise.all([
    client.from("contracts").select(columns).eq("organization_id", organizationId).eq("id", id).maybeSingle(),
    ownersOf(client, organizationId),
  ]);

  if (!data) return null;
  const row = data as unknown as Row;
  return toContract(row, (row.owner_id && owners.get(row.owner_id)) || NOBODY);
}

/** As bases de onde o editor puxa vínculos: os clientes, os projetos e os orçamentos aprovados da casa. */
export type ContractLookups = {
  clients: { id: string; name: string; company?: string; email: string | null; avatarUrl: string | null }[];
  projects: { id: string; name: string; clientId: string; url: string | null }[];
  quotes: { id: string; number: string; title: string; clientId: string | null; amount: number }[];
};

export async function getContractLookups(client: ContractsClient, organizationId: string): Promise<ContractLookups> {
  const [clients, projects, quotes] = await Promise.all([
    client.from("clients").select("id, name, company, email, avatar_url").eq("organization_id", organizationId).eq("active", true).order("name"),
    client.from("projects").select("id, name, client_id, url").eq("organization_id", organizationId).order("started_at", { ascending: false }),
    client
      .from("quotes")
      .select("id, reference, title, client_id, discount_kind, discount_value, quote_lines(quantity, unit_price, courtesy)")
      .eq("organization_id", organizationId)
      .eq("status", "approved")
      .order("issued_at", { ascending: false }),
  ]);

  return {
    clients: (clients.data ?? [])
      .map((row) => ({ id: row.id, name: row.name, company: row.company ?? undefined, email: row.email, avatarUrl: row.avatar_url }))
      .sort((a, b) => (a.company ?? a.name).localeCompare(b.company ?? b.name, "pt-BR")),
    projects: (projects.data ?? [])
      /* Projeto independente não entra na lista do contrato: contrato é sempre com alguém, e escolher um
         projeto sem cliente deixaria o campo de cliente sem o que adiantar. */
      .filter((row): row is typeof row & { client_id: string } => row.client_id !== null)
      .map((row) => ({ id: row.id, name: row.name, clientId: row.client_id, url: row.url })),
    quotes: (quotes.data ?? []).map((row) => ({
      id: row.id,
      number: row.reference,
      title: row.title,
      clientId: row.client_id,
      amount: quoteAmount(row as NonNullable<Row["quotes"]> & { client_id: string | null }),
    })),
  };
}

async function contextOf(client: ContractsClient, organizationId: string, contract: Contract): Promise<TemplateContext> {
  const issuer = await getIssuer(client, organizationId);
  return {
    issuer: { name: issuer.name, email: issuer.email, city: issuer.city },
    client: contract.client ? { name: contract.client.name, company: contract.client.company } : null,
    amount: contract.amount,
    date: contract.createdAt,
    project: contract.project?.name ?? null,
  };
}

/** Quem assina pela equipe nasce com o contrato: sem essa parte não há o que enviar para assinatura. */
async function createIssuerParty(client: ContractsClient, organizationId: string, contractId: string, userId: string) {
  const [{ data: profile }, issuer] = await Promise.all([
    client.from("profiles").select("full_name, email, avatar_url").eq("id", userId).maybeSingle(),
    getIssuer(client, organizationId),
  ]);

  const id = crypto.randomUUID();
  const { hash } = shareCredentials("contract", id);

  await client.from("contract_parties").insert({
    id,
    organization_id: organizationId,
    contract_id: contractId,
    role: "issuer",
    name: profile?.full_name || profile?.email || issuer.name,
    email: (profile?.email || issuer.email || "").toLowerCase(),
    avatar_url: profile?.avatar_url ?? null,
    token_hash: hash,
    position: 0,
  });
}

type CreateInput = { source: "template" | "scratch"; templateId?: string; kind?: ContractKind; clientId?: string };

/** Um rascunho novo, escrito: do zero, com o esqueleto, ou de um modelo, já preenchido com o que se sabe. */
export async function createContract(
  client: ContractsClient,
  organizationId: string,
  userId: string,
  input: CreateInput,
): Promise<ServiceResult<Contract>> {
  const id = crypto.randomUUID();

  const { error } = await client.from("contracts").insert({
    id,
    organization_id: organizationId,
    title: "Contrato sem título",
    kind: input.kind ?? "other",
    source: input.source,
    client_id: input.clientId ?? null,
    owner_id: userId,
    expires_in_days: 15,
  });

  if (error) return { ok: false, error: error.message };

  await createIssuerParty(client, organizationId, id, userId);
  await client.from("contract_events").insert({ organization_id: organizationId, contract_id: id, kind: "created" });
  await logRecordEvent(client, organizationId, { recordType: "contract", recordId: id, action: "created", summary: "Criou o contrato" });

  const created = await getContract(client, organizationId, id);
  if (!created) return { ok: false, error: "Não foi possível criar o contrato." };

  const template = input.source === "template" && input.templateId ? findTemplate(input.templateId) : null;
  const context = await contextOf(client, organizationId, created);

  if (template) {
    const built = template.build(context);
    await client
      .from("contracts")
      .update({ title: built.title, description: built.description, body: built.body as unknown as Json, kind: template.kind, template_id: template.id })
      .eq("id", id);
  } else {
    await client.from("contracts").update({ body: blankDocument(context) as unknown as Json }).eq("id", id);
  }

  const contract = await getContract(client, organizationId, id);
  return contract ? { ok: true, data: contract } : { ok: false, error: "Não foi possível criar o contrato." };
}

/** Um rascunho novo a partir de um PDF anexado: o arquivo vai para o Storage e o contrato guarda o caminho. */
export async function createPdfContract(
  client: ContractsClient,
  organizationId: string,
  userId: string,
  input: { name: string; bytes: Uint8Array; pages: number; clientId?: string },
): Promise<ServiceResult<Contract>> {
  const id = crypto.randomUUID();
  const path = `${organizationId}/${id}.pdf`;

  const upload = await client.storage.from(CONTRACT_BUCKET).upload(path, input.bytes, { contentType: "application/pdf", upsert: true });
  if (upload.error) return { ok: false, error: "Não foi possível guardar o arquivo do contrato." };

  const { error } = await client.from("contracts").insert({
    id,
    organization_id: organizationId,
    title: input.name.replace(/\.pdf$/i, "").slice(0, 90) || "Contrato anexado",
    source: "pdf",
    client_id: input.clientId ?? null,
    owner_id: userId,
    file_name: input.name,
    file_size: input.bytes.byteLength,
    file_pages: input.pages,
    file_path: path,
    expires_in_days: 15,
  });

  if (error) {
    await client.storage.from(CONTRACT_BUCKET).remove([path]);
    return { ok: false, error: error.message };
  }

  await createIssuerParty(client, organizationId, id, userId);
  await client.from("contract_events").insert({ organization_id: organizationId, contract_id: id, kind: "created" });
  await logRecordEvent(client, organizationId, { recordType: "contract", recordId: id, action: "created", summary: "Criou o contrato" });

  const contract = await getContract(client, organizationId, id);
  return contract ? { ok: true, data: contract } : { ok: false, error: "Não foi possível criar o contrato." };
}

/** Os bytes do PDF anexado, para a tela desenhar as páginas e para o download. */
export async function readContractFile(client: ContractsClient, organizationId: string, id: string) {
  const { data } = await client
    .from("contracts")
    .select("file_path")
    .eq("organization_id", organizationId)
    .eq("id", id)
    .maybeSingle();

  if (!data?.file_path) return null;

  const file = await client.storage.from(CONTRACT_BUCKET).download(data.file_path);
  if (file.error || !file.data) return null;

  return new Uint8Array(await file.data.arrayBuffer());
}

/**
 * Salva o rascunho: quem contrata, a que se liga, o documento, os campos e as partes. Só rascunho aceita;
 * documento enviado não muda por baixo de quem vai assinar.
 */
export async function saveContract(
  client: ContractsClient,
  organizationId: string,
  input: SaveContractInput,
): Promise<SaveResult> {
  const current = await getContract(client, organizationId, input.id);
  if (!current) return { ok: false, error: "Esse contrato não existe mais." };
  if (current.status !== "draft") return { ok: false, error: "Um contrato enviado não pode ser editado. Cancele e crie outro." };

  const lookups = await getContractLookups(client, organizationId);
  const contact = input.clientId ? lookups.clients.find((entry) => entry.id === input.clientId) : null;
  if (input.clientId && !contact) return { ok: false, error: "Esse cliente não está mais na base.", field: "clientId" };
  const project = input.projectId ? lookups.projects.find((entry) => entry.id === input.projectId) : null;
  if (input.projectId && !project) return { ok: false, error: "Esse projeto não está mais na base.", field: "projectId" };
  const quote = input.quoteId ? lookups.quotes.find((entry) => entry.id === input.quoteId) : null;
  if (input.quoteId && !quote) return { ok: false, error: "Esse orçamento não está mais na base.", field: "quoteId" };

  const { error } = await client
    .from("contracts")
    .update({
      title: input.title || current.title,
      kind: input.kind,
      description: input.description,
      theme: input.theme,
      expires_in_days: input.expiresInDays,
      client_id: contact?.id ?? null,
      project_id: project?.id ?? null,
      quote_id: quote?.id ?? null,
      amount: quote ? quote.amount : current.amount,
      body: current.source === "pdf" ? null : ((input.body ?? current.body) as unknown as Json),
    })
    .eq("id", input.id)
    .eq("organization_id", organizationId);

  if (error) return { ok: false, error: error.message };

  /* O editor grava a cada pausa, então o histórico registra a edição sem o campo a campo, que aqui seria o
     documento inteiro a cada tecla. */
  await logRecordEvent(client, organizationId, { recordType: "contract", recordId: input.id, action: "updated", summary: "Editou o rascunho" });

  /* As partes: quem emite sempre existe e só troca o e-mail; quem contrata nasce com o cliente e vai embora
     com ele, guardando a credencial quando já tinha uma. */
  const issuer = current.parties.find((party) => party.role === "issuer");
  if (issuer && input.emails.issuer) {
    await client.from("contract_parties").update({ email: input.emails.issuer.toLowerCase() }).eq("id", issuer.id);
  }

  const existing = current.parties.find((party) => party.role === "client");
  if (contact) {
    const email = (input.emails.client || contact.email || existing?.email || "").toLowerCase();
    if (existing) {
      await client
        .from("contract_parties")
        .update({ name: contact.name, avatar_url: contact.avatarUrl, email })
        .eq("id", existing.id);
    } else {
      const id = crypto.randomUUID();
      const { hash } = shareCredentials("contract", id);
      await client.from("contract_parties").insert({
        id,
        organization_id: organizationId,
        contract_id: input.id,
        role: "client",
        name: contact.name,
        email,
        avatar_url: contact.avatarUrl,
        token_hash: hash,
        position: 1,
      });
    }
  } else if (existing) {
    await client.from("contract_parties").delete().eq("id", existing.id);
  }

  if (current.source === "pdf") {
    await client.from("contract_signature_fields").delete().eq("contract_id", input.id).eq("organization_id", organizationId);
    if (input.fields.length > 0) {
      await client.from("contract_signature_fields").insert(
        input.fields.map((field) => ({
          organization_id: organizationId,
          contract_id: input.id,
          party_id: field.partyId,
          page: field.page,
          x: field.x,
          y: field.y,
          width: field.width,
          height: field.height,
        })),
      );
    }
  }

  const saved = await getContract(client, organizationId, input.id);
  return saved ? { ok: true, contract: saved } : { ok: false, error: "Não foi possível salvar o contrato." };
}

const validEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

/**
 * O que um contrato conta às automações: o cliente, o próprio contrato e o orçamento de origem, nos nomes
 * das variáveis do fluxo. O link é o da parte que contrata, para o e-mail levar direto à assinatura.
 */
function automationContext(contract: Contract) {
  const client = contract.parties.find((party) => party.role === "client");
  const situations: Record<ContractStatus, string> = {
    draft: "rascunho",
    sent: "aguardando assinatura",
    partial: "assinado por uma parte",
    signed: "assinado",
    cancelled: "cancelado",
  };

  return {
    cliente: {
      nome: client?.name ?? contract.client?.name ?? "",
      primeiro_nome: (client?.name ?? contract.client?.name ?? "").split(" ")[0] ?? "",
      email: client?.email ?? "",
      empresa: contract.client?.company ?? contract.client?.name ?? "",
    },
    contrato: {
      titulo: contract.title,
      numero: contract.reference,
      situacao: situations[contract.status],
      link: client ? `${siteConfig.url}/contrato/${client.token}` : "",
    },
    orcamento: {
      numero: contract.quote?.number ?? "",
      valor: contract.amount === null ? "" : formatMoney(contract.amount),
      valor_centavos: contract.amount ?? 0,
    },
  };
}

/**
 * Envia para assinatura, ou reenvia o convite: as duas partes precisam existir com e-mail, e no PDF anexado
 * cada uma precisa de um campo marcado. O convite passa a valer por `expiresInDays` a partir de hoje.
 */
export async function sendContract(
  client: ContractsClient,
  organizationId: string,
  id: string,
  actor: string,
): Promise<SendResult> {
  const contract = await getContract(client, organizationId, id);
  if (!contract) return { ok: false, error: "Esse contrato não existe mais." };
  if (contract.status === "signed" || contract.status === "cancelled") return { ok: false, error: "Esse contrato já foi encerrado." };

  const party = contract.parties.find((entry) => entry.role === "client");
  const issuer = contract.parties.find((entry) => entry.role === "issuer");
  if (!contract.client || !party) return { ok: false, error: "Escolha quem contrata antes de enviar." };
  if (!validEmail(party.email)) return { ok: false, error: "Informe um e-mail válido para quem contrata." };
  if (!issuer || !validEmail(issuer.email)) return { ok: false, error: "Informe um e-mail válido para quem assina pela equipe." };
  if (contract.source === "pdf" && contract.parties.some((entry) => !contract.fields.some((field) => field.partyId === entry.id))) {
    return { ok: false, error: "Marque no documento onde cada parte assina." };
  }
  if (contract.source !== "pdf" && !contract.body) return { ok: false, error: "O documento está vazio." };

  const reminder = contract.status !== "draft";
  const expiresAt = format(addDays(new Date(), contract.expiresInDays), "yyyy-MM-dd");

  const { error } = await client
    .from("contracts")
    .update({
      status: reminder ? contract.status : "sent",
      sent_at: reminder ? undefined : new Date().toISOString(),
      expires_at: expiresAt,
    })
    .eq("id", id)
    .eq("organization_id", organizationId);

  if (error) return { ok: false, error: error.message };

  await client.from("contract_events").insert({
    organization_id: organizationId,
    contract_id: id,
    kind: reminder ? "resent" : "sent",
    actor,
  });

  const sent = await getContract(client, organizationId, id);
  if (!sent) return { ok: false, error: "Não foi possível enviar o contrato." };

  // O envio de verdade (não o lembrete) é um evento para as automações, que rodam sem segurar a resposta.
  if (!reminder) void dispatchAutomationEvent(organizationId, "contract_sent", automationContext(sent)).catch(() => undefined);

  await logRecordEvent(client, organizationId, { recordType: "contract", recordId: id, action: "updated", summary: reminder ? "Reenviou para assinatura" : "Enviou para assinatura" });

  return { ok: true, contract: sent, reminder };
}

export async function cancelContract(
  client: ContractsClient,
  organizationId: string,
  id: string,
  actor: string,
): Promise<ServiceResult<Contract>> {
  const contract = await getContract(client, organizationId, id);
  if (!contract) return { ok: false, error: "Esse contrato não existe mais." };
  if (contract.status === "signed") return { ok: false, error: "Um contrato assinado não pode ser cancelado por aqui." };

  const { error } = await client
    .from("contracts")
    .update({ cancelled_at: new Date().toISOString(), status: "cancelled" })
    .eq("id", id)
    .eq("organization_id", organizationId);

  if (error) return { ok: false, error: error.message };

  await client.from("contract_events").insert({ organization_id: organizationId, contract_id: id, kind: "cancelled", actor });
  await logRecordEvent(client, organizationId, { recordType: "contract", recordId: id, action: "archived", summary: "Cancelou o contrato" });

  const cancelled = await getContract(client, organizationId, id);
  return cancelled ? { ok: true, data: cancelled } : { ok: false, error: "Não foi possível cancelar o contrato." };
}

/**
 * O contrato e a parte pelo token dela: é a credencial da página pública, e a leitura passa pela função do
 * banco com a chave secreta, porque `anon` não tem select em tabela nenhuma.
 */
export async function getContractByPartyToken(admin: ContractsClient, token: string) {
  const { data } = await admin.rpc("contract_by_party_token", { p_token_hash: shareTokenHash(token) });
  if (!data) return null;

  const payload = data as unknown as {
    contract: Omit<Row, "contract_parties" | "contract_signature_fields" | "contract_events" | "clients" | "projects" | "quotes"> & {
      organization_id: string;
    };
    party: PartyRow;
    parties: PartyRow[];
    fields: Row["contract_signature_fields"];
    issuer: { name: string; logoUrl: string | null };
  };

  const row = {
    ...payload.contract,
    clients: null,
    projects: null,
    quotes: null,
    contract_parties: payload.parties,
    contract_signature_fields: payload.fields,
    contract_events: [],
  } as Row;

  const contract = toContract(row, { name: payload.issuer.name, avatarUrl: payload.issuer.logoUrl });
  const party = contract.parties.find((entry) => entry.id === payload.party.id);
  if (!party) return null;

  return { contract, party, issuer: payload.issuer, organizationId: payload.contract.organization_id };
}

export async function markContractViewed(admin: ContractsClient, token: string) {
  await admin.rpc("mark_contract_party_viewed", { p_token_hash: shareTokenHash(token) });
}

/**
 * A assinatura de uma parte, pelo token dela. Quem decide se pode assinar é a função do banco, dentro de uma
 * transação: prazo, cancelamento e assinatura repetida são conferidos lá, e não aqui, senão duas abas
 * abertas ao mesmo tempo passariam as duas.
 */
export async function signContract(
  admin: ContractsClient,
  token: string,
  input: { name: string; signature: string },
): Promise<SignResult> {
  const { data: signed, error } = await admin.rpc("sign_contract_party", {
    p_token_hash: shareTokenHash(token),
    p_signature_url: input.signature,
  });

  if (error) return { ok: false, error: "Não foi possível registrar a assinatura." };
  if (!signed) return { ok: false, error: "Este link não vale mais para assinar." };

  const found = await getContractByPartyToken(admin, token);
  if (!found) return { ok: false, error: "Não foi possível registrar a assinatura." };

  const completed = found.contract.parties.every((entry) => entry.signedAt);
  if (completed) {
    void dispatchAutomationEvent(found.organizationId, "contract_signed", automationContext(found.contract)).catch(() => undefined);
  }

  return { ok: true, contract: found.contract, party: found.party, completed, organizationId: found.organizationId };
}
