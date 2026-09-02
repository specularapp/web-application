import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type Stripe from "stripe";
import { organizationOf } from "@/features/organizations/service";
import { hasStripe } from "@/lib/env";
import { getStripe } from "@/lib/stripe/client";
import { createAdminClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import { chargeCents, planById, type BillingCycle, type PlanId } from "./plans";
import type {
  ConfirmPaymentMethodInput,
  ConfirmSubscriptionInput,
  StartSubscriptionInput,
  SubscriptionStatus,
} from "./schemas";

export type BillingClient = SupabaseClient<Database>;

export type ServiceResult<T> = { ok: true; data: T } | { ok: false; error: string };

export type PlanOffer = {
  id: PlanId;
  tier: number;
  isPaid: boolean;
  trialDays: number;
  trialRequiresPaymentMethod: boolean;
  trialAvailable: boolean;
  cycles: BillingCycle[];
};

export type BillingState = {
  organizationId: string;
  /** Plano contratado, mesmo que a assinatura esteja cancelada ou vencida. */
  plan: PlanId;
  /** Plano que vale agora. É o que decide permissão, e vem da função `organization_plan` do banco. */
  effectivePlan: PlanId;
  status: SubscriptionStatus;
  cycle: BillingCycle | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  trialEnd: string | null;
  paymentBrand: string | null;
  paymentLast4: string | null;
  hasPaymentMethod: boolean;
  /** Existe assinatura no Stripe, mesmo em atraso ou pausada. É o que libera cancelar e retomar. */
  hasSubscription: boolean;
  /** Valor do período cobrado, em centavos, como o preço do Stripe registrou. */
  amountCents: number | null;
  currency: string | null;
  canManage: boolean;
  offers: PlanOffer[];
};

/**
 * O que a interface faz depois de escolher um plano. `done` é quando não há nada a cobrar (gratuito,
 * teste sem cartão, downgrade agendado). `payment` devolve o segredo que o Payment Element confirma:
 * `setup` guarda o cartão para o fim do teste, `payment` cobra agora.
 */
export type CheckoutIntent =
  | { kind: "done" }
  | {
      kind: "payment";
      mode: "setup" | "payment";
      clientSecret: string;
      plan: PlanId;
      cycle: BillingCycle;
      subscriptionId: string | null;
      setupIntentId: string | null;
      amountCents: number;
      trialDays: number;
    };

export type Invoice = {
  id: string;
  number: string | null;
  status: string | null;
  totalCents: number;
  currency: string;
  createdAt: string;
  hostedUrl: string | null;
  pdfUrl: string | null;
};

const STRIPE_OFF = "A cobrança ainda não está configurada neste ambiente.";
const NO_PERMISSION = "Só quem administra o time pode mexer na cobrança.";
const PLAN_UNKNOWN = "Plano indisponível.";
const PRICE_MISSING = "Este plano ainda não está disponível para contratação.";
const NO_SUBSCRIPTION = "Este time não tem assinatura ativa.";
const GENERIC = "Não foi possível falar com o provedor de pagamento. Tente de novo em instantes.";
const NOT_CONFIRMED = "O pagamento não foi concluído. Confira os dados do cartão e tente de novo.";
const TEAM_NOT_FOUND = "Time não encontrado.";

const subscriptionColumns =
  "organization_id, plan, cycle, status, stripe_customer_id, stripe_subscription_id, stripe_price_id, current_period_start, current_period_end, cancel_at_period_end, canceled_at, trial_start, trial_end, payment_brand, payment_last4, amount_cents, currency";

type Row = Database["public"]["Tables"]["organization_subscriptions"]["Row"];
type SubscriptionRow = Omit<Row, "created_at" | "updated_at">;

type SyncArgs = Database["public"]["Functions"]["sync_subscription"]["Args"];

// O gerador de tipos do Supabase não expressa argumento que aceita nulo: todo parâmetro sai como
// obrigatório e não nulo. Período, cancelamento e teste são nulos por natureza, então o molde nulável
// vive aqui e a conversão acontece num ponto só, em vez de espalhar cast pelo arquivo.
type SyncPayload = { [K in keyof SyncArgs]: SyncArgs[K] | null };

function syncArgs(payload: SyncPayload) {
  return payload as SyncArgs;
}

// Status que o Stripe pode devolver fora do nosso enum caem em `incomplete`, que não dá acesso a nada:
// na dúvida o time fica no gratuito em vez de ganhar plano pago por status desconhecido.
const statuses: Record<string, SubscriptionStatus> = {
  incomplete: "incomplete",
  incomplete_expired: "incomplete_expired",
  trialing: "trialing",
  active: "active",
  past_due: "past_due",
  canceled: "canceled",
  unpaid: "unpaid",
  paused: "paused",
};

/**
 * Assinatura de verdade, que se troca em vez de recriar. `incomplete` fica de fora de propósito: é
 * tentativa abandonada, e reaproveitá-la fazia o teste gratuito virar cobrança imediata, porque
 * `subscriptions.update` não aceita `trial_period_days`. Tentativa morta é cancelada e nasce outra.
 */
const established = new Set<SubscriptionStatus>(["trialing", "active", "past_due", "unpaid", "paused"]);

function toStatus(value: string): SubscriptionStatus {
  return statuses[value] ?? "incomplete";
}

function toIso(seconds: number | null | undefined) {
  return typeof seconds === "number" ? new Date(seconds * 1000).toISOString() : null;
}

function idOf(value: string | { id: string } | null | undefined) {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

/** Time em que a pessoa está trabalhando agora. Mesma resolução que o domínio `organizations` usa. */
export async function resolveOrganization(client: BillingClient, userId: string) {
  const { data: profile } = await client
    .from("profiles")
    .select("current_organization_id")
    .eq("id", userId)
    .maybeSingle();

  return organizationOf(client, userId, profile?.current_organization_id ?? null);
}

async function canManage(client: BillingClient, organizationId: string) {
  const { data } = await client.rpc("can_manage_billing", { p_organization_id: organizationId });
  return data === true;
}

async function readSubscriptionRow(
  client: BillingClient,
  organizationId: string,
): Promise<SubscriptionRow | null> {
  const { data } = await client
    .from("organization_subscriptions")
    .select(subscriptionColumns)
    .eq("organization_id", organizationId)
    .maybeSingle();

  return data ?? null;
}

/**
 * Catálogo de planos com o teste gratuito já resolvido. Sem organização (o time nasce no meio do
 * primeiro acesso) o teste conta como disponível, que é a verdade para quem acabou de se cadastrar.
 */
async function readOffers(client: BillingClient, organizationId: string | null): Promise<PlanOffer[]> {
  const [catalog, prices] = await Promise.all([
    client.from("billing_plans").select("code, tier, trial_days, trial_requires_payment_method, is_paid").order("tier"),
    client.from("billing_prices").select("plan, cycle").eq("active", true),
  ]);

  const used = new Set<PlanId>();

  if (organizationId) {
    const { data } = await client.from("billing_trials").select("plan").eq("organization_id", organizationId);
    for (const trial of data ?? []) used.add(trial.plan);
  }

  return (catalog.data ?? []).map((plan) => ({
    id: plan.code,
    tier: plan.tier,
    isPaid: plan.is_paid,
    trialDays: plan.trial_days,
    trialRequiresPaymentMethod: plan.trial_requires_payment_method,
    trialAvailable: plan.trial_days > 0 && !used.has(plan.code),
    cycles: (prices.data ?? []).filter((price) => price.plan === plan.code).map((price) => price.cycle),
  }));
}

/** Estado de quem ainda não tem time: gratuito, sem cobrança, com o catálogo já carregado. */
export async function getPlanCatalogState(client: BillingClient): Promise<BillingState> {
  return {
    organizationId: "",
    plan: "free",
    effectivePlan: "free",
    status: "active",
    cycle: null,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    trialEnd: null,
    paymentBrand: null,
    paymentLast4: null,
    hasPaymentMethod: false,
    hasSubscription: false,
    amountCents: null,
    currency: null,
    canManage: true,
    offers: await readOffers(client, null),
  };
}

export async function getBillingState(client: BillingClient, organizationId: string): Promise<BillingState> {
  const [offers, row, effective, manage] = await Promise.all([
    readOffers(client, organizationId),
    readSubscriptionRow(client, organizationId),
    client.rpc("organization_plan", { p_organization_id: organizationId }),
    client.rpc("can_manage_billing", { p_organization_id: organizationId }),
  ]);

  return {
    organizationId,
    plan: row?.plan ?? "free",
    effectivePlan: effective.data ?? "free",
    status: row?.status ?? "active",
    cycle: row?.cycle ?? null,
    currentPeriodEnd: row?.current_period_end ?? null,
    cancelAtPeriodEnd: row?.cancel_at_period_end ?? false,
    trialEnd: row?.trial_end ?? null,
    paymentBrand: row?.payment_brand ?? null,
    paymentLast4: row?.payment_last4 ?? null,
    hasPaymentMethod: Boolean(row?.payment_last4),
    hasSubscription: Boolean(row?.stripe_subscription_id),
    amountCents: row?.amount_cents ?? null,
    currency: row?.currency ?? null,
    canManage: manage.data === true,
    offers,
  };
}

/**
 * Grava no banco a verdade que veio do Stripe. Passa pela chave secreta porque `sync_subscription` é
 * revogada de `authenticated` de propósito: se o cliente pudesse escrever plano e status, trocaria o
 * próprio plano sem pagar. Os valores nunca vêm do pedido, sempre do objeto que o Stripe devolveu.
 */
async function syncFromStripe(organizationId: string, subscription: Stripe.Subscription): Promise<boolean> {
  const admin = createAdminClient();
  const item = subscription.items.data[0];
  const priceId = item?.price?.id ?? null;

  const periodEnds = subscription.items.data.map((entry) => entry.current_period_end).filter(Boolean);
  const periodStarts = subscription.items.data.map((entry) => entry.current_period_start).filter(Boolean);

  let plan: PlanId | null = null;
  let cycle: BillingCycle | null = null;

  if (priceId) {
    const { data } = await admin
      .from("billing_prices")
      .select("plan, cycle")
      .eq("stripe_price_id", priceId)
      .maybeSingle();

    if (data) {
      plan = data.plan;
      cycle = data.cycle;
    }
  }

  // Preço rotacionado e ainda não mapeado cai no metadata que nós mesmos gravamos ao criar.
  if (!plan) {
    const fromMetadata = subscription.metadata?.plan;
    if (fromMetadata === "free" || fromMetadata === "pro" || fromMetadata === "alliance") plan = fromMetadata;
  }
  if (!cycle) {
    const fromMetadata = subscription.metadata?.cycle;
    if (fromMetadata === "monthly" || fromMetadata === "yearly") cycle = fromMetadata;
  }

  if (!plan) return false;

  const card = paymentCardOf(subscription.default_payment_method);

  const { error } = await admin.rpc(
    "sync_subscription",
    syncArgs({
      p_organization_id: organizationId,
      p_plan: plan,
      p_cycle: cycle,
      p_status: toStatus(subscription.status),
      p_stripe_customer_id: idOf(subscription.customer),
      p_stripe_subscription_id: subscription.id,
      p_stripe_price_id: priceId,
      p_current_period_start: toIso(periodStarts.length > 0 ? Math.min(...periodStarts) : null),
      p_current_period_end: toIso(periodEnds.length > 0 ? Math.max(...periodEnds) : null),
      p_cancel_at_period_end: subscription.cancel_at_period_end,
      p_canceled_at: toIso(subscription.canceled_at),
      p_trial_start: toIso(subscription.trial_start),
      p_trial_end: toIso(subscription.trial_end),
      p_payment_brand: card.brand,
      p_payment_last4: card.last4,
      p_amount_cents: item?.price?.unit_amount ?? null,
      p_currency: item?.price?.currency ?? null,
    }),
  );

  // Falha de escrita é transitória e precisa virar 500 no webhook, para o Stripe reentregar. Plano
  // que não dá para resolver é dado, não falha: devolve falso e o evento entra como ignorado.
  if (error) throw new Error(`sync_subscription falhou: ${error.message}`);
  return true;
}

function paymentCardOf(method: string | Stripe.PaymentMethod | null | undefined) {
  if (!method || typeof method === "string") return { brand: null, last4: null };
  return { brand: method.card?.brand ?? null, last4: method.card?.last4 ?? null };
}

const expandOnRead = ["items.data.price", "default_payment_method", "latest_invoice.confirmation_secret"];

async function ensureCustomer(
  client: BillingClient,
  organizationId: string,
  existing: string | null,
  context: { email: string | null; teamName: string | null },
): Promise<ServiceResult<string>> {
  if (existing) return { ok: true, data: existing };

  // Sem chave de idempotência de propósito: ela é por organização, mas o e-mail vem de quem clicou, e
  // o Stripe recusa a mesma chave com parâmetros diferentes. Duas pessoas do mesmo time clicando ao
  // mesmo tempo dariam erro em vez de assinatura. A corrida é fechada logo abaixo.
  const stripe = getStripe();
  const customer = await stripe.customers.create({
    email: context.email ?? undefined,
    name: context.teamName ?? undefined,
    metadata: { organization_id: organizationId },
  });

  // O vínculo passa pela função do banco, que exige owner ou admin e nunca troca um cliente já
  // vinculado. Se outra sessão vinculou primeiro, ela devolve o vínculo que ficou valendo.
  const { data, error } = await client.rpc("attach_billing_customer", {
    p_organization_id: organizationId,
    p_stripe_customer_id: customer.id,
  });

  if (error || !data) {
    await stripe.customers.del(customer.id).catch(() => null);
    return { ok: false, error: error?.message || NO_PERMISSION };
  }

  // Perdeu a corrida: o cliente que acabou de nascer não vale mais nada e sairia como cliente órfão
  // na conta do Stripe. Apagar aqui é seguro porque ele nunca teve assinatura nem cobrança.
  if (data !== customer.id) {
    await stripe.customers.del(customer.id).catch(() => null);
  }

  return { ok: true, data };
}

async function retrieveSubscription(id: string) {
  return getStripe().subscriptions.retrieve(id, { expand: expandOnRead });
}

function secretOf(subscription: Stripe.Subscription) {
  const setup = subscription.pending_setup_intent;
  if (setup && typeof setup !== "string" && setup.client_secret) {
    return { mode: "setup" as const, clientSecret: setup.client_secret };
  }

  const invoice = subscription.latest_invoice;
  if (invoice && typeof invoice !== "string") {
    const secret = invoice.confirmation_secret?.client_secret;
    if (secret) return { mode: "payment" as const, clientSecret: secret };
  }

  return null;
}

type StripeState = {
  /** Assinatura de verdade, pronta para trocar de preço. */
  live: { subscription: Stripe.Subscription; itemId: string } | null;
  /** Tentativa que morreu antes de pagar, que precisa sair da frente. */
  abandoned: Stripe.Subscription | null;
};

async function readStripeSubscription(row: SubscriptionRow | null): Promise<StripeState> {
  if (!row?.stripe_subscription_id) return { live: null, abandoned: null };

  const subscription = await retrieveSubscription(row.stripe_subscription_id).catch(() => null);
  if (!subscription) return { live: null, abandoned: null };

  const itemId = subscription.items.data[0]?.id;
  const status = toStatus(subscription.status);

  if (itemId && established.has(status)) return { live: { subscription, itemId }, abandoned: null };
  return { live: null, abandoned: status === "incomplete" ? subscription : null };
}

type OpenInput = {
  organizationId: string;
  plan: PlanId;
  cycle: BillingCycle;
  priceId: string;
  customerId: string;
  trialDays: number;
  paymentMethodId: string | null;
  stripeState: StripeState;
  /**
   * Chave de idempotência da criação. Existe para a corrida entre a confirmação da tela e o webhook
   * `setup_intent.succeeded`, que rodam o mesmo caminho ao mesmo tempo: sem ela nasciam duas
   * assinaturas em teste no mesmo cartão, e as duas cobravam sete dias depois.
   */
  idempotencyKey?: string;
};

/**
 * Troca o preço de uma assinatura em vigor. `pending_if_incomplete` no lugar de `default_incomplete`:
 * com o segundo, o plano novo entrava em vigor na hora e a fatura ficava em aberto, e como `past_due`
 * dá acesso, quem abandonasse o pagamento subiria de plano de graça por todo o tempo que o Stripe leva
 * insistindo. Com o primeiro, a mudança fica em `pending_update` e só é aplicada quando a fatura é paga.
 *
 * A atualização pendente aceita uma lista curta de parâmetros, e o Stripe recusa a chamada inteira se
 * vier qualquer outro. Metadata e cartão padrão valem na hora e por isso vão numa chamada própria antes.
 */
async function changePrice(
  live: { subscription: Stripe.Subscription; itemId: string },
  input: OpenInput,
  metadata: Record<string, string>,
) {
  const stripe = getStripe();

  await stripe.subscriptions.update(live.subscription.id, {
    metadata,
    ...(input.paymentMethodId ? { default_payment_method: input.paymentMethodId } : {}),
  });

  return stripe.subscriptions.update(live.subscription.id, {
    items: [{ id: live.itemId, price: input.priceId }],
    proration_behavior: "always_invoice",
    payment_behavior: "pending_if_incomplete",
    expand: expandOnRead,
  });
}

function dueOf(subscription: Stripe.Subscription) {
  const invoice = subscription.latest_invoice;
  if (!invoice || typeof invoice === "string") return null;
  return typeof invoice.amount_due === "number" ? invoice.amount_due : null;
}

/**
 * Cria a assinatura, ou troca o preço da que já existe. `default_incomplete` deixa a cobrança pendente
 * até o Payment Element confirmar, e `missing_payment_method: cancel` fecha o buraco de teste gratuito
 * que termina sem cartão. Teste gratuito só existe no caminho de criação: `subscriptions.update` não
 * aceita `trial_period_days`, e quem já tem assinatura em vigor está trocando de plano, não testando.
 */
async function openSubscription(input: OpenInput): Promise<ServiceResult<CheckoutIntent>> {
  const stripe = getStripe();
  const metadata = { organization_id: input.organizationId, plan: input.plan, cycle: input.cycle };
  const live = input.stripeState.live;
  const trialDays = live ? 0 : input.trialDays;

  // Tentativa incompleta na frente seria tratada como troca de plano e cobraria na hora quem foi
  // convidado a testar de graça. Cancelar é seguro: ela nunca virou assinatura paga.
  if (!live && input.stripeState.abandoned) {
    await stripe.subscriptions.cancel(input.stripeState.abandoned.id).catch(() => null);
  }

  const subscription = live
    ? await changePrice(live, input, metadata)
    : await stripe.subscriptions.create(
        {
          customer: input.customerId,
          items: [{ price: input.priceId }],
          ...(trialDays > 0 ? { trial_period_days: trialDays } : {}),
          trial_settings: { end_behavior: { missing_payment_method: "cancel" } },
          payment_behavior: "default_incomplete",
          payment_settings: { save_default_payment_method: "on_subscription", payment_method_types: ["card"] },
          ...(input.paymentMethodId ? { default_payment_method: input.paymentMethodId } : {}),
          metadata,
          expand: expandOnRead,
        },
        input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : undefined,
      );

  await syncFromStripe(input.organizationId, subscription);

  const secret = secretOf(subscription);
  if (!secret) return { ok: true, data: { kind: "done" } };

  return {
    ok: true,
    data: {
      kind: "payment",
      mode: secret.mode,
      clientSecret: secret.clientSecret,
      plan: input.plan,
      cycle: input.cycle,
      subscriptionId: subscription.id,
      setupIntentId: null,
      // O valor sai da fatura que o Payment Element vai confirmar, não do catálogo: em troca de plano
      // o Stripe cobra a proporcional, e o catálogo mostraria o ciclo inteiro.
      amountCents: dueOf(subscription) ?? (trialDays > 0 ? 0 : chargeCents(input.plan, input.cycle)),
      trialDays,
    },
  };
}

async function scheduleDowngrade(row: SubscriptionRow | null): Promise<ServiceResult<CheckoutIntent>> {
  if (!row?.stripe_subscription_id) return { ok: true, data: { kind: "done" } };

  const current = await retrieveSubscription(row.stripe_subscription_id).catch(() => null);
  if (!current || !established.has(toStatus(current.status))) return { ok: true, data: { kind: "done" } };

  const updated = await getStripe().subscriptions.update(current.id, {
    cancel_at_period_end: true,
    expand: expandOnRead,
  });

  await syncFromStripe(row.organization_id, updated);
  return { ok: true, data: { kind: "done" } };
}

export async function startSubscription(
  client: BillingClient,
  input: StartSubscriptionInput,
  context: { email: string | null },
): Promise<ServiceResult<CheckoutIntent>> {
  if (!hasStripe()) return { ok: false, error: STRIPE_OFF };

  // Quem pode mexer na cobrança é o banco que decide, não a organização "atual" do perfil: dono de
  // dois times administra os dois, e o aplicativo manda o id do time em que está trabalhando.
  if (!(await canManage(client, input.organizationId))) return { ok: false, error: NO_PERMISSION };

  const { data: organization } = await client
    .from("organizations")
    .select("name")
    .eq("id", input.organizationId)
    .maybeSingle();

  if (!organization) return { ok: false, error: TEAM_NOT_FOUND };

  const row = await readSubscriptionRow(client, input.organizationId);

  // Descer para o gratuito não cancela na hora: o time paga até o fim do período e só depois cai.
  if (input.plan === "free") return scheduleDowngrade(row);

  const [{ data: catalog }, { data: price }, { data: trialAvailable }] = await Promise.all([
    client
      .from("billing_plans")
      .select("trial_days, trial_requires_payment_method, is_paid")
      .eq("code", input.plan)
      .maybeSingle(),
    client
      .from("billing_prices")
      .select("stripe_price_id")
      .eq("plan", input.plan)
      .eq("cycle", input.cycle)
      .eq("active", true)
      .maybeSingle(),
    client.rpc("trial_available", { p_organization_id: input.organizationId, p_plan: input.plan }),
  ]);

  if (!catalog || !catalog.is_paid) return { ok: false, error: PLAN_UNKNOWN };
  if (!price?.stripe_price_id) return { ok: false, error: PRICE_MISSING };

  try {
    // Teste gratuito só vale para quem ainda não tem assinatura: com assinatura em vigor isto é troca
    // de plano, e troca não reabre período grátis. Sem essa leitura, o caminho de troca cobraria na
    // hora quem a tela convidou a testar de graça, porque `update` não aceita `trial_period_days`.
    const stripeState = await readStripeSubscription(row);
    const trialDays =
      trialAvailable === true && catalog.trial_days > 0 && !stripeState.live ? catalog.trial_days : 0;

    const customer = await ensureCustomer(client, input.organizationId, row?.stripe_customer_id ?? null, {
      email: context.email,
      teamName: organization.name,
    });
    if (!customer.ok) return customer;

    // Teste gratuito com cartão obrigatório guarda o cartão primeiro. Criar a assinatura antes daria
    // sete dias de plano pago a quem abandonasse o formulário no meio.
    if (trialDays > 0 && catalog.trial_requires_payment_method) {
      const intent = await getStripe().setupIntents.create({
        customer: customer.data,
        usage: "off_session",
        payment_method_types: ["card"],
        metadata: { organization_id: input.organizationId, plan: input.plan, cycle: input.cycle },
      });

      if (!intent.client_secret) return { ok: false, error: GENERIC };

      return {
        ok: true,
        data: {
          kind: "payment",
          mode: "setup",
          clientSecret: intent.client_secret,
          plan: input.plan,
          cycle: input.cycle,
          subscriptionId: null,
          setupIntentId: intent.id,
          amountCents: 0,
          trialDays,
        },
      };
    }

    return openSubscription({
      organizationId: input.organizationId,
      plan: input.plan,
      cycle: input.cycle,
      priceId: price.stripe_price_id,
      customerId: customer.data,
      trialDays,
      paymentMethodId: null,
      stripeState,
    });
  } catch (error) {
    return { ok: false, error: stripeMessage(error) };
  }
}

// Mensagem do Stripe nunca chega à tela: vem em inglês e pode carregar detalhe de conta. Erro de
// cartão quem mostra é o próprio Payment Element, no navegador e em português.
function stripeMessage(error: unknown) {
  console.error("[billing]", error);
  return GENERIC;
}

/**
 * Cartão guardado vira assinatura. Serve à confirmação da tela e ao webhook `setup_intent.succeeded`,
 * que é a rede quando a aba morre depois de confirmar o cartão e antes de a action responder. Passar
 * duas vezes não duplica: `openSubscription` reaproveita a assinatura que já existe.
 */
async function activateFromSetupIntent(
  client: BillingClient,
  organizationId: string,
  intent: Stripe.SetupIntent,
  row: SubscriptionRow | null,
): Promise<ServiceResult<undefined>> {
  if (intent.status !== "succeeded") return { ok: false, error: NOT_CONFIRMED };

  const paymentMethodId = idOf(intent.payment_method);
  const customerId = idOf(intent.customer);
  if (!paymentMethodId || !customerId) return { ok: false, error: NOT_CONFIRMED };

  const plan = intent.metadata?.plan;
  const cycle = intent.metadata?.cycle;
  if (plan !== "pro" && plan !== "alliance") return { ok: false, error: PLAN_UNKNOWN };
  if (cycle !== "monthly" && cycle !== "yearly") return { ok: false, error: PLAN_UNKNOWN };

  const [{ data: price }, { data: trialAvailable }, { data: catalog }] = await Promise.all([
    client
      .from("billing_prices")
      .select("stripe_price_id")
      .eq("plan", plan)
      .eq("cycle", cycle)
      .eq("active", true)
      .maybeSingle(),
    client.rpc("trial_available", { p_organization_id: organizationId, p_plan: plan }),
    client.from("billing_plans").select("trial_days").eq("code", plan).maybeSingle(),
  ]);

  if (!price?.stripe_price_id) return { ok: false, error: PRICE_MISSING };

  await getStripe().customers.update(customerId, {
    invoice_settings: { default_payment_method: paymentMethodId },
  });

  const opened = await openSubscription({
    organizationId,
    plan,
    cycle,
    priceId: price.stripe_price_id,
    customerId,
    trialDays: trialAvailable === true ? (catalog?.trial_days ?? 0) : 0,
    paymentMethodId,
    stripeState: await readStripeSubscription(row),
    // A intenção de cartão é de uso único, então a chave dela é a identidade natural desta ativação:
    // tela e webhook rodando juntos recebem a mesma assinatura de volta em vez de criar duas.
    idempotencyKey: `subscription:${intent.id}`,
  });

  if (!opened.ok) return opened;
  return { ok: true, data: undefined };
}

/**
 * Fecha o que o Payment Element confirmou. Nada do que chega do cliente entra no banco: o servidor
 * relê a intenção no Stripe, confere que ela é desta organização e só então grava.
 */
export async function confirmSubscription(
  client: BillingClient,
  input: ConfirmSubscriptionInput,
): Promise<ServiceResult<BillingState>> {
  if (!hasStripe()) return { ok: false, error: STRIPE_OFF };
  if (!(await canManage(client, input.organizationId))) return { ok: false, error: NO_PERMISSION };

  const row = await readSubscriptionRow(client, input.organizationId);
  const stripe = getStripe();

  try {
    if (input.setupIntentId) {
      const intent = await stripe.setupIntents.retrieve(input.setupIntentId, { expand: ["payment_method"] });

      if (intent.metadata?.organization_id !== input.organizationId) return { ok: false, error: NO_PERMISSION };
      if (idOf(intent.customer) !== (row?.stripe_customer_id ?? null)) return { ok: false, error: NO_PERMISSION };

      const activated = await activateFromSetupIntent(client, input.organizationId, intent, row);
      if (!activated.ok) return activated;
      return { ok: true, data: await getBillingState(client, input.organizationId) };
    }

    const subscriptionId = input.subscriptionId ?? row?.stripe_subscription_id;
    if (!subscriptionId) return { ok: false, error: NO_SUBSCRIPTION };

    const subscription = await retrieveSubscription(subscriptionId);
    if (subscription.metadata?.organization_id !== input.organizationId) return { ok: false, error: NO_PERMISSION };

    await syncFromStripe(input.organizationId, subscription);
    return { ok: true, data: await getBillingState(client, input.organizationId) };
  } catch (error) {
    return { ok: false, error: stripeMessage(error) };
  }
}

export async function cancelSubscription(
  client: BillingClient,
  organizationId: string,
): Promise<ServiceResult<BillingState>> {
  if (!hasStripe()) return { ok: false, error: STRIPE_OFF };
  if (!(await canManage(client, organizationId))) return { ok: false, error: NO_PERMISSION };

  const row = await readSubscriptionRow(client, organizationId);
  if (!row?.stripe_subscription_id) return { ok: false, error: NO_SUBSCRIPTION };

  try {
    const updated = await getStripe().subscriptions.update(row.stripe_subscription_id, {
      cancel_at_period_end: true,
      expand: expandOnRead,
    });

    await syncFromStripe(organizationId, updated);
    return { ok: true, data: await getBillingState(client, organizationId) };
  } catch (error) {
    return { ok: false, error: stripeMessage(error) };
  }
}

export async function resumeSubscription(
  client: BillingClient,
  organizationId: string,
): Promise<ServiceResult<BillingState>> {
  if (!hasStripe()) return { ok: false, error: STRIPE_OFF };
  if (!(await canManage(client, organizationId))) return { ok: false, error: NO_PERMISSION };

  const row = await readSubscriptionRow(client, organizationId);
  if (!row?.stripe_subscription_id) return { ok: false, error: NO_SUBSCRIPTION };

  try {
    const updated = await getStripe().subscriptions.update(row.stripe_subscription_id, {
      cancel_at_period_end: false,
      expand: expandOnRead,
    });

    await syncFromStripe(organizationId, updated);
    return { ok: true, data: await getBillingState(client, organizationId) };
  } catch (error) {
    return { ok: false, error: stripeMessage(error) };
  }
}

export async function startPaymentMethodUpdate(
  client: BillingClient,
  organizationId: string,
): Promise<ServiceResult<{ clientSecret: string; setupIntentId: string }>> {
  if (!hasStripe()) return { ok: false, error: STRIPE_OFF };
  if (!(await canManage(client, organizationId))) return { ok: false, error: NO_PERMISSION };

  const row = await readSubscriptionRow(client, organizationId);
  if (!row?.stripe_customer_id) return { ok: false, error: NO_SUBSCRIPTION };

  try {
    const intent = await getStripe().setupIntents.create({
      customer: row.stripe_customer_id,
      usage: "off_session",
      payment_method_types: ["card"],
      metadata: { organization_id: organizationId, purpose: "update_payment_method" },
    });

    if (!intent.client_secret) return { ok: false, error: GENERIC };
    return { ok: true, data: { clientSecret: intent.client_secret, setupIntentId: intent.id } };
  } catch (error) {
    return { ok: false, error: stripeMessage(error) };
  }
}

async function attachDefaultPaymentMethod(
  organizationId: string,
  customerId: string,
  subscriptionId: string | null,
  paymentMethodId: string,
) {
  const stripe = getStripe();

  await stripe.customers.update(customerId, {
    invoice_settings: { default_payment_method: paymentMethodId },
  });

  if (!subscriptionId) return;

  const updated = await stripe.subscriptions.update(subscriptionId, {
    default_payment_method: paymentMethodId,
    expand: expandOnRead,
  });

  await syncFromStripe(organizationId, updated);
}

export async function confirmPaymentMethod(
  client: BillingClient,
  input: ConfirmPaymentMethodInput,
): Promise<ServiceResult<BillingState>> {
  if (!hasStripe()) return { ok: false, error: STRIPE_OFF };
  if (!(await canManage(client, input.organizationId))) return { ok: false, error: NO_PERMISSION };

  const row = await readSubscriptionRow(client, input.organizationId);
  if (!row?.stripe_customer_id) return { ok: false, error: NO_SUBSCRIPTION };

  try {
    const intent = await getStripe().setupIntents.retrieve(input.setupIntentId, { expand: ["payment_method"] });

    if (intent.metadata?.organization_id !== input.organizationId) return { ok: false, error: NO_PERMISSION };
    if (idOf(intent.customer) !== row.stripe_customer_id) return { ok: false, error: NO_PERMISSION };
    if (intent.status !== "succeeded") return { ok: false, error: NOT_CONFIRMED };

    const paymentMethodId = idOf(intent.payment_method);
    if (!paymentMethodId) return { ok: false, error: NOT_CONFIRMED };

    await attachDefaultPaymentMethod(
      input.organizationId,
      row.stripe_customer_id,
      row.stripe_subscription_id,
      paymentMethodId,
    );

    return { ok: true, data: await getBillingState(client, input.organizationId) };
  } catch (error) {
    return { ok: false, error: stripeMessage(error) };
  }
}

/**
 * Fatura carrega endereço, documento e um PDF em URL pública do Stripe. Ser membro do time não basta:
 * só quem administra a cobrança vê. Sem permissão devolve lista vazia, e não erro, porque a tela lê
 * isso junto com o resto do estado.
 */
export async function listInvoices(client: BillingClient, organizationId: string): Promise<Invoice[]> {
  if (!hasStripe()) return [];
  if (!(await canManage(client, organizationId))) return [];

  const row = await readSubscriptionRow(client, organizationId);
  if (!row?.stripe_customer_id) return [];

  try {
    const list = await getStripe().invoices.list({ customer: row.stripe_customer_id, limit: 12 });

    return list.data.map((invoice) => ({
      id: invoice.id ?? "",
      number: invoice.number ?? null,
      status: invoice.status ?? null,
      totalCents: invoice.total,
      currency: invoice.currency,
      createdAt: new Date(invoice.created * 1000).toISOString(),
      hostedUrl: invoice.hosted_invoice_url ?? null,
      pdfUrl: invoice.invoice_pdf ?? null,
    }));
  } catch {
    return [];
  }
}

/**
 * Reentrega é rotina no Stripe, então o id do evento é a chave de idempotência. A marca é gravada
 * depois de processar, nunca antes: marcar primeiro perderia o evento se a escrita falhasse.
 */
export async function eventAlreadyHandled(eventId: string) {
  const admin = createAdminClient();
  const { data } = await admin.from("billing_events").select("id").eq("id", eventId).maybeSingle();
  return Boolean(data);
}

export async function recordEvent(input: {
  id: string;
  type: string;
  organizationId: string | null;
  outcome: string;
}) {
  const admin = createAdminClient();
  await admin.from("billing_events").insert({
    id: input.id,
    type: input.type,
    organization_id: input.organizationId,
    payload: { outcome: input.outcome },
  });
}

/** Resolve a organização de um evento do Stripe: primeiro o metadata que gravamos, depois o cliente. */
export async function organizationOfCustomer(customerId: string | null) {
  if (!customerId) return null;

  const admin = createAdminClient();
  const { data } = await admin
    .from("organization_subscriptions")
    .select("organization_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();

  return data?.organization_id ?? null;
}

/**
 * Aplica um evento de assinatura. Relê a assinatura no Stripe em vez de confiar no corpo do evento,
 * porque reentrega fora de ordem entregaria estado antigo por último.
 */
export async function applySubscriptionEvent(subscriptionId: string): Promise<string | null> {
  const subscription = await retrieveSubscription(subscriptionId);
  const fromMetadata = subscription.metadata?.organization_id ?? null;
  const organizationId = fromMetadata ?? (await organizationOfCustomer(idOf(subscription.customer)));

  if (!organizationId) return null;
  return (await syncFromStripe(organizationId, subscription)) ? organizationId : null;
}

/**
 * Rede de segurança do cartão: `setup_intent.succeeded` chega mesmo que a aba tenha morrido antes da
 * action responder, então o plano é ativado (ou o cartão trocado) do mesmo jeito.
 */
export async function applySetupIntentEvent(setupIntentId: string): Promise<string | null> {
  const intent = await getStripe().setupIntents.retrieve(setupIntentId, { expand: ["payment_method"] });
  const customerId = idOf(intent.customer);
  const organizationId = intent.metadata?.organization_id ?? (await organizationOfCustomer(customerId));

  if (!organizationId || !customerId) return null;

  const admin = createAdminClient();
  const row = await readSubscriptionRow(admin, organizationId);
  const paymentMethodId = idOf(intent.payment_method);

  if (intent.metadata?.purpose === "update_payment_method") {
    if (intent.status !== "succeeded" || !paymentMethodId) return null;
    await attachDefaultPaymentMethod(organizationId, customerId, row?.stripe_subscription_id ?? null, paymentMethodId);
    return organizationId;
  }

  const activated = await activateFromSetupIntent(admin, organizationId, intent, row);
  return activated.ok ? organizationId : null;
}

export function subscriptionIdOfInvoice(invoice: Stripe.Invoice) {
  const parent = invoice.parent;
  if (!parent || parent.type !== "subscription_details") return null;
  return idOf(parent.subscription_details?.subscription ?? null);
}

export function planLabel(id: PlanId) {
  return planById(id)?.name ?? id;
}
