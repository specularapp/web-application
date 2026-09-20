import "server-only";
import { addMonths, format, parseISO, startOfMonth, startOfQuarter, startOfYear, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import type { SupabaseClient } from "@supabase/supabase-js";
import { dispatchAutomationEvent } from "@/features/automations/service";
import { listTeamMembers } from "@/features/organizations/service";
import { quoteTotals } from "@/features/quotes/totals";
import { shareCredentials, shareTokenHash } from "@/lib/security/share-token";
import { logRecordEvent } from "@/features/records/history";
import type { Database } from "@/types/database";
import { installmentLabel, recurrenceMonths } from "./labels";
import type { CreateChargeInput, CreateTransactionInput, PayInstallmentInput } from "./schemas";
import { chargeUrl } from "./share";
import {
  chargeStatusOf,
  statusOf,
  todayIso,
  type Charge,
  type ChargeEvent,
  type ChargeMethod,
  type ChargeRecurrence,
  type FinanceMonth,
  type FinanceOverview,
  type FinancePeriod,
  type FinanceSummary,
  type Installment,
  type Transaction,
  type UpcomingInstallment,
} from "./summary";

/** A regra do financeiro contra o banco, na mesma forma dos outros domínios. */
export type FinanceClient = SupabaseClient<Database>;

export type ServiceResult<T> = { ok: true; data: T } | { ok: false; error: string };
export type ChargeResult = { ok: true; charge: Charge } | { ok: false; error: string };
export type SendChargeResult = { ok: true; charge: Charge; reminder: boolean } | { ok: false; error: string };
export type PayResult = { ok: true; charge: Charge; installment: Installment } | { ok: false; error: string };
export type ReportResult =
  | { ok: true; charge: Charge; installment: Installment; teamEmail: string; organizationId: string }
  | { ok: false; error: string };

const columns = `
  id, reference, title, description, client_id, client_name, client_company, client_email,
  client_avatar_url, image_url, recurrence, recurring_from_id, owner_id, amount, method, payment_info, notes, token_version,
  created_at, sent_at, viewed_at, cancelled_at,
  quotes(id, reference),
  contracts(id, reference),
  projects(id, name),
  charge_installments(id, number, amount, due_date, paid_at, paid_method, reported, transaction_id),
  charge_events(id, kind, actor, detail, at)
`;

type Row = {
  id: string;
  reference: string;
  title: string;
  description: string;
  client_id: string | null;
  client_name: string;
  client_company: string | null;
  client_email: string | null;
  client_avatar_url: string | null;
  image_url: string | null;
  recurrence: ChargeRecurrence;
  recurring_from_id: string | null;
  owner_id: string | null;
  amount: number;
  method: ChargeMethod;
  payment_info: string;
  notes: string;
  token_version: number;
  created_at: string;
  sent_at: string | null;
  viewed_at: string | null;
  cancelled_at: string | null;
  quotes: { id: string; reference: string } | null;
  contracts: { id: string; reference: string } | null;
  projects: { id: string; name: string } | null;
  charge_installments: {
    id: string;
    number: number;
    amount: number;
    due_date: string;
    paid_at: string | null;
    paid_method: ChargeMethod | null;
    reported: boolean;
    transaction_id: string | null;
  }[];
  charge_events: { id: string; kind: ChargeEvent["kind"]; actor: string | null; detail: string | null; at: string }[];
};

const isoDate = (date: Date) => format(date, "yyyy-MM-dd");
const day = (offset: number) => {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return isoDate(date);
};

const NOBODY = { name: "Equipe", avatarUrl: null };

function toCharge(row: Row, owner: { name: string; avatarUrl: string | null }): Charge {
  return {
    id: row.id,
    reference: row.reference,
    title: row.title,
    description: row.description,
    /* Sem nome não há contraparte: é a cobrança avulsa, e a tela mostra o título e a foto no lugar. */
    client: row.client_name
      ? {
          id: row.client_id,
          name: row.client_name,
          company: row.client_company ?? undefined,
          email: row.client_email,
          avatarUrl: row.client_avatar_url,
        }
      : null,
    imageUrl: row.image_url,
    recurrence: row.recurrence,
    owner,
    amount: row.amount,
    method: row.method,
    paymentInfo: row.payment_info,
    installments: [...row.charge_installments]
      .sort((a, b) => a.number - b.number)
      .map((installment) => ({
        id: installment.id,
        number: installment.number,
        amount: installment.amount,
        dueDate: installment.due_date,
        paidAt: installment.paid_at,
        paidMethod: installment.paid_method,
        reported: installment.reported,
        transactionId: installment.transaction_id,
      })),
    quote: row.quotes ? { id: row.quotes.id, number: row.quotes.reference } : null,
    contract: row.contracts ? { id: row.contracts.id, reference: row.contracts.reference } : null,
    project: row.projects ? { id: row.projects.id, name: row.projects.name } : null,
    notes: row.notes,
    // O token não é guardado: sai do segredo do servidor mais o id e a versão da linha.
    token: shareCredentials("charge", row.id, row.token_version).token,
    createdAt: row.created_at,
    sentAt: row.sent_at,
    viewedAt: row.viewed_at,
    cancelledAt: row.cancelled_at,
    events: [...row.charge_events]
      .sort((a, b) => a.at.localeCompare(b.at))
      .map((entry) => ({ id: entry.id, kind: entry.kind, actor: entry.actor, at: entry.at, detail: entry.detail })),
  };
}

type TransactionRow = Database["public"]["Tables"]["transactions"]["Row"];

function toTransaction(row: TransactionRow): Transaction {
  return {
    id: row.id,
    reference: row.reference,
    kind: row.kind,
    status: row.status,
    visual:
      row.visual_type === "person"
        ? { type: "person", avatarUrl: row.visual_avatar_url }
        : row.visual_type === "brand" && row.visual_name
          ? { type: "brand", name: row.visual_name }
          : undefined,
    title: row.title,
    description: row.description,
    amount: row.amount,
    date: row.date,
    time: row.time?.slice(0, 5),
    method: row.method_type && row.method_label ? { type: row.method_type, label: row.method_label } : undefined,
    chargeId: row.charge_id ?? undefined,
  };
}

async function ownersOf(client: FinanceClient, organizationId: string) {
  const members = await listTeamMembers(client, organizationId);
  return new Map(members.map((member) => [member.userId, { name: member.name || member.email || "Equipe", avatarUrl: member.avatarUrl }]));
}

export async function listCharges(client: FinanceClient, organizationId: string): Promise<Charge[]> {
  const [{ data }, owners] = await Promise.all([
    client.from("charges").select(columns).eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(500),
    ownersOf(client, organizationId),
  ]);

  return ((data ?? []) as unknown as Row[]).map((row) => toCharge(row, (row.owner_id && owners.get(row.owner_id)) || NOBODY));
}

export async function getCharge(client: FinanceClient, organizationId: string, id: string): Promise<Charge | null> {
  const [{ data }, owners] = await Promise.all([
    client.from("charges").select(columns).eq("organization_id", organizationId).eq("id", id).maybeSingle(),
    ownersOf(client, organizationId),
  ]);

  if (!data) return null;
  const row = data as unknown as Row;
  return toCharge(row, (row.owner_id && owners.get(row.owner_id)) || NOBODY);
}

/** As bases de onde a janela de nova cobrança puxa: os clientes e os orçamentos aprovados ainda sem cobrança. */
export type ChargeLookups = {
  clients: { id: string; name: string; company?: string; email: string | null; avatarUrl: string | null }[];
  quotes: { id: string; number: string; title: string; clientId: string | null; amount: number; installments: number }[];
};

export async function getChargeLookups(client: FinanceClient, organizationId: string): Promise<ChargeLookups> {
  const [clients, quotes, taken] = await Promise.all([
    client.from("clients").select("id, name, company, email, avatar_url").eq("organization_id", organizationId).eq("active", true).order("name"),
    client
      .from("quotes")
      .select("id, reference, title, client_id, installments, discount_kind, discount_value, quote_lines(quantity, unit_price, courtesy)")
      .eq("organization_id", organizationId)
      .eq("status", "approved"),
    client.from("charges").select("quote_id").eq("organization_id", organizationId).not("quote_id", "is", null),
  ]);

  const used = new Set((taken.data ?? []).map((row) => row.quote_id));

  return {
    clients: (clients.data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      company: row.company ?? undefined,
      email: row.email,
      avatarUrl: row.avatar_url,
    })),
    quotes: (quotes.data ?? [])
      .filter((quote) => !used.has(quote.id))
      .map((quote) => ({
        id: quote.id,
        number: quote.reference,
        title: quote.title,
        clientId: quote.client_id,
        amount: quoteTotals({
          lines: (quote.quote_lines ?? []).map((line) => ({ quantity: Number(line.quantity), unitPrice: line.unit_price, courtesy: line.courtesy })),
          discount: quote.discount_kind && quote.discount_value !== null ? { kind: quote.discount_kind, value: quote.discount_value } : null,
          installments: 1,
          cashDiscount: 0,
        }).total,
        installments: quote.installments,
      })),
  };
}

