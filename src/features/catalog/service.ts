import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { QuoteStatus } from "@/features/quotes/summary";
import type { Database } from "@/types/database";
import { catalogHueFor } from "./list-options";
import type { CatalogListPage, CatalogQuery } from "./list-options";
import type { CatalogFormInput } from "./schemas";
import type { CatalogHue, CatalogItem, CatalogQuote } from "./summary";

/**
 * A regra do catálogo contra o banco. Mesma forma da base de clientes: recebe o cliente do Supabase de
 * fora, não sabe quem chamou, e serve tanto à Server Action da web quanto ao Route Handler do aplicativo.
 */
export type CatalogClient = SupabaseClient<Database>;

export type ServiceResult<T> = { ok: true; data: T } | { ok: false; error: string };

const SAVE_FAILED = "Não foi possível salvar o item. Tente de novo em instantes.";

const columns = `
  id, reference, name, description, kind, category, price, unit, duration_min, duration_max,
  stock_quantity, stock_capacity, stock_minimum, image_url, hue, active, cost, max_discount, revisions,
  support_days, deliverables, requirements, tags, notes, created_at, updated_at, created_by
`;

type Row = Database["public"]["Tables"]["catalog_items"]["Row"];

const day = (value: string) => value.slice(0, 10);

function toItem(row: Row, authorName: string, stats: CatalogItem["stats"], quotes: CatalogQuote[]): CatalogItem {
  return {
    id: row.id,
    reference: row.reference,
    name: row.name,
    description: row.description,
    kind: row.kind,
    category: row.category,
    price: row.price,
    unit: row.unit,
    duration: row.duration_min !== null && row.duration_max !== null ? { min: row.duration_min, max: row.duration_max } : undefined,
    stock:
      row.stock_quantity !== null && row.stock_capacity !== null && row.stock_minimum !== null
        ? { quantity: row.stock_quantity, capacity: row.stock_capacity, minimum: row.stock_minimum }
        : undefined,
    imageUrl: row.image_url,
    hue: row.hue as CatalogHue,
    active: row.active,
    createdAt: day(row.created_at),
    createdBy: authorName,
    updatedAt: day(row.updated_at),
    cost: row.cost,
    maxDiscount: row.max_discount,
    revisions: row.revisions ?? undefined,
    supportDays: row.support_days,
    deliverables: row.deliverables,
    requirements: row.requirements,
    tags: row.tags,
    notes: row.notes ?? undefined,
    stats,
    quotes,
  };
}

const emptyStats = (): CatalogItem["stats"] => ({ quotes: 0, approved: 0, billed: 0, lastQuotedAt: null });

/** O nome de quem cadastrou: uma consulta para a página inteira, e não uma por cartão. */
async function authorsFor(client: CatalogClient, ids: string[]) {
  const names = new Map<string, string>();
  const unique = [...new Set(ids)];
  if (unique.length === 0) return names;

  const { data } = await client.from("profiles").select("id, full_name, email").in("id", unique);
  for (const row of data ?? []) names.set(row.id, row.full_name || row.email || "Equipe");
  return names;
}

/**
 * Os números de venda de cada item da página: em quantos orçamentos entrou, quantos foram aprovados,
 * quanto faturou nos aprovados e quando entrou num pela última vez. Uma consulta por página, como nos
 * clientes: por cartão seriam trinta idas ao banco para desenhar uma tela.
 */
async function salesFor(client: CatalogClient, organizationId: string, ids: string[]) {
  const stats = new Map<string, CatalogItem["stats"]>(ids.map((id) => [id, emptyStats()]));
  const quotes = new Map<string, CatalogQuote[]>(ids.map((id) => [id, []]));
  if (ids.length === 0) return { stats, quotes };

  const { data } = await client
    .from("quote_lines")
    .select(
      "catalog_item_id, quantity, unit_price, courtesy, quotes!inner(id, reference, title, status, issued_at, client_name, organization_id)",
    )
    .eq("organization_id", organizationId)
    .in("catalog_item_id", ids)
    .order("created_at", { ascending: false });

  for (const line of data ?? []) {
    const itemId = line.catalog_item_id;
    const quote = line.quotes;
    if (!itemId || !quote) continue;

    const entry = stats.get(itemId);
    if (!entry) continue;

    const amount = line.courtesy === "no" ? Math.round(Number(line.quantity) * line.unit_price) : 0;
    entry.quotes += 1;
    if (quote.status === "approved") {
      entry.approved += 1;
      entry.billed += amount;
    }
    if (!entry.lastQuotedAt || quote.issued_at > entry.lastQuotedAt) entry.lastQuotedAt = quote.issued_at;

    const list = quotes.get(itemId);
    if (list && list.length < 6) {
      list.push({
        id: quote.id,
        number: quote.reference,
        title: quote.title,
        client: quote.client_name,
        amount,
        status: quote.status as QuoteStatus,
        date: quote.issued_at,
      });
    }
  }

  return { stats, quotes };
}

/**
 * A página do catálogo, filtrada e cortada no banco. As categorias saem da base inteira, e não da página,
 * senão o menu de filtros ofereceria só o que já está na tela.
 */
