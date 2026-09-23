import "server-only";
import { dbMessage } from "@/lib/db/message";
import type { SupabaseClient } from "@supabase/supabase-js";
import { quoteTotals } from "@/features/quotes/totals";
import type { QuoteStatus } from "@/features/quotes/summary";
import { diffFields, logRecordEvent, summarize } from "@/features/records/history";
import type { Database } from "@/types/database";
import type { ClientListItem, ClientsListPage, ClientsQuery } from "./list-options";
import type { ClientFormInput } from "./schemas";
import type { Client, ClientProject, ClientProjectStatus, ClientQuote, ClientsSummary } from "./summary";

/**
 * A regra de clientes contra o banco. Recebe o cliente do Supabase de fora e não sabe quem chamou, então a
 * mesma função serve à Server Action da web e ao Route Handler de `api/v1` que o aplicativo usa. A RLS é
 * quem decide o acesso; o `organization_id` aqui é filtro e preenchimento, nunca permissão.
 */
export type ClientsClient = SupabaseClient<Database>;

export type ServiceResult<T> = { ok: true; data: T } | { ok: false; error: string };

const SAVE_FAILED = "Não foi possível salvar o cliente. Tente de novo em instantes.";
const LOAD_FAILED = "Não foi possível carregar os clientes.";

/* O que o cartão desenha, e só isso: a ficha inteira por cartão encheria a carga com anotação e etiqueta
   que a grade nem mostra. */
const listColumns = "id, reference, kind, name, email, phone, avatar_url, company, city, active, favorite, created_at";
const fullColumns = `${listColumns}, company_logo_url, role, website, about, tags`;

type ListRow = {
  id: string;
  reference: string;
  kind: Client["kind"];
  name: string;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  company: string | null;
  city: string | null;
  active: boolean;
  favorite: boolean;
  created_at: string;
};

const day = (value: string) => value.slice(0, 10);

/** Texto vazio no formulário é ausência no banco: coluna com string vazia faria todo filtro ter de saber disso. */
const blankToNull = (value: string) => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

function toListItem(row: ListRow, stats: Client["stats"]): ClientListItem {
  return {
    id: row.id,
    reference: row.reference,
    kind: row.kind,
    name: row.name,
    email: row.email,
    phone: row.phone,
    avatarUrl: row.avatar_url,
    createdAt: day(row.created_at),
    company: row.company ?? undefined,
    city: row.city ?? undefined,
    active: row.active,
    favorite: row.favorite,
    stats,
  };
}

const emptyStats = (): Client["stats"] => ({ quotes: 0, projects: 0, billed: 0, open: 0, expenses: 0, spent: 0, payable: 0 });

/**
 * Os números da relação de cada cliente da página: quantos orçamentos, quantos projetos, quanto já foi
 * faturado e quanto está em aberto. Uma consulta para a página inteira, e não uma por cartão: com trinta
 * cartões seriam sessenta idas ao banco para desenhar uma tela.
 */
async function statsFor(client: ClientsClient, organizationId: string, ids: string[]) {
  const stats = new Map<string, Client["stats"]>(ids.map((id) => [id, emptyStats()]));
  if (ids.length === 0) return stats;

  const [quotes, projects, charges] = await Promise.all([
    client
      .from("quotes")
      .select("client_id, status, discount_kind, discount_value, quote_lines(quantity, unit_price, courtesy)")
      .eq("organization_id", organizationId)
      .in("client_id", ids),
    client
      .from("projects")
      .select("client_id")
      .eq("organization_id", organizationId)
      .in("client_id", ids),
    client
      .from("charges")
      .select("client_id, direction, amount, cancelled_at, charge_installments(amount, paid_at)")
      .eq("organization_id", organizationId)
      .in("client_id", ids),
  ]);

  for (const row of quotes.data ?? []) {
    if (!row.client_id) continue;
    const entry = stats.get(row.client_id);
    if (entry) entry.quotes += 1;
  }

  for (const row of projects.data ?? []) {
    /* Projeto independente não é de cliente nenhum e não entra na contagem de ninguém. */
    if (!row.client_id) continue;
    const entry = stats.get(row.client_id);
    if (entry) entry.projects += 1;
  }

  for (const row of charges.data ?? []) {
    if (!row.client_id) continue;
    const entry = stats.get(row.client_id);
    if (!entry) continue;

    const installments = row.charge_installments ?? [];
    const paid = installments.reduce((sum, installment) => sum + (installment.paid_at ? installment.amount : 0), 0);
    if (row.direction === "outgoing") {
      entry.expenses += 1;
      entry.spent += paid;
      if (!row.cancelled_at) entry.payable += row.amount - paid;
    } else {
      entry.billed += paid;
      if (!row.cancelled_at) entry.open += row.amount - paid;
    }
  }

  return stats;
}