/* O total repartido em parcelas iguais, com o que sobra da divisão na última, para a soma bater no centavo. */
function splitAmount(total: number, count: number) {
  const base = Math.floor(total / count);
  return Array.from({ length: count }, (_, index) => base + (index === count - 1 ? total - base * count : 0));
}

const methodLabels: Record<ChargeMethod, string> = {
  pix: "Pix",
  card: "Cartão",
  boleto: "Boleto",
  transfer: "Transferência bancária",
};

/** Cria a cobrança e as parcelas na mesma transação lógica: a soma das duas é conferida pelo banco. */
export async function createCharge(
  client: FinanceClient,
  organizationId: string,
  userId: string,
  input: CreateChargeInput,
): Promise<ChargeResult> {
  /* Sem cliente é a cobrança avulsa, e aí não há ninguém para buscar: quem dá nome a ela é o título. */
  const { data: contact } = input.clientId
    ? await client
        .from("clients")
        .select("id, name, company, email, avatar_url")
        .eq("organization_id", organizationId)
        .eq("id", input.clientId)
        .maybeSingle()
    : { data: null };

  if (input.clientId && !contact) return { ok: false, error: "Esse cliente não está mais na base." };

  const id = crypto.randomUUID();
  const { hash } = shareCredentials("charge", id);

  const { error } = await client.from("charges").insert({
    id,
    organization_id: organizationId,
    title: input.title,
    description: input.description,
    client_id: contact?.id ?? null,
    client_name: contact?.name ?? null,
    client_company: contact?.company ?? null,
    client_email: contact?.email ?? null,
    client_avatar_url: contact?.avatar_url ?? null,
    owner_id: userId,
    amount: input.amount,
    method: input.method,
    payment_info: input.paymentInfo,
    notes: input.notes,
    quote_id: input.quoteId,
    recurrence: input.recurrence,
    token_hash: hash,
  });

  if (error) return { ok: false, error: error.message };

  const { error: installmentsError } = await client.from("charge_installments").insert(
    splitAmount(input.amount, input.installments).map((amount, index) => ({
      organization_id: organizationId,
      charge_id: id,
      number: index + 1,
      amount,
      due_date: isoDate(addMonths(parseISO(input.firstDueDate), index)),
    })),
  );

  if (installmentsError) {
    await client.from("charges").delete().eq("id", id);
    return { ok: false, error: installmentsError.message };
  }

  await client.from("charge_events").insert({ organization_id: organizationId, charge_id: id, kind: "created" });
  await logRecordEvent(client, organizationId, { recordType: "charge", recordId: id, action: "created", summary: `Criou a cobrança ${input.title}` });

  const charge = await getCharge(client, organizationId, id);
  return charge ? { ok: true, charge } : { ok: false, error: "Não foi possível criar a cobrança." };
}

