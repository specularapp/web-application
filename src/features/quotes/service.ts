import "server-only";
import { format } from "date-fns";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getIssuer } from "@/features/organizations/service";
import { shareCredentials, shareToken, shareTokenHash } from "@/lib/security/share-token";
import type { Database } from "@/types/database";
import type { QuotesListPage, QuotesQuery } from "./list-options";
import type { QuoteFormInput } from "./schemas";
import type { LatestQuote, Quote, QuoteIssuer, QuoteLine, QuotePerson, QuoteStatus, QuotesSummary } from "./summary";
import { quoteTotals } from "./totals";

/** A regra de orçamentos contra o banco, na mesma forma dos outros domínios. */
export type QuotesClient = SupabaseClient<Database>;

export type ServiceResult<T> = { ok: true; data: T } | { ok: false; error: string };

const SAVE_FAILED = "Não foi possível salvar o orçamento. Tente de novo em instantes.";

const columns = `
  id, reference, title, status, client_id, client_name, client_company, client_email, client_phone,
  client_city, client_avatar_url, owner_id, discount_kind, discount_value, installments, payment_methods,
  cash_discount, notes, issued_at, valid_until, sent_at, viewed_at, responded_at, share_token_version,
  created_at, updated_at,
  quote_lines(id, catalog_item_id, name, description, quantity, unit_price, unit, courtesy, position)
`;

type LineRow = {
  id: string;
  catalog_item_id: string | null;
  name: string;
  description: string;
  quantity: number | string;
  unit_price: number;
  unit: Database["public"]["Enums"]["catalog_unit"];
  courtesy: Database["public"]["Enums"]["quote_courtesy"];
  position: number;
};

type Row = {
  id: string;
  reference: string;
  title: string;
  status: QuoteStatus;
  client_id: string | null;
  client_name: string;
  client_company: string | null;
  client_email: string | null;
  client_phone: string | null;
  client_city: string | null;
  client_avatar_url: string | null;
  owner_id: string | null;
  discount_kind: "percent" | "amount" | null;
  discount_value: number | null;
  installments: number;
  payment_methods: Database["public"]["Enums"]["payment_method"][];
  cash_discount: number;
  notes: string;
  issued_at: string;
  valid_until: string | null;
  sent_at: string | null;
  viewed_at: string | null;
  responded_at: string | null;
  share_token_version: number;
  created_at: string;
  updated_at: string;
  quote_lines: LineRow[];
};

const NOBODY: QuotePerson = { name: "Equipe", avatarUrl: null };

const toLine = (line: LineRow): QuoteLine => ({
  id: line.id,
  catalogItemId: line.catalog_item_id,
  name: line.name,
  description: line.description,
  quantity: Number(line.quantity),
  unitPrice: line.unit_price,
  unit: line.unit,
  courtesy: line.courtesy,
});