/**
 * A página da listagem, filtrada, ordenada e cortada **no banco**: busca, favorito, situação, período e os
 * dois filtros de contato viram condições de SQL, e o total devolvido é o do filtro, que é o que a barra de
 * paginação usa. Filtrar na memória do servidor obrigaria a carregar a base inteira a cada tecla digitada.
 */
export async function listClients(
  client: ClientsClient,
  organizationId: string,
  query: ClientsQuery,
): Promise<ClientsListPage> {
  let builder = client
    .from("clients")
    .select(listColumns, { count: "exact" })
    .eq("organization_id", organizationId);

  builder = query.group === "fornecedores"
    ? builder.in("kind", ["supplier", "both"])
    : builder.in("kind", ["customer", "both"]);

  if (query.search) {
    const term = query.search.replace(/[%,()]/g, " ").trim();
    const digits = query.search.replace(/\D/g, "");
    const conditions = [`name.ilike.%${term}%`, `company.ilike.%${term}%`, `email.ilike.%${term}%`];
    if (digits) conditions.push(`phone.ilike.%${digits}%`);
    builder = builder.or(conditions.join(","));
  }

  if (query.favorite !== "todos") builder = builder.eq("favorite", query.favorite === "favoritos");
  if (query.status !== "todos") builder = builder.eq("active", query.status === "ativos");
  if (query.period !== "sempre") {
    const since = new Date();
    since.setDate(since.getDate() - Number(query.period));
    builder = builder.gte("created_at", since.toISOString());
  }
  if (query.withEmail) builder = builder.not("email", "is", null);
  if (query.withPhone) builder = builder.not("phone", "is", null);

  const start = (query.page - 1) * query.pageSize;
  const { data, count, error } = await builder.order("name").range(start, start + query.pageSize - 1);

  /* Falha do banco não pode virar página vazia: o `cached` guardaria esse vazio por trinta segundos e todo
     o time veria a base sem cadastro nenhum. Lançando, a tela cai no limite de erro, que é o que ela é
     (2026-09-22, na varredura). */
  if (error) throw new Error(dbMessage(error, LOAD_FAILED));

  const rows = (data ?? []) as ListRow[];
  const stats = await statsFor(client, organizationId, rows.map((row) => row.id));

  return {
    items: rows.map((row) => toListItem(row, stats.get(row.id) ?? emptyStats())),
    total: count ?? rows.length,
  };
}

const projectStatus: Record<string, ClientProjectStatus> = {
  active: "ongoing",
  done: "done",
  paused: "paused",
  cancelled: "paused",
};

/**
 * A ficha completa, buscada quando a gaveta abre: o cadastro mais os orçamentos e os projetos do cliente.
 * Não vai junto da listagem de propósito, porque vinte e quatro fichas por página encheriam a carga com o
 * que a grade nem desenha.
 */
export async function getClient(client: ClientsClient, organizationId: string, id: string): Promise<Client | null> {
  const { data } = await client
    .from("clients")
    .select(fullColumns)
    .eq("organization_id", organizationId)
    .eq("id", id)
    .maybeSingle();

  if (!data) return null;

  const [quotes, projects, stats] = await Promise.all([
    client
      .from("quotes")
      .select("id, reference, title, status, issued_at, discount_kind, discount_value, quote_lines(quantity, unit_price, courtesy)")
      .eq("organization_id", organizationId)
      .eq("client_id", id)
      .order("issued_at", { ascending: false })
      .limit(20),
    client
      .from("projects")
      .select("id, reference, name, status, progress, logo_url, hue")
      .eq("organization_id", organizationId)
      .eq("client_id", id)
      .order("started_at", { ascending: false })
      .limit(20),
    statsFor(client, organizationId, [id]),
  ]);

  const clientQuotes: ClientQuote[] = (quotes.data ?? []).map((row) => ({
    id: row.id,
    number: row.reference,
    title: row.title,
    amount: quoteTotals({
      lines: (row.quote_lines ?? []).map((line) => ({ quantity: Number(line.quantity), unitPrice: line.unit_price, courtesy: line.courtesy })),
      discount: row.discount_kind && row.discount_value !== null ? { kind: row.discount_kind, value: row.discount_value } : null,
      installments: 1,
      cashDiscount: 0,
    }).total,
    status: row.status as QuoteStatus,
    date: row.issued_at,
  }));

  const clientProjects: ClientProject[] = (projects.data ?? []).map((row) => ({
    id: row.id,
    reference: row.reference,
    name: row.name,
    status: projectStatus[row.status] ?? "ongoing",
    progress: row.progress,
    logoUrl: row.logo_url,
    hue: row.hue,
  }));

  return {
    id: data.id,
    reference: data.reference,
    kind: data.kind,
    name: data.name,
    email: data.email,
    phone: data.phone,
    avatarUrl: data.avatar_url,
    createdAt: day(data.created_at),
    company: data.company ?? undefined,
    companyLogoUrl: data.company_logo_url,
    role: data.role ?? undefined,
    city: data.city ?? undefined,
    website: data.website ?? undefined,
    about: data.about ?? undefined,
    tags: data.tags ?? [],
    active: data.active,
    favorite: data.favorite,
    stats: stats.get(id) ?? emptyStats(),
    quotes: clientQuotes,
    projects: clientProjects,
  };
}