/** O que uma cobrança conta às automações, nos nomes que as variáveis do fluxo usam. */
function automationContext(charge: Charge) {
  const next = charge.installments.find((installment) => !installment.paidAt);
  return {
    /* Na cobrança avulsa não há cliente: as variáveis do fluxo recebem o título no lugar do nome, para um
       modelo de e-mail não escrever "Olá, " e parar. */
    cliente: {
      nome: charge.client?.name ?? charge.title,
      primeiro_nome: (charge.client?.name ?? charge.title).split(" ")[0] ?? "",
      email: charge.client?.email ?? "",
      empresa: charge.client?.company ?? charge.client?.name ?? charge.title,
    },
    cobranca: {
      numero: charge.reference,
      valor: String(charge.amount),
      valor_centavos: charge.amount,
      vencimento: next?.dueDate ?? "",
      situacao: chargeStatusOf(charge),
      link: chargeUrl(charge.token),
    },
  };
}

export async function sendCharge(
  client: FinanceClient,
  organizationId: string,
  id: string,
  actor: string,
): Promise<SendChargeResult> {
  const charge = await getCharge(client, organizationId, id);
  if (!charge) return { ok: false, error: "Essa cobrança não existe mais." };
  if (charge.cancelledAt) return { ok: false, error: "Essa cobrança foi cancelada." };
  if (!charge.client) return { ok: false, error: "Cobrança avulsa não tem para quem mandar. Copie o link e envie por onde quiser." };
  if (!charge.client.email) return { ok: false, error: "O cliente não tem e-mail cadastrado." };

  const reminder = Boolean(charge.sentAt);

  const { error } = await client
    .from("charges")
    .update({ sent_at: reminder ? charge.sentAt : new Date().toISOString() })
    .eq("id", id)
    .eq("organization_id", organizationId);

  if (error) return { ok: false, error: error.message };

  await client.from("charge_events").insert({
    organization_id: organizationId,
    charge_id: id,
    kind: reminder ? "resent" : "sent",
    actor,
  });

  const sent = await getCharge(client, organizationId, id);
  if (!sent) return { ok: false, error: "Não foi possível enviar a cobrança." };

  return { ok: true, charge: sent, reminder };
}