function toQuote(row: Row, owner: QuotePerson, issuer: QuoteIssuer): Quote {
  return {
    id: row.id,
    number: row.reference,
    title: row.title,
    status: row.status,
    clientId: row.client_id,
    client: {
      name: row.client_name,
      avatarUrl: row.client_avatar_url,
      company: row.client_company ?? undefined,
      email: row.client_email ?? undefined,
      phone: row.client_phone ?? undefined,
      city: row.client_city ?? undefined,
    },
    owner,
    issuer,
    lines: [...row.quote_lines].sort((a, b) => a.position - b.position).map(toLine),
    discount: row.discount_kind && row.discount_value !== null ? { kind: row.discount_kind, value: row.discount_value } : null,
    installments: row.installments,
    paymentMethods: row.payment_methods,
    cashDiscount: row.cash_discount,
    notes: row.notes,
    issuedAt: row.issued_at,
    validUntil: row.valid_until,
    sentAt: row.sent_at,
    viewedAt: row.viewed_at,
    respondedAt: row.responded_at,
    // O token não é guardado: sai do segredo do servidor mais o id e a versão da linha.
    shareToken: shareToken("quote", row.id, row.share_token_version),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function peopleFor(client: QuotesClient, ids: (string | null)[]) {
  const people = new Map<string, QuotePerson>();
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (unique.length === 0) return people;

  const { data } = await client.from("profiles").select("id, full_name, email, avatar_url").in("id", unique);
  for (const row of data ?? []) {
    people.set(row.id, { name: row.full_name || row.email || "Equipe", avatarUrl: row.avatar_url });
  }
  return people;
}

/**
 * A validade vencida não é gravada: ela é lida na hora, porque um orçamento vence sozinho e depender de
 * alguém rodar uma rotina faria a etiqueta mentir no dia seguinte ao vencimento.
 */
function readStatus(row: Row): QuoteStatus {
  if (row.status === "sent" || row.status === "viewed") {
    if (row.valid_until && row.valid_until < format(new Date(), "yyyy-MM-dd")) return "expired";
  }
  return row.status;
}

export async function listQuotes(
  client: QuotesClient,
  organizationId: string,
  query: QuotesQuery,
): Promise<QuotesListPage> {
  let builder = client.from("quotes").select(columns, { count: "exact" }).eq("organization_id", organizationId);

  if (query.search) {
    const term = query.search.replace(/[%,()]/g, " ").trim();
    builder = builder.or(
      [`title.ilike.%${term}%`, `reference.ilike.%${term}%`, `client_name.ilike.%${term}%`, `client_company.ilike.%${term}%`].join(","),
    );
  }
  if (query.status !== "todos") builder = builder.eq("status", query.status);
  if (query.period !== "sempre") {
    const since = new Date();
    since.setDate(since.getDate() - Number(query.period));
    builder = builder.gte("issued_at", format(since, "yyyy-MM-dd"));
  }

  const start = (query.page - 1) * query.pageSize;
  const [page, issuer, all] = await Promise.all([
    builder.order("issued_at", { ascending: false }).range(start, start + query.pageSize - 1),
    getIssuer(client, organizationId),
    client.from("quotes").select("status, valid_until").eq("organization_id", organizationId),
  ]);

  const rows = (page.data ?? []) as unknown as Row[];
  const people = await peopleFor(client, rows.map((row) => row.owner_id));

  /* As contagens saem da base inteira, e não da página, para o menu de filtros dizer quanto há em cada
     situação em vez de quanto há na tela. O vencido é lido aqui pela mesma régua da listagem. */
  const counts: Record<QuoteStatus, number> = { draft: 0, sent: 0, viewed: 0, approved: 0, declined: 0, expired: 0 };
  const today = format(new Date(), "yyyy-MM-dd");
  for (const row of all.data ?? []) {
    const expired = (row.status === "sent" || row.status === "viewed") && row.valid_until !== null && row.valid_until < today;
    counts[expired ? "expired" : (row.status as QuoteStatus)] += 1;
  }

  return {
    items: rows.map((row) => ({
      ...toQuote(row, (row.owner_id && people.get(row.owner_id)) || NOBODY, issuer),
      status: readStatus(row),
    })),
    total: page.count ?? rows.length,
    counts,
  };
}

/**
 * O próximo identificador, só para o editor mostrar antes de salvar: quem o gera de verdade é o gatilho do
 * banco, na hora da inserção, porque contador em memória repetiria número com duas pessoas criando junto.
 */
export async function nextQuoteNumber(client: QuotesClient, organizationId: string) {
  const year = new Date().getFullYear();
  const { data } = await client
    .from("quotes")
    .select("reference")
    .eq("organization_id", organizationId)
    .like("reference", `ORC-${year}-%`)
    .order("reference", { ascending: false })
    .limit(1)
    .maybeSingle();

  const last = Number(data?.reference.split("-").at(-1) ?? 0);
  return `ORC-${year}-${String(last + 1).padStart(4, "0")}`;
}

export async function getQuote(client: QuotesClient, organizationId: string, id: string): Promise<Quote | null> {
  const { data } = await client
    .from("quotes")
    .select(columns)
    .eq("organization_id", organizationId)
    .eq("id", id)
    .maybeSingle();

  if (!data) return null;

  const row = data as unknown as Row;
  const [people, issuer] = await Promise.all([peopleFor(client, [row.owner_id]), getIssuer(client, organizationId)]);
  return { ...toQuote(row, (row.owner_id && people.get(row.owner_id)) || NOBODY, issuer), status: readStatus(row) };
}

/** O bloco do painel: o último orçamento que a pessoa criou, com os totais já somados. */
export async function getQuotesSummary(
  client: QuotesClient,
  organizationId: string,
  userId: string,
): Promise<QuotesSummary> {
  const { data } = await client
    .from("quotes")
    .select(columns)
    .eq("organization_id", organizationId)
    .eq("owner_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return { latest: null };

  const row = data as unknown as Row;
  const [people, issuer] = await Promise.all([peopleFor(client, [row.owner_id]), getIssuer(client, organizationId)]);
  const quote = toQuote(row, (row.owner_id && people.get(row.owner_id)) || NOBODY, issuer);

  const latest: LatestQuote = {
    id: quote.id,
    number: quote.number,
    title: quote.title,
    client: { name: quote.client.name, avatarUrl: quote.client.avatarUrl },
    owner: quote.owner,
    amount: quoteTotals(quote).total,
    installments: quote.installments,
    items: quote.lines.length,
    status: readStatus(row),
    sentAt: quote.sentAt,
    validUntil: quote.validUntil,
    description: quote.lines.map((line) => line.name).join(", "),
  };

  return { latest };
}

/**
 * Salva o orçamento, criando ou editando: é o mesmo formulário. As linhas são reescritas por inteiro, e não
 * casadas uma a uma, porque o editor reordena, apaga e acrescenta na mesma edição, e casar id a id trocaria
 * uma escrita por três com o mesmo resultado.
 */
export async function saveQuote(
  client: QuotesClient,
  organizationId: string,
  userId: string,
  input: QuoteFormInput,
): Promise<ServiceResult<{ id: string; status: QuoteStatus }>> {
  const { data: contact } = await client
    .from("clients")
    .select("id, name, company, email, phone, city, avatar_url")
    .eq("organization_id", organizationId)
    .eq("id", input.clientId)
    .maybeSingle();

  if (!contact) return { ok: false, error: "Esse cliente não está mais na base." };

  const sending = input.intent === "send";
  const values = {
    organization_id: organizationId,
    title: input.title,
    client_id: contact.id,
    client_name: contact.name,
    client_company: contact.company,
    client_email: contact.email,
    client_phone: contact.phone,
    client_city: contact.city,
    client_avatar_url: contact.avatar_url,
    owner_id: userId,
    discount_kind: input.discount?.kind ?? null,
    discount_value: input.discount?.value ?? null,
    installments: input.installments,
    payment_methods: input.paymentMethods,
    cash_discount: input.cashDiscount,
    notes: input.notes,
    issued_at: input.issuedAt,
    valid_until: input.validUntil,
  };

  let id = input.id ?? null;

  if (id) {
    const { error } = await client
      .from("quotes")
      .update({
        ...values,
        status: sending ? "sent" : undefined,
        sent_at: sending ? new Date().toISOString() : undefined,
      })
      .eq("id", id)
      .eq("organization_id", organizationId);

    if (error) return { ok: false, error: error.message || SAVE_FAILED };
  } else {
    /* O id nasce aqui, e não no banco, porque o resumo do token é derivado dele: gerar a linha primeiro
       obrigaria a uma segunda escrita só para gravar o resumo. */
    id = crypto.randomUUID();
    const { hash } = shareCredentials("quote", id);

    const { error } = await client.from("quotes").insert({
      ...values,
      id,
      status: sending ? "sent" : "draft",
      sent_at: sending ? new Date().toISOString() : null,
      share_token_hash: hash,
    });

    if (error) return { ok: false, error: error.message || SAVE_FAILED };
  }

  await client.from("quote_lines").delete().eq("quote_id", id).eq("organization_id", organizationId);

  const { error: linesError } = await client.from("quote_lines").insert(
    input.lines.map((line, position) => ({
      organization_id: organizationId,
      quote_id: id,
      catalog_item_id: line.catalogItemId,
      name: line.name,
      description: line.description,
      quantity: line.quantity,
      unit_price: line.unitPrice,
      unit: line.unit,
      courtesy: line.courtesy,
      position,
    })),
  );

  if (linesError) return { ok: false, error: linesError.message || SAVE_FAILED };

  return { ok: true, data: { id, status: sending ? "sent" : "draft" } };
}

export async function deleteQuotes(
  client: QuotesClient,
  organizationId: string,
  ids: string[],
): Promise<ServiceResult<{ deleted: number }>> {
  const { data, error } = await client
    .from("quotes")
    .delete()
    .eq("organization_id", organizationId)
    .in("id", ids)
    .select("id");

  if (error) return { ok: false, error: error.message };
  return { ok: true, data: { deleted: data?.length ?? 0 } };
}

/** Revoga o link público sem apagar o orçamento: o token anterior deixa de bater com o resumo gravado. */
export async function rotateQuoteToken(
  client: QuotesClient,
  organizationId: string,
  id: string,
): Promise<ServiceResult<{ token: string }>> {
  const { data } = await client
    .from("quotes")
    .select("share_token_version")
    .eq("organization_id", organizationId)
    .eq("id", id)
    .maybeSingle();

  if (!data) return { ok: false, error: "Orçamento não encontrado." };

  const version = data.share_token_version + 1;
  const { token, hash } = shareCredentials("quote", id, version);
  const { error } = await client
    .from("quotes")
    .update({ share_token_hash: hash, share_token_version: version })
    .eq("organization_id", organizationId)
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  return { ok: true, data: { token } };
}

/**
 * O orçamento por trás de um link público. Roda com a chave secreta, pela função do banco, porque `anon`
 * não tem leitura em tabela nenhuma: o que a página pública recebe é o que a função devolve, e nada além.
 */
export async function getQuoteByToken(
  admin: QuotesClient,
  token: string,
): Promise<{ quote: Quote; issuer: QuoteIssuer; organizationId: string } | null> {
  const { data } = await admin.rpc("quote_by_token", { p_token_hash: shareTokenHash(token) });
  if (!data) return null;

  const payload = data as unknown as {
    quote: Omit<Row, "quote_lines"> & { organization_id: string };
    issuer: QuoteIssuer;
    lines: LineRow[];
  };
  const row = { ...payload.quote, quote_lines: payload.lines } as Row;

  return {
    quote: { ...toQuote(row, NOBODY, payload.issuer), status: readStatus(row) },
    issuer: payload.issuer,
    organizationId: payload.quote.organization_id,
  };
}

export async function markQuoteViewed(admin: QuotesClient, token: string) {
  await admin.rpc("mark_quote_viewed", { p_token_hash: shareTokenHash(token) });
}

export async function respondToQuote(
  admin: QuotesClient,
  token: string,
  approved: boolean,
): Promise<ServiceResult<{ status: QuoteStatus; organizationId: string }>> {
  const { data, error } = await admin.rpc("respond_quote", { p_token_hash: shareTokenHash(token), p_approved: approved });
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Este orçamento não está mais disponível para resposta." };

  /* O time sai do próprio documento: quem responde pelo link não tem sessão, e a action precisa dele para
     derrubar o cache da listagem da equipe. */
  const found = await getQuoteByToken(admin, token);

  return {
    ok: true,
    data: { status: approved ? "approved" : "declined", organizationId: found?.organizationId ?? "" },
  };
}