/** O bloco do painel: quantos clientes a base tem e os últimos a entrar, do mais novo para trás. */
export async function getClientsSummary(
  client: ClientsClient,
  organizationId: string,
  limit = 6,
): Promise<ClientsSummary> {
  const { data, count } = await client
    .from("clients")
    .select(fullColumns, { count: "exact" })
    .eq("organization_id", organizationId)
    .in("kind", ["customer", "both"])
    .order("created_at", { ascending: false })
    .limit(limit);

  const rows = data ?? [];
  const stats = await statsFor(client, organizationId, rows.map((row) => row.id));

  return {
    total: count ?? rows.length,
    clients: rows.map((row) => ({
      ...toListItem(row, stats.get(row.id) ?? emptyStats()),
      companyLogoUrl: row.company_logo_url,
      role: row.role ?? undefined,
      website: row.website ?? undefined,
      about: row.about ?? undefined,
      tags: row.tags ?? [],
      quotes: [],
      projects: [],
    })),
  };
}

/* Os nomes que a pessoa lê no histórico. Só o que ela mesma edita: o que o sistema preenche não é mudança
   dela e só encheria a linha do tempo. */
const historyLabels = {
  kind: "tipo de relação",
  name: "nome",
  company: "empresa",
  role: "área",
  email: "e-mail",
  phone: "telefone",
  website: "site",
  city: "cidade",
  about: "anotações",
  tags: "etiquetas",
  active: "situação",
  favorite: "favorito",
} as const;

/** Criar e editar são o mesmo formulário, então são a mesma escrita: com id atualiza, sem id insere. */
export async function saveClient(
  client: ClientsClient,
  organizationId: string,
  userId: string,
  input: ClientFormInput,
): Promise<ServiceResult<{ id: string }>> {
  const values = {
    organization_id: organizationId,
    name: input.name,
    kind: input.kind,
    company: blankToNull(input.company),
    role: blankToNull(input.role),
    email: blankToNull(input.email.toLowerCase()),
    phone: blankToNull(input.phone),
    website: blankToNull(input.website),
    city: blankToNull(input.city),
    about: blankToNull(input.about),
    tags: input.tags,
    active: input.active,
    favorite: input.favorite,
  };

  if (input.id) {
    /* O que estava, para o histórico dizer o de e o para. Uma leitura a mais só na edição, e só das colunas
       que a pessoa edita. */
    const { data: before } = await client
      .from("clients")
      .select("kind, name, company, role, email, phone, website, city, about, tags, active, favorite")
      .eq("organization_id", organizationId)
      .eq("id", input.id)
      .maybeSingle();

    const { data, error } = await client
      .from("clients")
      .update(values)
      .eq("id", input.id)
      .eq("organization_id", organizationId)
      .select("id")
      .maybeSingle();

    if (error || !data) return { ok: false, error: dbMessage(error, SAVE_FAILED) };

    const changes = diffFields(before, values, historyLabels);
    if (changes.length > 0) {
      await logRecordEvent(client, organizationId, {
        recordType: "client",
        recordId: data.id,
        action: "updated",
        summary: summarize(changes),
        changes,
      });
    }

    return { ok: true, data: { id: data.id } };
  }

  const { data, error } = await client
    .from("clients")
    .insert({ ...values, created_by: userId })
    .select("id, reference")
    .single();

  if (error || !data) return { ok: false, error: dbMessage(error, SAVE_FAILED) };

  await logRecordEvent(client, organizationId, {
    recordType: "client",
    recordId: data.id,
    action: "created",
    summary: `Cadastrou ${input.name}`,
  });

  return { ok: true, data: { id: data.id } };
}

/**
 * Os dois interruptores do leque: ativo e favorito. Escrita própria, e não o formulário inteiro, porque o
 * leque do cartão não tem a ficha em mãos e mandar o resto em branco apagaria o que não foi editado.
 */