/**
 * Baixa uma parcela: marca o pagamento e cria a entrada nas movimentações, que é o que faz a cobrança e o
 * caixa baterem. A entrada nasce aqui, e não numa segunda tela, porque parcela paga sem entrada seria caixa
 * mentindo para sempre.
 */
export async function payInstallment(
  client: FinanceClient,
  organizationId: string,
  userId: string,
  input: PayInstallmentInput,
): Promise<PayResult> {
  const charge = await getCharge(client, organizationId, input.id);
  if (!charge) return { ok: false, error: "Essa cobrança não existe mais." };
  if (charge.cancelledAt) return { ok: false, error: "Essa cobrança foi cancelada." };

  const installment = charge.installments.find((entry) => entry.id === input.installmentId);
  if (!installment) return { ok: false, error: "Essa parcela não existe mais." };
  if (installment.paidAt) return { ok: false, error: "Essa parcela já foi baixada." };

  const method = input.method ?? charge.method;
  const paidOn = input.paidOn ?? todayIso();

  const { data: transaction, error: transactionError } = await client
    .from("transactions")
    .insert({
      organization_id: organizationId,
      kind: "income",
      status: "confirmed",
      title: charge.client?.company ?? charge.client?.name ?? charge.title,
      description: `${installmentLabel(installment.number, charge.installments.length)} de ${charge.title}`,
      amount: installment.amount,
      date: paidOn,
      method_type: method,
      method_label: methodLabels[method],
      visual_type: "person",
      visual_avatar_url: charge.client?.avatarUrl ?? charge.imageUrl,
      charge_id: charge.id,
      created_by: userId,
    })
    .select("id")
    .single();

  if (transactionError || !transaction) return { ok: false, error: transactionError?.message || "Não foi possível registrar a entrada." };

  const { error } = await client
    .from("charge_installments")
    .update({ paid_at: `${paidOn}T12:00:00Z`, paid_method: method, reported: false, transaction_id: transaction.id })
    .eq("id", installment.id)
    .eq("organization_id", organizationId);

  if (error) {
    await client.from("transactions").delete().eq("id", transaction.id);
    return { ok: false, error: error.message };
  }

  await client.from("charge_events").insert({
    organization_id: organizationId,
    charge_id: charge.id,
    kind: "paid",
    detail: `Parcela ${installment.number}`,
  });

  const updated = await getCharge(client, organizationId, charge.id);
  if (!updated) return { ok: false, error: "Não foi possível baixar a parcela." };

  void dispatchAutomationEvent(organizationId, "payment_received", automationContext(updated)).catch(() => undefined);

  /* Quitada a última parcela, a próxima do ciclo nasce. É aqui, e não num relógio: a casa ainda não tem um,
     e amarrar a repetição ao fechamento tem uma vantagem própria: nunca se acumulam doze cobranças abertas
     de uma assinatura que a pessoa parou de pagar. */
  await spawnNextRecurrence(client, organizationId, userId, updated);

  const saved = updated.installments.find((entry) => entry.id === installment.id)!;
  return { ok: true, charge: updated, installment: saved };
}