export async function listCatalog(
  client: CatalogClient,
  organizationId: string,
  query: CatalogQuery,
): Promise<CatalogListPage> {
  let builder = client
    .from("catalog_items")
    .select(columns, { count: "exact" })
    .eq("organization_id", organizationId);

  if (query.search) {
    const term = query.search.replace(/[%,()]/g, " ").trim();
    builder = builder.or(
      [`name.ilike.%${term}%`, `description.ilike.%${term}%`, `category.ilike.%${term}%`, `reference.ilike.%${term}%`].join(","),
    );
  }
  if (query.kind !== "todos") builder = builder.eq("kind", query.kind === "produtos" ? "product" : "service");
  if (query.category) builder = builder.eq("category", query.category);
  if (query.status !== "todos") builder = builder.eq("active", query.status === "ativos");

  const start = (query.page - 1) * query.pageSize;
  const [page, categories] = await Promise.all([
    builder.order("name").range(start, start + query.pageSize - 1),
    client.from("catalog_items").select("category").eq("organization_id", organizationId),
  ]);

  const rows = (page.data ?? []) as unknown as Row[];
  const ids = rows.map((row) => row.id);
  const [authors, sales] = await Promise.all([
    authorsFor(client, rows.map((row) => row.created_by).filter((id): id is string => Boolean(id))),
    salesFor(client, organizationId, ids),
  ]);

  return {
    items: rows.map((row) =>
      toItem(
        row,
        (row.created_by && authors.get(row.created_by)) || "Equipe",
        sales.stats.get(row.id) ?? emptyStats(),
        sales.quotes.get(row.id) ?? [],
      ),
    ),
    total: page.count ?? rows.length,
    categories: [...new Set((categories.data ?? []).map((row) => row.category).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b, "pt-BR"),
    ),
  };
}

export async function getCatalogItem(
  client: CatalogClient,
  organizationId: string,
  id: string,
): Promise<CatalogItem | null> {
  const { data } = await client
    .from("catalog_items")
    .select(columns)
    .eq("organization_id", organizationId)
    .eq("id", id)
    .maybeSingle();

  if (!data) return null;

  const row = data as unknown as Row;
  const [authors, sales] = await Promise.all([
    authorsFor(client, row.created_by ? [row.created_by] : []),
    salesFor(client, organizationId, [id]),
  ]);

  return toItem(
    row,
    (row.created_by && authors.get(row.created_by)) || "Equipe",
    sales.stats.get(id) ?? emptyStats(),
    sales.quotes.get(id) ?? [],
  );
}

/**
 * Salva a ficha, criando ou editando. O matiz não vem do formulário: item sem foto ganha a cor derivada do
 * nome, e na edição o que o item já tem fica, para a arte de um item conhecido não trocar de cor quando o
 * renomeiam. O que não se aplica ao tipo vai como nulo, que é o que os `check` da tabela exigem.
 */
export async function saveCatalogItem(
  client: CatalogClient,
  organizationId: string,
  userId: string,
  input: CatalogFormInput,
): Promise<ServiceResult<{ id: string }>> {
  const isProduct = input.kind === "product";

  const values = {
    organization_id: organizationId,
    name: input.name,
    description: input.description,
    kind: input.kind,
    category: input.category,
    price: input.price,
    unit: input.unit,
    duration_min: isProduct ? null : (input.duration?.min ?? null),
    duration_max: isProduct ? null : (input.duration?.max ?? null),
    stock_quantity: isProduct ? (input.stock?.quantity ?? null) : null,
    stock_capacity: isProduct ? (input.stock?.capacity ?? null) : null,
    stock_minimum: isProduct ? (input.stock?.minimum ?? null) : null,
    cost: input.cost,
    max_discount: input.maxDiscount,
    revisions: isProduct ? null : input.revisions,
    support_days: input.supportDays,
    deliverables: input.deliverables,
    requirements: input.requirements,
    tags: input.tags,
    notes: input.notes.trim() || null,
    active: input.active,
  };

  if (input.id) {
    const { data, error } = await client
      .from("catalog_items")
      .update(values)
      .eq("id", input.id)
      .eq("organization_id", organizationId)
      .select("id")
      .maybeSingle();

    if (error || !data) return { ok: false, error: error?.message || SAVE_FAILED };
    return { ok: true, data: { id: data.id } };
  }

  const { data, error } = await client
    .from("catalog_items")
    .insert({ ...values, hue: catalogHueFor(input.name), created_by: userId })
    .select("id")
    .single();

  if (error || !data) return { ok: false, error: error?.message || SAVE_FAILED };
  return { ok: true, data: { id: data.id } };
}

export async function deleteCatalogItems(
  client: CatalogClient,
  organizationId: string,
  ids: string[],
): Promise<ServiceResult<{ deleted: number }>> {
  const { data, error } = await client
    .from("catalog_items")
    .delete()
    .eq("organization_id", organizationId)
    .in("id", ids)
    .select("id");

  if (error) return { ok: false, error: error.message };
  return { ok: true, data: { deleted: data?.length ?? 0 } };
}

/** Os itens que o editor de orçamento oferece: os ativos, do mais novo para o mais antigo. */
export async function listCatalogOptions(client: CatalogClient, organizationId: string): Promise<CatalogItem[]> {
  const { data } = await client
    .from("catalog_items")
    .select(columns)
    .eq("organization_id", organizationId)
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(200);

  const rows = (data ?? []) as unknown as Row[];
  return rows.map((row) => toItem(row, "Equipe", emptyStats(), []));
}