export async function setClientFlag(
  client: ClientsClient,
  organizationId: string,
  id: string,
  flag: "active" | "favorite",
  value: boolean,
): Promise<ServiceResult<undefined>> {
  /* A coluna por extenso nos dois casos, e não montada em texto: o tipo gerado do banco recusa chave
     dinâmica, e escrita assim ela é conferida na compilação. */
  const values = flag === "active" ? { active: value } : { favorite: value };

  /* O que estava, para o histórico dizer o de e o para de verdade, como no `saveClient`. Deduzir o anterior
     do que chegou registrava uma mudança que não aconteceu: o leque do cartão manda o valor otimista, e com
     o cartão mostrando estado velho (outra pessoa já favoritou, ou outra aba) o banco não muda nada e o
     histórico contava "favorito: de não para sim" (2026-09-22, na varredura). */
  const { data: before } = await client
    .from("clients")
    .select("active, favorite")
    .eq("organization_id", organizationId)
    .eq("id", id)
    .maybeSingle();

  const { data, error } = await client
    .from("clients")
    .update(values)
    .eq("id", id)
    .eq("organization_id", organizationId)
    .select("name")
    .maybeSingle();

  if (error || !data) return { ok: false, error: dbMessage(error, SAVE_FAILED) };

  const changes =
    flag === "active"
      ? diffFields({ active: before?.active }, { active: value }, { active: historyLabels.active })
      : diffFields({ favorite: before?.favorite }, { favorite: value }, { favorite: historyLabels.favorite });

  /* Interruptor que não mudou nada não vira linha do histórico: a linha do tempo é o que aconteceu. */
  if (changes.length === 0) return { ok: true, data: undefined };

  const summary =
    flag === "active"
      ? value
        ? "Reativou o cliente"
        : "Desativou o cliente"
      : value
        ? "Marcou como favorito"
        : "Tirou dos favoritos";

  await logRecordEvent(client, organizationId, {
    recordType: "client",
    recordId: id,
    action: "updated",
    summary,
    changes,
  });

  return { ok: true, data: undefined };
}

/**
 * Exclui os marcados de uma vez. Cliente com projeto é recusado pelo banco (a chave estrangeira é
 * `restrict`), e a mensagem diz isso em vez de deixar a tela com um erro de driver.
 */
export async function deleteClients(
  client: ClientsClient,
  organizationId: string,
  ids: string[],
): Promise<ServiceResult<{ deleted: number }>> {
  const { data, error } = await client
    .from("clients")
    .delete()
    .eq("organization_id", organizationId)
    .in("id", ids)
    .select("id");

  if (error) {
    if (error.code === "23503") {
      return { ok: false, error: "Há cliente com projeto ligado. Apague ou mova os projetos antes." };
    }
    return { ok: false, error: dbMessage(error, LOAD_FAILED) };
  }

  /* O histórico não tem chave estrangeira para o registro justamente por isto: apagar o cliente não pode
     apagar a prova de que ele existiu e de quem o apagou.

     Os eventos saem juntos, e não um por vez: em série, apagar cem clientes eram cem idas ao banco depois de
     o registro já ter sido removido, mais de três segundos de espera, com risco de a função estourar o tempo
     e deixar parte do lote sem prova (2026-09-22, na varredura). */
  await Promise.all(
    (data ?? []).map((row) =>
      logRecordEvent(client, organizationId, {
        recordType: "client",
        recordId: row.id,
        action: "deleted",
        summary: "Excluiu o cliente",
      }),
    ),
  );

  return { ok: true, data: { deleted: data?.length ?? 0 } };
}

/**
 * Os clientes que os seletores dos outros domínios oferecem, na mesma forma do cartão da listagem: é o que o
 * editor de orçamento desenha, e uma segunda forma só para ele sairia de sincronia na primeira coluna nova.
 * Os números da relação não entram, porque nenhum seletor os mostra.
 *
 * Só quem compra, no mesmo recorte da aba Clientes da listagem: sem isto um contato cadastrado como
 * fornecedor não aparecia em /clientes mas aparecia no seletor do editor de orçamento, e dava para emitir
 * orçamento para ele (2026-09-22, na varredura). Quem precisar dos fornecedores pede o recorte de lá, como
 * o seletor de nova cobrança do financeiro já faz.
 */
export async function listClientOptions(client: ClientsClient, organizationId: string): Promise<ClientListItem[]> {
  const { data } = await client
    .from("clients")
    .select(listColumns)
    .eq("organization_id", organizationId)
    .in("kind", ["customer", "both"])
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(500);

  return ((data ?? []) as ListRow[]).map((row) => toListItem(row, emptyStats()));
}