/**
 * A próxima cobrança de uma série recorrente, com o vencimento adiantado de um ciclo. Só nasce quando a
 * anterior fecha por inteiro, e só uma vez: a trava é o índice único de `recurring_from_id`, e não um `if`
 * daqui, que duas abas abertas ao mesmo tempo furariam.
 */
async function spawnNextRecurrence(client: FinanceClient, organizationId: string, userId: string, charge: Charge) {
  if (charge.recurrence === "none") return;
  if (charge.installments.some((installment) => !installment.paidAt)) return;

  const months = recurrenceMonths[charge.recurrence];
  const id = crypto.randomUUID();
  const { hash } = shareCredentials("charge", id);

  const { error } = await client.from("charges").insert({
    id,
    organization_id: organizationId,
    title: charge.title,
    description: charge.description,
    client_id: charge.client?.id ?? null,
    client_name: charge.client?.name ?? null,
    client_company: charge.client?.company ?? null,
    client_email: charge.client?.email ?? null,
    client_avatar_url: charge.client?.avatarUrl ?? null,
    image_url: charge.imageUrl,
    owner_id: userId,
    amount: charge.amount,
    method: charge.method,
    payment_info: charge.paymentInfo,
    notes: charge.notes,
    recurrence: charge.recurrence,
    recurring_from_id: charge.id,
    token_hash: hash,
  });

  /* Já existia a próxima desta: o índice único barrou, e não há nada a corrigir. */
  if (error) return;

  const first = charge.installments[0];
  const base = first ? parseISO(first.dueDate) : new Date();

  await client.from("charge_installments").insert(
    charge.installments.map((installment, index) => ({
      organization_id: organizationId,
      charge_id: id,
      number: installment.number,
      amount: installment.amount,
      due_date: isoDate(addMonths(base, months + index)),
    })),
  );

  await client.from("charge_events").insert({
    organization_id: organizationId,
    charge_id: id,
    kind: "created",
    detail: `Repetição de ${charge.reference}`,
  });
}

/** Desfaz a baixa: apaga a entrada que ela gerou, senão o caixa ficaria com dinheiro que não entrou. */
export async function reopenInstallment(
  client: FinanceClient,
  organizationId: string,
  id: string,
  installmentId: string,
): Promise<PayResult> {
  const charge = await getCharge(client, organizationId, id);
  if (!charge) return { ok: false, error: "Essa cobrança não existe mais." };

  const installment = charge.installments.find((entry) => entry.id === installmentId);
  if (!installment) return { ok: false, error: "Essa parcela não existe mais." };
  if (!installment.paidAt) return { ok: false, error: "Essa parcela ainda está em aberto." };

  if (installment.transactionId) {
    await client.from("transactions").delete().eq("id", installment.transactionId).eq("organization_id", organizationId);
  }

  const { error } = await client
    .from("charge_installments")
    .update({ paid_at: null, paid_method: null, transaction_id: null })
    .eq("id", installmentId)
    .eq("organization_id", organizationId);

  if (error) return { ok: false, error: error.message };

  await client.from("charge_events").insert({
    organization_id: organizationId,
    charge_id: id,
    kind: "reopened",
    detail: `Parcela ${installment.number}`,
  });

  const updated = await getCharge(client, organizationId, id);
  if (!updated) return { ok: false, error: "Não foi possível reabrir a parcela." };

  return { ok: true, charge: updated, installment: updated.installments.find((entry) => entry.id === installmentId)! };
}

