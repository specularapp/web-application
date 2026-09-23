import "server-only";
import { houseDayWithOffset } from "@/lib/utils/day";
import { dbMessage, type DbError } from "@/lib/db/message";
import { addMonths, format, parseISO, startOfMonth, startOfQuarter, startOfYear, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import type { SupabaseClient } from "@supabase/supabase-js";
import { dispatchAutomationEvent } from "@/features/automations/service";
import { listTeamMembers } from "@/features/organizations/service";
import { quoteTotals } from "@/features/quotes/totals";
import { shareCredentials, shareTokenHash } from "@/lib/security/share-token";
import { logRecordEvent } from "@/features/records/history";
import type { Database } from "@/types/database";
import { chargeDirections, installmentLabel, recurrenceMonths } from "./labels";
import type { CreateChargeInput, CreateTransactionInput, PayInstallmentInput } from "./schemas";
import { chargeUrl } from "./share";
import {
  chargeStatusOf,
  statusOf,
  todayIso,
  type Charge,
  type ChargeDirection,
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
export type PayResult = { ok: true; charge: Charge; installment: Installment; warning?: string } | { ok: false; error: string };
export type ReportResult =
  | { ok: true; charge: Charge; installment: Installment; teamEmail: string; organizationId: string }
  | { ok: false; error: string };

const columns = `
  id, reference, direction, title, description, client_id, client_name, client_company, client_email,
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
  direction: ChargeDirection;
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

/* O deslocamento em dias sai do fuso da casa, como todo "hoje" deste domínio. */
const day = (offset: number) => houseDayWithOffset(offset);

const NOBODY = { name: "Equipe", avatarUrl: null };

/**
 * Toda leitura que vira número de dinheiro na tela passa por aqui antes.
 *
 * Falha de consulta não pode virar zero: uma negativa de RLS ou um tempo esgotado devolvia `data: null`, o
 * `(rows ?? [])` absorvia, e a prancha abria inteira dizendo "Em caixa R$ 0,00" e "Nenhuma parcela vencida.
 * Ótimo sinal." com o financeiro real intacto do outro lado. Pior ainda com o `cached` por cima, que
 * guardaria esse vazio por um minuto para todo o time. Lançando, a rota cai no limite de erro, que é o que
 * ela é (2026-09-22, na varredura, na mesma regra de `clients/service.ts`).
 */
function ensureRead(error: DbError | null) {
  if (error) throw new Error(dbMessage(error, "Não foi possível ler o financeiro agora. Tente de novo em instantes."));
}

function toCharge(row: Row, owner: { name: string; avatarUrl: string | null }): Charge {
  return {
    id: row.id,
    reference: row.reference,
    direction: row.direction,
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
  const [{ data, error }, owners] = await Promise.all([
    client.from("charges").select(columns).eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(500),
    ownersOf(client, organizationId),
  ]);

  ensureRead(error);

  return ((data ?? []) as unknown as Row[]).map((row) => toCharge(row, (row.owner_id && owners.get(row.owner_id)) || NOBODY));
}

export async function getCharge(client: FinanceClient, organizationId: string, id: string): Promise<Charge | null> {
  const [{ data, error }, owners] = await Promise.all([
    client.from("charges").select(columns).eq("organization_id", organizationId).eq("id", id).maybeSingle(),
    ownersOf(client, organizationId),
  ]);

  /* Falha de leitura não é cobrança inexistente: sem isto, uma negativa de RLS ou um tempo esgotado devolvia
     `null` e a ficha abria como 404, dizendo que o registro não existe mais. */
  ensureRead(error);

  if (!data) return null;
  const row = data as unknown as Row;
  return toCharge(row, (row.owner_id && owners.get(row.owner_id)) || NOBODY);
}

/** As bases de onde a janela de nova cobrança puxa: os clientes e os orçamentos aprovados ainda sem cobrança. */
export type ChargeLookups = {
  customers: { id: string; name: string; company?: string; email: string | null; avatarUrl: string | null }[];
  suppliers: { id: string; name: string; company?: string; email: string | null; avatarUrl: string | null }[];
  quotes: { id: string; number: string; title: string; clientId: string | null; amount: number; installments: number }[];
};

export async function getChargeLookups(client: FinanceClient, organizationId: string): Promise<ChargeLookups> {
  const [clients, quotes, taken] = await Promise.all([
    client.from("clients").select("id, kind, name, company, email, avatar_url").eq("organization_id", organizationId).eq("active", true).order("name"),
    client
      .from("quotes")
      .select("id, reference, title, client_id, installments, discount_kind, discount_value, quote_lines(quantity, unit_price, courtesy)")
      .eq("organization_id", organizationId)
      .eq("status", "approved"),
    client.from("charges").select("quote_id").eq("organization_id", organizationId).not("quote_id", "is", null),
  ]);

  /* As três contam: com o erro engolido, a janela abria sem contato nenhum, sem orçamento nenhum, ou pior,
     com a lista de já cobrados vazia, reoferecendo orçamento que já tem cobrança. */
  ensureRead(clients.error);
  ensureRead(quotes.error);
  ensureRead(taken.error);

  const used = new Set((taken.data ?? []).map((row) => row.quote_id));

  const contacts = (clients.data ?? []).map((row) => ({
      id: row.id,
      kind: row.kind,
      name: row.name,
      company: row.company ?? undefined,
      email: row.email,
      avatarUrl: row.avatar_url,
    }));

  return {
    customers: contacts.filter((contact) => contact.kind === "customer" || contact.kind === "both"),
    suppliers: contacts.filter((contact) => contact.kind === "supplier" || contact.kind === "both"),
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
  /* Sem cliente é a avulsa, e aí não há ninguém para buscar: quem dá nome a ela é o título, ou o nome
     digitado. É o caso de quase toda despesa, porque fornecedor não é cliente e não tem por que entrar na
     base de clientes para uma assinatura ser paga. */
  const { data: contact } = input.clientId
    ? await client
        .from("clients")
        .select("id, kind, name, company, email, avatar_url")
        .eq("organization_id", organizationId)
        .eq("id", input.clientId)
        .maybeSingle()
    : { data: null };

  if (input.clientId && !contact) return { ok: false, error: "Esse contato não está mais na base." };
  if (contact && input.direction === "incoming" && contact.kind === "supplier") return { ok: false, error: "Escolha um contato cadastrado como cliente." };
  if (contact && input.direction === "outgoing" && contact.kind === "customer") return { ok: false, error: "Escolha um contato cadastrado como fornecedor." };

  /* O orçamento é conferido contra o banco como o contato (2026-09-22, na varredura). A janela esconder o
     orçamento já cobrado é filtro de leitura, e filtro de leitura não é trava: dois POST na rota, ou duas
     abas abertas dentro do minuto de cache, cobravam duas vezes o mesmo orçamento aprovado, e dava para
     cobrar um rascunho ou um recusado, que a janela nunca ofereceria. A trava que vale para as duas abas e
     para o aplicativo é o índice único de `quote_id`; esta conferência existe para a recusa ter texto. */
  if (input.quoteId) {
    const { data: quote, error: quoteError } = await client
      .from("quotes")
      .select("id, status")
      .eq("organization_id", organizationId)
      .eq("id", input.quoteId)
      .maybeSingle();

    if (quoteError) return { ok: false, error: dbMessage(quoteError, "Não foi possível conferir o orçamento.") };
    if (!quote) return { ok: false, error: "Esse orçamento não está mais na base." };
    if (quote.status !== "approved") return { ok: false, error: "Só orçamento aprovado pode virar cobrança." };
  }

  const noun = chargeDirections[input.direction].label.toLocaleLowerCase("pt-BR");
  const id = crypto.randomUUID();
  const { hash } = shareCredentials("charge", id);

  const { error } = await client.from("charges").insert({
    id,
    organization_id: organizationId,
    title: input.title,
    description: input.description,
    direction: input.direction,
    client_id: contact?.id ?? null,
    client_name: contact?.name ?? (input.partyName || null),
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

  /* O índice único barrou: outra aba, ou o aplicativo, cobrou este orçamento primeiro. */
  if (error && error.code === "23505" && input.quoteId) return { ok: false, error: "Esse orçamento já tem cobrança." };
  if (error) return { ok: false, error: dbMessage(error, "Não foi possível concluir a operação. Tente de novo em instantes.") };

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
    /* Desfazer é obrigatório, e o desfazer precisa ser conferido (2026-09-22, na varredura): cobrança sem
       nenhuma parcela lê como **paga** na lista, porque a situação sai das parcelas, e ao mesmo tempo soma o
       valor cheio no que há a receber. Se nem o desfazer funcionar, quem está olhando tem de saber que ficou
       registro pela metade, em vez de ler só "não foi possível". */
    const { error: undoError } = await client.from("charges").delete().eq("id", id).eq("organization_id", organizationId);
    if (undoError) {
      return { ok: false, error: `Não foi possível criar as parcelas, e a ${noun} ficou incompleta na base. Avise quem administra a equipe antes de criar outra.` };
    }

    return { ok: false, error: dbMessage(installmentsError, "Não foi possível criar as parcelas.") };
  }

  await client.from("charge_events").insert({ organization_id: organizationId, charge_id: id, kind: "created" });
  await logRecordEvent(client, organizationId, { recordType: "charge", recordId: id, action: "created", summary: `Criou a ${noun} ${input.title}` });

  const charge = await getCharge(client, organizationId, id);
  return charge ? { ok: true, charge } : { ok: false, error: `Não foi possível criar a ${noun}.` };
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

/* Enviar é coisa de cobrança: o link existe para o cliente ver o que deve e avisar que pagou, e do lado de
   cá quem paga é a própria equipe. O banco recusa de novo, pelo `charges_outgoing_not_shared`. */
export async function sendCharge(
  client: FinanceClient,
  organizationId: string,
  id: string,
  actor: string,
): Promise<SendChargeResult> {
  const charge = await getCharge(client, organizationId, id);
  if (!charge) return { ok: false, error: "Essa cobrança não existe mais." };
  if (charge.direction === "outgoing") return { ok: false, error: "Despesas são internas e não têm link de cobrança." };
  if (charge.cancelledAt) return { ok: false, error: "Essa cobrança foi cancelada." };
  if (!charge.client) return { ok: false, error: "Cobrança avulsa não tem para quem mandar. Copie o link e envie por onde quiser." };
  if (!charge.client.email) return { ok: false, error: "O cliente não tem e-mail cadastrado." };

  const reminder = Boolean(charge.sentAt);

  const { error } = await client
    .from("charges")
    .update({ sent_at: reminder ? charge.sentAt : new Date().toISOString() })
    .eq("id", id)
    .eq("organization_id", organizationId);

  if (error) return { ok: false, error: dbMessage(error, "Não foi possível concluir a operação. Tente de novo em instantes.") };

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

  /* **O sinal sai da direção** (2026-09-20): baixar a parcela de uma despesa tira do caixa, e não põe. É o
     único ponto em que as duas direções divergem de fato; todo o resto (parcela, vencimento, situação,
     linha do tempo, recorrência) é a mesma regra para as duas. */
  const outgoing = charge.direction === "outgoing";

  const { error } = await client.rpc("change_charge_payment", {
    p_organization_id: organizationId,
    p_charge_id: charge.id,
    p_operation: "pay",
    p_installment_id: installment.id,
    p_method: input.method ?? charge.method,
    /* Sem data escolhida, a chave nem vai: quem decide é a função do banco, que usa o fuso da casa. */
    ...(input.paidOn ? { p_paid_on: input.paidOn } : {}),
  });
  if (error) return { ok: false, error: dbMessage(error, "Não foi possível concluir a operação. Tente de novo em instantes.") };

  const updated = await getCharge(client, organizationId, charge.id);
  if (!updated) return { ok: false, error: "Não foi possível baixar a parcela." };

  /* O fluxo de "pagamento recebido" é do dinheiro que entra: disparar nele a baixa de uma despesa mandaria
     o agradecimento ao fornecedor que a equipe acabou de pagar. */
  if (!outgoing) void dispatchAutomationEvent(organizationId, "payment_received", automationContext(updated)).catch(() => undefined);

  /* Quitada a última parcela, a próxima do ciclo nasce. É aqui, e não num relógio: a casa ainda não tem um,
     e amarrar a repetição ao fechamento tem uma vantagem própria: nunca se acumulam doze cobranças abertas
     de uma assinatura que a pessoa parou de pagar. */
  const warning = await spawnNextRecurrence(client, organizationId, userId, updated)
    .catch(() => "Pagamento registrado, mas não foi possível criar a próxima recorrência");

  const saved = updated.installments.find((entry) => entry.id === installment.id)!;
  return { ok: true, charge: updated, installment: saved, warning };
}

/**
 * A próxima cobrança de uma série recorrente, um ciclo adiante e sempre depois da série que fechou. Só nasce
 * quando a anterior fecha por inteiro, e só uma vez: a trava é o índice único de `recurring_from_id`, e não
 * um `if` daqui, que duas abas abertas ao mesmo tempo furariam.
 */
async function spawnNextRecurrence(client: FinanceClient, organizationId: string, userId: string, charge: Charge) {
  if (charge.recurrence === "none") return;
  /* Série sem parcela nenhuma não fechou nada: repetir o vazio só multiplicaria registro pela metade. */
  if (charge.installments.length === 0) return;
  if (charge.installments.some((installment) => !installment.paidAt)) return;

  const months = recurrenceMonths[charge.recurrence];
  const id = crypto.randomUUID();
  const { hash } = shareCredentials("charge", id);

  const { error } = await client.from("charges").insert({
    id,
    organization_id: organizationId,
    direction: charge.direction,
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
  if (error) return error.code === "23505" ? undefined : "Pagamento registrado, mas não foi possível criar a próxima recorrência";

  /* O ciclo conta do primeiro vencimento, e a série nova nunca começa em cima da que fechou (2026-09-22, na
     varredura). Contar só do primeiro fazia uma mensal de três parcelas nascer com 10/02, 10/03 e 10/04, dois
     vencimentos já recebidos e vencidos no dia em que a nova era criada. Contar só do último atrasava o ciclo
     em uma parcela a cada volta: trimestral de três parcelas pulava de m3 para m5, e no ciclo seguinte para
     m7, acumulando dois meses de buraco por volta. O início é o mais tarde entre um ciclo depois da primeira
     parcela e o mês seguinte à última, e o espaçamento interno segue de mês em mês, como na criação. */
  const dueDates = charge.installments.map((installment) => installment.dueDate);
  const firstDue = dueDates.reduce((earliest, due) => (due < earliest ? due : earliest));
  const lastDue = dueDates.reduce((latest, due) => (due > latest ? due : latest));
  const firstNext = addMonths(parseISO(firstDue), months);
  const afterLast = addMonths(parseISO(lastDue), 1);
  const base = firstNext > afterLast ? firstNext : afterLast;

  const { error: installmentsError } = await client.from("charge_installments").insert(
    charge.installments.map((installment, index) => ({
      organization_id: organizationId,
      charge_id: id,
      number: installment.number,
      amount: installment.amount,
      due_date: isoDate(addMonths(base, index)),
    })),
  );

  if (installmentsError) {
    await client.from("charges").delete().eq("id", id).eq("organization_id", organizationId);
    return "Pagamento registrado, mas não foi possível criar as parcelas da próxima recorrência";
  }

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

  const { error } = await client.rpc("change_charge_payment", {
    p_organization_id: organizationId,
    p_charge_id: id,
    p_operation: "reopen",
    p_installment_id: installmentId,
  });

  if (error) return { ok: false, error: dbMessage(error, "Não foi possível concluir a operação. Tente de novo em instantes.") };

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

  const { error } = await client.rpc("change_charge_payment", {
    p_organization_id: organizationId,
    p_charge_id: id,
    p_operation: "cancel",
  });

  if (error) return { ok: false, error: dbMessage(error, "Não foi possível concluir a operação. Tente de novo em instantes.") };

  await logRecordEvent(client, organizationId, { recordType: "charge", recordId: id, action: "archived", summary: `${actor} cancelou a cobrança` });

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

  if (error || !data) return { ok: false, error: dbMessage(error, "Não foi possível registrar a movimentação.") };
  return { ok: true, data: toTransaction(data) };
}

/* Uma parcela por vencer como movimentação prevista, para a lista do painel e o filtro "Previstas". */
/** A parcela em aberto vista como movimentação prevista, no lado em que ela vai cair. */
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

/**
 * As parcelas em aberto, do vencimento mais próximo para o mais distante.
 *
 * `within` recorta quem só precisa do que cai logo, como o bloco do painel: sem recorte a consulta lê as
 * parcelas em aberto de todos os vencimentos da base, inclusive as de dez anos à frente, para o painel
 * desenhar duas linhas (2026-09-22, na varredura). A visão geral continua lendo tudo, porque os azulejos
 * "A receber" e "A pagar" somam o que está em aberto sem recorte de data.
 *
 * O total de parcelas da cobrança vem de `count` na própria consulta, e não da lista de irmãs: a etiqueta
 * quer o número, e trazer o id de cada parcela de cada cobrança só para medir o tamanho da lista carregava a
 * base inteira de parcelas junto.
 */
async function upcomingOf(
  client: FinanceClient,
  organizationId: string,
  today: string,
  within?: { from: string; to: string },
): Promise<UpcomingInstallment[]> {
  const open = client
    .from("charge_installments")
    .select("id, number, amount, due_date, reported, charges!inner(id, reference, direction, title, client_name, client_company, client_avatar_url, cancelled_at, charge_installments(count))")
    .eq("organization_id", organizationId)
    .is("paid_at", null);

  const { data, error } = await (within ? open.gte("due_date", within.from).lte("due_date", within.to) : open).order("due_date");
  ensureRead(error);

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
      total: row.charges.charge_installments[0]?.count ?? 1,
      amount: row.amount,
      dueDate: row.due_date,
      overdue: row.due_date < today,
      reported: row.reported,
      direction: row.charges.direction,
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
  const [{ data: settings, error: settingsError }, { data: rows, error }] = await Promise.all([
    client.from("finance_settings").select("opening_balance").eq("organization_id", organizationId).maybeSingle(),
    client.from("transactions").select("kind, amount, status").eq("organization_id", organizationId).eq("status", "confirmed"),
  ]);

  ensureRead(settingsError);
  ensureRead(error);

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

  /* "Desde o começo" não tem piso (2026-09-22, na varredura): os seis meses existem para o gráfico, que
     desenha sempre esse trecho, e aplicá-los ao período mais amplo fazia o cartão Recebido somar menos que o
     do ano, embaixo do rótulo "Desde o começo", enquanto o saldo em caixa, que não passa por este recorte,
     seguia contando tudo. O piso é o mais antigo entre o período pedido e a janela do gráfico. */
  const floor = start ? (start < sixMonthsAgo ? start : sixMonthsAgo) : null;
  const scope = client.from("transactions").select("*").eq("organization_id", organizationId);

  const [balance, pending, { data: all, error }] = await Promise.all([
    balanceOf(client, organizationId),
    upcomingOf(client, organizationId, today),
    (floor ? scope.gte("date", floor) : scope).order("date", { ascending: false }).limit(1000),
  ]);

  ensureRead(error);

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

  /* As duas pontas contam separado: somar "a receber" com "a pagar" num número só diria que a equipe tem
     mais dinheiro a caminho do que tem, que é exatamente o erro que a despesa existe para não deixar
     acontecer. O que vence e o que já venceu seguem misturando as duas na lista, porque ali a pergunta é
     "o que cai esta semana", e cada linha diz de que lado está. */
  const receivables = pending.filter((entry) => entry.direction === "incoming");
  const payables = pending.filter((entry) => entry.direction === "outgoing");
  const late = pending.filter((entry) => entry.overdue);
  const upcoming = pending.filter((entry) => !entry.overdue && entry.dueDate <= day(30));
  const sum = (list: UpcomingInstallment[]) => list.reduce((total, entry) => total + entry.amount, 0);

  return {
    period,
    balance,
    received: incomes.reduce((sum, transaction) => sum + transaction.amount, 0),
    receivedCount: incomes.length,
    expenses: expenses.reduce((sum, transaction) => sum + transaction.amount, 0),
    expensesCount: expenses.length,
    receivable: sum(receivables),
    receivableCount: receivables.length,
    payable: sum(payables),
    payableCount: payables.length,
    overdue: sum(receivables.filter((entry) => entry.overdue)),
    overdueCount: receivables.filter((entry) => entry.overdue).length,
    payableOverdue: sum(payables.filter((entry) => entry.overdue)),
    payableOverdueCount: payables.filter((entry) => entry.overdue).length,
    months,
    transactions: sortTransactions([...upcoming.slice(0, 6).map(scheduledOf), ...transactions.filter(inPeriod)]),
    upcoming: upcoming.slice(0, 8),
    late: late.slice(0, 8),
  };
}

/** O que o bloco do painel mostra: o caixa e as últimas movimentações, com o que vence logo no topo. */
export async function getFinanceSummary(client: FinanceClient, organizationId: string): Promise<FinanceSummary> {
  const today = todayIso();
  const [balance, pending, { data, error }] = await Promise.all([
    balanceOf(client, organizationId),
    /* O painel só mostra o que cai nesta semana, então é só isso que ele lê. */
    upcomingOf(client, organizationId, today, { from: today, to: day(7) }),
    client.from("transactions").select("*").eq("organization_id", organizationId).order("date", { ascending: false }).limit(10),
  ]);

  ensureRead(error);

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

  if (error || !data) return { ok: false, error: dbMessage(error, "Não foi possível encerrar a recorrência.") };

  await logRecordEvent(client, organizationId, { recordType: "charge", recordId: id, action: "updated", summary: "Encerrou a recorrência" });

  const charge = await getCharge(client, organizationId, id);
  return charge ? { ok: true, charge } : { ok: false, error: "Não foi possível encerrar a recorrência." };
}