export async function cancelCharge(
  client: FinanceClient,
  organizationId: string,
  id: string,
  actor: string,
): Promise<ChargeResult> {
  const charge = await getCharge(client, organizationId, id);
  if (!charge) return { ok: false, error: "Essa cobrança não existe mais." };
  if (charge.installments.some((installment) => installment.paidAt)) {
    return { ok: false, error: "Essa cobrança já teve parcela paga e não pode ser cancelada." };
  }

  const { error } = await client
    .from("charges")
    .update({ cancelled_at: new Date().toISOString() })
    .eq("id", id)
    .eq("organization_id", organizationId);

  if (error) return { ok: false, error: error.message };

  await client.from("charge_events").insert({ organization_id: organizationId, charge_id: id, kind: "cancelled", actor });
  await logRecordEvent(client, organizationId, { recordType: "charge", recordId: id, action: "archived", summary: "Cancelou a cobrança" });

  const cancelled = await getCharge(client, organizationId, id);
  return cancelled ? { ok: true, charge: cancelled } : { ok: false, error: "Não foi possível cancelar." };
}

/** Uma movimentação avulsa: o que entrou ou saiu sem passar por cobrança. */
export async function createTransaction(
  client: FinanceClient,
  organizationId: string,
  userId: string,
  input: CreateTransactionInput,
): Promise<ServiceResult<Transaction>> {
  const { data, error } = await client
    .from("transactions")
    .insert({
      organization_id: organizationId,
      kind: input.kind,
      status: "confirmed",
      title: input.title,
      description: input.description,
      amount: input.amount,
      date: input.date,
      method_type: input.method,
      method_label: input.method ? methodLabels[input.method] : null,
      created_by: userId,
    })
    .select("*")
    .single();

  if (error || !data) return { ok: false, error: error?.message || "Não foi possível registrar a movimentação." };
  return { ok: true, data: toTransaction(data) };
}

/* Uma parcela por vencer como movimentação prevista, para a lista do painel e o filtro "Previstas". */
function scheduledOf(entry: UpcomingInstallment): Transaction {
  return {
    id: `sched-${entry.installmentId}`,
    reference: entry.reference,
    kind: "scheduled",
    visual: { type: "person", avatarUrl: entry.clientAvatarUrl },
    /* Na avulsa quem dá nome à movimentação é o título da cobrança: ela não é de ninguém da base, e repetir
       o título embaixo diria a mesma coisa duas vezes. */
    title: entry.clientName ?? entry.title,
    description: entry.clientName
      ? `${installmentLabel(entry.number, entry.total)} de ${entry.title}`
      : installmentLabel(entry.number, entry.total),
    amount: entry.amount,
    date: entry.dueDate,
    chargeId: entry.chargeId,
  };
}

/** As parcelas em aberto de toda a base, do vencimento mais próximo para o mais distante. */
async function upcomingOf(client: FinanceClient, organizationId: string, today: string): Promise<UpcomingInstallment[]> {
  const { data } = await client
    .from("charge_installments")
    .select("id, number, amount, due_date, reported, charges!inner(id, reference, title, client_name, client_company, client_avatar_url, cancelled_at, charge_installments(id))")
    .eq("organization_id", organizationId)
    .is("paid_at", null)
    .order("due_date");

  return (data ?? [])
    .filter((row) => !row.charges.cancelled_at)
    .map((row) => ({
      chargeId: row.charges.id,
      installmentId: row.id,
      reference: row.charges.reference,
      title: row.charges.title,
      clientName: row.charges.client_company ?? row.charges.client_name,
      clientAvatarUrl: row.charges.client_avatar_url,
      number: row.number,
      total: row.charges.charge_installments.length,
      amount: row.amount,
      dueDate: row.due_date,
      overdue: row.due_date < today,
      reported: row.reported,
    }));
}

function periodStart(period: FinancePeriod) {
  const today = new Date();
  if (period === "mes") return isoDate(startOfMonth(today));
  if (period === "trimestre") return isoDate(startOfQuarter(today));
  if (period === "ano") return isoDate(startOfYear(today));
  return null;
}

/** O saldo em caixa: o que havia antes de a base começar, mais tudo que entrou, menos tudo que saiu. */
async function balanceOf(client: FinanceClient, organizationId: string) {
  const [{ data: settings }, { data: rows }] = await Promise.all([
    client.from("finance_settings").select("opening_balance").eq("organization_id", organizationId).maybeSingle(),
    client.from("transactions").select("kind, amount, status").eq("organization_id", organizationId).eq("status", "confirmed"),
  ]);

  return (rows ?? []).reduce(
    (sum, row) => sum + (row.kind === "income" ? row.amount : row.kind === "expense" ? -row.amount : 0),
    settings?.opening_balance ?? 0,
  );
}

const sortTransactions = (list: Transaction[]) =>
  [...list].sort((a, b) => (a.date === b.date ? (b.time ?? "").localeCompare(a.time ?? "") : b.date.localeCompare(a.date)));

export async function getFinanceOverview(
  client: FinanceClient,
  organizationId: string,
  period: FinancePeriod,
): Promise<FinanceOverview> {
  const today = todayIso();
  const start = periodStart(period);
  const sixMonthsAgo = isoDate(subMonths(startOfMonth(new Date()), 5));

  const [balance, pending, { data: all }] = await Promise.all([
    balanceOf(client, organizationId),
    upcomingOf(client, organizationId, today),
    client
      .from("transactions")
      .select("*")
      .eq("organization_id", organizationId)
      .gte("date", start && start < sixMonthsAgo ? start : sixMonthsAgo)
      .order("date", { ascending: false })
      .limit(1000),
  ]);

  const transactions = (all ?? []).map(toTransaction);
  const inPeriod = (transaction: Transaction) => !start || transaction.date >= start;
  const confirmed = transactions.filter((transaction) => statusOf(transaction) === "confirmed" && inPeriod(transaction));
  const incomes = confirmed.filter((transaction) => transaction.kind === "income");
  const expenses = confirmed.filter((transaction) => transaction.kind === "expense");

  const months: FinanceMonth[] = Array.from({ length: 6 }, (_, index) => {
    const date = subMonths(startOfMonth(new Date()), 5 - index);
    const month = format(date, "yyyy-MM");
    const inMonth = transactions.filter((transaction) => statusOf(transaction) === "confirmed" && transaction.date.startsWith(month));
    return {
      month,
      label: format(date, "MMM", { locale: ptBR }).replace(".", ""),
      income: inMonth.filter((transaction) => transaction.kind === "income").reduce((sum, transaction) => sum + transaction.amount, 0),
      expense: inMonth.filter((transaction) => transaction.kind === "expense").reduce((sum, transaction) => sum + transaction.amount, 0),
    };
  });

  const late = pending.filter((entry) => entry.overdue);
  const upcoming = pending.filter((entry) => !entry.overdue && entry.dueDate <= day(30));

  return {
    period,
    balance,
    received: incomes.reduce((sum, transaction) => sum + transaction.amount, 0),
    receivedCount: incomes.length,
    expenses: expenses.reduce((sum, transaction) => sum + transaction.amount, 0),
    expensesCount: expenses.length,
    receivable: pending.reduce((sum, entry) => sum + entry.amount, 0),
    receivableCount: pending.length,
    overdue: late.reduce((sum, entry) => sum + entry.amount, 0),
    overdueCount: late.length,
    months,
    transactions: sortTransactions([...upcoming.slice(0, 6).map(scheduledOf), ...transactions.filter(inPeriod)]),
    upcoming: upcoming.slice(0, 8),
    late: late.slice(0, 8),
  };
}

/** O que o bloco do painel mostra: o caixa e as últimas movimentações, com o que vence logo no topo. */
export async function getFinanceSummary(client: FinanceClient, organizationId: string): Promise<FinanceSummary> {
  const today = todayIso();
  const [balance, pending, { data }] = await Promise.all([
    balanceOf(client, organizationId),
    upcomingOf(client, organizationId, today),
    client.from("transactions").select("*").eq("organization_id", organizationId).order("date", { ascending: false }).limit(10),
  ]);

  const soon = pending.filter((entry) => !entry.overdue && entry.dueDate <= day(7)).slice(0, 2).map(scheduledOf);
  return { balance, transactions: [...soon, ...(data ?? []).map(toTransaction)] };
}

/** A cobrança por trás de um link público, pela função do banco com a chave secreta. */
export async function getChargeByToken(admin: FinanceClient, token: string) {
  const { data } = await admin.rpc("charge_by_token", { p_token_hash: shareTokenHash(token) });
  if (!data) return null;

  const payload = data as unknown as {
    charge: Omit<Row, "charge_installments" | "charge_events" | "quotes" | "contracts" | "projects"> & { organization_id: string };
    installments: Row["charge_installments"];
    issuer: { name: string; logoUrl: string | null; email?: string; phone?: string; city?: string };
  };

  const row = {
    ...payload.charge,
    notes: "",
    quotes: null,
    contracts: null,
    projects: null,
    charge_installments: payload.installments,
    charge_events: [],
  } as Row;

  return {
    charge: toCharge(row, { name: payload.issuer.name, avatarUrl: payload.issuer.logoUrl }),
    issuer: payload.issuer,
    organizationId: payload.charge.organization_id,
  };
}

export async function markChargeViewed(admin: FinanceClient, token: string) {
  await admin.rpc("mark_charge_viewed", { p_token_hash: shareTokenHash(token) });
}

/**
 * "Já paguei" pelo link: marca a parcela como avisada, e só isso. Quem baixa o pagamento é a equipe, que é
 * o que mantém o caixa contando dinheiro conferido.
 */
export async function reportPayment(admin: FinanceClient, token: string, installmentId: string): Promise<ReportResult> {
  const { data: reported } = await admin.rpc("report_installment_paid", {
    p_token_hash: shareTokenHash(token),
    p_installment_id: installmentId,
  });

  if (!reported) return { ok: false, error: "Não foi possível registrar o aviso." };

  const found = await getChargeByToken(admin, token);
  if (!found) return { ok: false, error: "Não foi possível registrar o aviso." };

  const installment = found.charge.installments.find((entry) => entry.id === installmentId);
  if (!installment) return { ok: false, error: "Essa parcela não existe mais." };

  const members = await listTeamMembers(admin, found.organizationId);
  const teamEmail = members.find((member) => member.role === "owner")?.email ?? members[0]?.email ?? "";

  return { ok: true, charge: found.charge, installment, teamEmail, organizationId: found.organizationId };
}

/**
 * Encerra a série recorrente: a cobrança de agora continua valendo até ser quitada, mas a próxima não nasce
 * mais. É a única forma de parar uma assinatura sem cancelar o que já está em aberto, que é o que a pessoa
 * quer quando o cliente avisa que vai parar no mês que vem.
 */
export async function stopRecurrence(client: FinanceClient, organizationId: string, id: string): Promise<ChargeResult> {
  const { data, error } = await client
    .from("charges")
    .update({ recurrence: "none" })
    .eq("id", id)
    .eq("organization_id", organizationId)
    .select("id")
    .maybeSingle();

  if (error || !data) return { ok: false, error: error?.message || "Não foi possível encerrar a recorrência." };

  await logRecordEvent(client, organizationId, { recordType: "charge", recordId: id, action: "updated", summary: "Encerrou a recorrência" });

  const charge = await getCharge(client, organizationId, id);
  return charge ? { ok: true, charge } : { ok: false, error: "Não foi possível encerrar a recorrência." };
}
