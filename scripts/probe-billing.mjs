// Teste ponta a ponta da cobrança, pela mesma porta que o aplicativo vai usar (api/v1 com Bearer).
// Roda com: node --env-file-if-exists=.env probe-billing.mjs
// Cria usuário e time de teste, assina o Pro com teste gratuito, confirma o cartão de teste do Stripe,
// confere o banco, cancela, retoma e apaga tudo no fim.
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

const BASE = process.env.PROBE_BASE ?? "http://localhost:3000";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secret = process.env.SUPABASE_SECRET_KEY;

const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const results = [];
function check(name, pass, detail = "") {
  results.push({ name, pass, detail });
  console.log(`${pass ? "OK  " : "FALHA"} ${name}${detail ? `: ${detail}` : ""}`);
}

const email = `probe-billing-${Date.now()}@specular.test`;
const password = `Probe!${Date.now()}`;

let userId = null;
let token = null;
let organizationId = null;
let subscriptionId = null;
let customerId = null;
let secondOrganizationId = null;
let secondSubscriptionId = null;
let secondCustomerId = null;

async function api(path, init = {}) {
  const response = await fetch(`${BASE}/api/v1${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: response.status, body };
}

async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`${BASE}/api/health`);
      if (response.ok) return true;
    } catch {
      // servidor ainda subindo
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  return false;
}

async function setup() {
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error) throw created.error;
  userId = created.data.user.id;

  const client = createClient(url, anon, { auth: { persistSession: false } });
  const signed = await client.auth.signInWithPassword({ email, password });
  if (signed.error) throw signed.error;
  token = signed.data.session.access_token;

  const team = await api("/organizacoes", {
    method: "POST",
    body: JSON.stringify({ name: `Probe ${Date.now()}`, industry: "web_development" }),
  });
  if (team.status !== 200) throw new Error(`criação do time falhou: ${team.status} ${JSON.stringify(team.body)}`);
  organizationId = team.body.id;
}

async function run() {
  // 1. estado inicial
  const initial = await api("/planos");
  check("estado inicial é gratuito", initial.body?.effectivePlan === "free", `plano ${initial.body?.effectivePlan}`);
  check(
    "catálogo trouxe os dois ciclos do Pro",
    initial.body?.offers?.find((o) => o.id === "pro")?.cycles?.length === 2,
  );
  check(
    "teste gratuito de 7 dias disponível no Pro",
    initial.body?.offers?.find((o) => o.id === "pro")?.trialAvailable === true &&
      initial.body?.offers?.find((o) => o.id === "pro")?.trialDays === 7,
  );
  check("linha de assinatura nasce com o time", initial.body?.status === "active");

  // 2. iniciar assinatura do Pro
  const start = await api("/planos/assinatura", {
    method: "POST",
    body: JSON.stringify({ organizationId, plan: "pro", cycle: "monthly" }),
  });
  check("início da assinatura pediu cartão", start.body?.kind === "payment", JSON.stringify(start.body).slice(0, 160));
  check("modo é guardar cartão (teste gratuito)", start.body?.mode === "setup");
  check("nada a cobrar hoje", start.body?.amountCents === 0);
  check("teste de 7 dias no resumo", start.body?.trialDays === 7);

  const setupIntentId = start.body?.setupIntentId;
  check("intenção de cartão criada", typeof setupIntentId === "string" && setupIntentId.startsWith("seti_"));

  // 3. confirmar o cartão como o Payment Element faria
  const confirmed = await stripe.setupIntents.confirm(setupIntentId, { payment_method: "pm_card_visa" });
  check("cartão de teste guardado", confirmed.status === "succeeded", confirmed.status);

  // 4. confirmar no servidor
  const confirm = await api("/planos/assinatura", {
    method: "PATCH",
    body: JSON.stringify({ organizationId, setupIntentId }),
  });
  check("assinatura em teste gratuito", confirm.body?.status === "trialing", JSON.stringify(confirm.body).slice(0, 200));
  check("plano em vigor é o Pro", confirm.body?.effectivePlan === "pro");
  check("cartão gravado no resumo", confirm.body?.paymentLast4 === "4242", String(confirm.body?.paymentLast4));

  const trialEnd = confirm.body?.trialEnd ? new Date(confirm.body.trialEnd) : null;
  const days = trialEnd ? Math.round((trialEnd - Date.now()) / 86_400_000) : null;
  check("teste termina em 7 dias", days === 7, `${days} dias`);

  // 5. banco
  const row = await admin
    .from("organization_subscriptions")
    .select("plan, cycle, status, stripe_customer_id, stripe_subscription_id, trial_end, payment_brand, payment_last4")
    .eq("organization_id", organizationId)
    .maybeSingle();

  subscriptionId = row.data?.stripe_subscription_id;
  customerId = row.data?.stripe_customer_id;

  check("linha do banco tem assinatura do Stripe", Boolean(subscriptionId), String(subscriptionId));
  check("plano e ciclo gravados", row.data?.plan === "pro" && row.data?.cycle === "monthly");
  check("bandeira do cartão gravada", row.data?.payment_brand === "visa", String(row.data?.payment_brand));

  const trial = await admin
    .from("billing_trials")
    .select("plan, ends_at")
    .eq("organization_id", organizationId)
    .maybeSingle();
  check("teste gratuito registrado", trial.data?.plan === "pro");

  // 6. função de plano no banco
  const effective = await admin.rpc("organization_plan", { p_organization_id: organizationId });
  check("organization_plan devolve pro", effective.data === "pro", String(effective.data));

  const atLeast = await admin.rpc("plan_at_least", { p_organization_id: organizationId, p_plan: "pro" });
  check("plan_at_least(pro) verdadeiro", atLeast.data === true);

  const atLeastAlliance = await admin.rpc("plan_at_least", { p_organization_id: organizationId, p_plan: "alliance" });
  check("plan_at_least(alliance) falso", atLeastAlliance.data === false);

  const unknown = await admin.rpc("plan_allows", { p_organization_id: organizationId, p_feature_key: "nao_existe" });
  check("recurso desconhecido falha alto", Boolean(unknown.error), unknown.error?.message ?? "sem erro");

  // 7. permissão por plano, ida e volta
  await admin.from("plan_features").insert([
    { key: "probe_flag", kind: "flag", name: "Recurso de teste" },
    { key: "probe_limit", kind: "limit", name: "Limite de teste" },
  ]);
  await admin.from("plan_entitlements").insert([
    { plan: "pro", feature_key: "probe_flag", enabled: true },
    { plan: "free", feature_key: "probe_flag", enabled: false },
    { plan: "pro", feature_key: "probe_limit", enabled: true, limit_value: null },
    { plan: "free", feature_key: "probe_limit", enabled: true, limit_value: 3 },
  ]);

  const allowsPro = await admin.rpc("plan_allows", { p_organization_id: organizationId, p_feature_key: "probe_flag" });
  check("plano pago libera o recurso", allowsPro.data === true, String(allowsPro.error?.message ?? allowsPro.data));

  const limitPro = await admin.rpc("plan_limit", { p_organization_id: organizationId, p_feature_key: "probe_limit" });
  check("limite ilimitado no pago", limitPro.data === null, String(limitPro.data));

  const withinPro = await admin.rpc("plan_within_limit", {
    p_organization_id: organizationId,
    p_feature_key: "probe_limit",
    p_count: 9999,
  });
  check("ilimitado cabe sempre", withinPro.data === true);

  const flagOnLimit = await admin.from("plan_entitlements").insert({
    plan: "alliance",
    feature_key: "probe_flag",
    enabled: true,
    limit_value: 5,
  });
  check("liga e desliga recusa limite", Boolean(flagOnLimit.error), flagOnLimit.error?.message ?? "sem erro");

  // 8. cancelar e retomar
  const canceled = await api("/planos/assinatura", {
    method: "DELETE",
    body: JSON.stringify({ organizationId }),
  });
  check("cancelamento agendado", canceled.body?.cancelAtPeriodEnd === true, JSON.stringify(canceled.body?.status));
  check("acesso mantido até o fim do período", canceled.body?.effectivePlan === "pro");

  const resumed = await api("/planos/assinatura", {
    method: "PUT",
    body: JSON.stringify({ organizationId }),
  });
  check("assinatura retomada", resumed.body?.cancelAtPeriodEnd === false);

  // 9. teste gratuito é uma vez só
  const again = await api("/planos");
  check("teste gratuito consumido", again.body?.offers?.find((o) => o.id === "pro")?.trialAvailable === false);

  const availableRpc = await admin.rpc("trial_available", { p_organization_id: organizationId, p_plan: "pro" });
  check("trial_available devolve falso", availableRpc.data === false);

  // 10. troca de ciclo reaproveita a assinatura
  const switched = await api("/planos/assinatura", {
    method: "POST",
    body: JSON.stringify({ organizationId, plan: "pro", cycle: "yearly" }),
  });
  const afterSwitch = await admin
    .from("organization_subscriptions")
    .select("cycle, stripe_subscription_id")
    .eq("organization_id", organizationId)
    .maybeSingle();
  check(
    "troca de ciclo não cria assinatura nova",
    afterSwitch.data?.stripe_subscription_id === subscriptionId,
    `${afterSwitch.data?.stripe_subscription_id}`,
  );
  check("ciclo passou para anual", afterSwitch.data?.cycle === "yearly", `${afterSwitch.data?.cycle}`);
  check("resposta da troca é coerente", switched.status === 200, `${switched.status}`);

  // 11. quem não é do time não enxerga nem mexe
  const outsider = await admin.auth.admin.createUser({
    email: `probe-outsider-${Date.now()}@specular.test`,
    password,
    email_confirm: true,
  });
  const outsiderClient = createClient(url, anon, { auth: { persistSession: false } });
  const outsiderSignIn = await outsiderClient.auth.signInWithPassword({
    email: outsider.data.user.email,
    password,
  });
  const outsiderToken = outsiderSignIn.data.session.access_token;

  const stolen = await fetch(`${BASE}/api/v1/planos/assinatura`, {
    method: "POST",
    headers: { authorization: `Bearer ${outsiderToken}`, "content-type": "application/json" },
    body: JSON.stringify({ organizationId, plan: "alliance", cycle: "monthly" }),
  });
  check("estranho não assina pelo time alheio", stolen.status !== 200, `HTTP ${stolen.status}`);

  const outsiderRead = await createClient(url, anon, {
    auth: { persistSession: false },
    global: { headers: { authorization: `Bearer ${outsiderToken}` } },
  })
    .from("organization_subscriptions")
    .select("organization_id")
    .eq("organization_id", organizationId);
  check("RLS esconde a assinatura de fora do time", (outsiderRead.data ?? []).length === 0);

  const outsiderWrite = await createClient(url, anon, {
    auth: { persistSession: false },
    global: { headers: { authorization: `Bearer ${outsiderToken}` } },
  })
    .from("organization_subscriptions")
    .update({ plan: "alliance" })
    .eq("organization_id", organizationId);
  check("ninguém troca o próprio plano pela API do banco", (outsiderWrite.count ?? 0) === 0);

  const selfUpgrade = await createClient(url, anon, {
    auth: { persistSession: false },
    global: { headers: { authorization: `Bearer ${token}` } },
  })
    .from("organization_subscriptions")
    .update({ plan: "alliance", status: "active" })
    .eq("organization_id", organizationId)
    .select();
  check(
    "dono do time também não escreve direto na assinatura",
    (selfUpgrade.data ?? []).length === 0,
    selfUpgrade.error?.message ?? "sem linhas afetadas",
  );

  const syncByUser = await createClient(url, anon, {
    auth: { persistSession: false },
    global: { headers: { authorization: `Bearer ${token}` } },
  }).rpc("sync_subscription", {
    p_organization_id: organizationId,
    p_plan: "alliance",
    p_cycle: "monthly",
    p_status: "active",
    p_stripe_customer_id: customerId,
    p_stripe_subscription_id: subscriptionId,
    p_stripe_price_id: "price_x",
    p_current_period_start: new Date().toISOString(),
    p_current_period_end: new Date().toISOString(),
    p_cancel_at_period_end: false,
    p_canceled_at: null,
    p_trial_start: null,
    p_trial_end: null,
  });
  check("sync_subscription é fechada para o usuário", Boolean(syncByUser.error), syncByUser.error?.message ?? "passou");

  await admin.auth.admin.deleteUser(outsider.data.user.id);

  // 12. webhook com assinatura de verdade
  const fresh = await stripe.subscriptions.retrieve(subscriptionId);
  const payload = JSON.stringify({
    id: `evt_probe_${Date.now()}`,
    object: "event",
    api_version: "2026-08-26.dahlia",
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    pending_webhooks: 1,
    request: { id: null, idempotency_key: null },
    type: "customer.subscription.updated",
    data: { object: fresh },
  });

  const header = stripe.webhooks.generateTestHeaderString({
    payload,
    secret: process.env.STRIPE_WEBHOOK_SECRET,
  });

  const hook = await fetch(`${BASE}/api/webhooks/stripe`, {
    method: "POST",
    headers: { "stripe-signature": header, "content-type": "application/json" },
    body: payload,
  });
  const hookBody = await hook.json().catch(() => null);
  check("webhook aceitou evento assinado", hook.status === 200 && hookBody?.outcome === "applied", JSON.stringify(hookBody));

  const replay = await fetch(`${BASE}/api/webhooks/stripe`, {
    method: "POST",
    headers: { "stripe-signature": header, "content-type": "application/json" },
    body: payload,
  });
  const replayBody = await replay.json().catch(() => null);
  check("reentrega do mesmo evento não reprocessa", replayBody?.duplicate === true, JSON.stringify(replayBody));

  const badSignature = await fetch(`${BASE}/api/webhooks/stripe`, {
    method: "POST",
    headers: { "stripe-signature": "t=1,v1=invalido", "content-type": "application/json" },
    body: payload,
  });
  check("webhook recusa assinatura inválida", badSignature.status === 400, `HTTP ${badSignature.status}`);

  const eventRow = await admin.from("billing_events").select("id, type, organization_id").order("received_at", { ascending: false }).limit(1);
  check("evento registrado com a organização", eventRow.data?.[0]?.organization_id === organizationId);

  // 13. cobrança imediata, num time cujo teste gratuito já foi consumido
  const second = await api('/organizacoes', {
    method: 'POST',
    body: JSON.stringify({ name: `Probe direto ${Date.now()}`, industry: 'product_design' }),
  });
  secondOrganizationId = second.body?.id;
  check('segundo time criado', Boolean(secondOrganizationId), String(second.status));

  await admin.from('billing_trials').insert({
    organization_id: secondOrganizationId,
    plan: 'pro',
    ends_at: new Date().toISOString(),
  });

  const direct = await api('/planos/assinatura', {
    method: 'POST',
    body: JSON.stringify({ organizationId: secondOrganizationId, plan: 'pro', cycle: 'monthly' }),
  });
  check('sem teste gratuito o fluxo cobra na hora', direct.body?.mode === 'payment', JSON.stringify(direct.body).slice(0, 200));
  check('valor da primeira cobrança é o do plano', direct.body?.amountCents === 9700, String(direct.body?.amountCents));
  check('segredo de pagamento entregue', typeof direct.body?.clientSecret === 'string' && direct.body.clientSecret.includes('_secret_'));
  check('assinatura nasce incompleta até pagar', direct.body?.subscriptionId?.startsWith('sub_') === true);

  const pending = await admin
    .from('organization_subscriptions')
    .select('status, plan, stripe_subscription_id, stripe_customer_id')
    .eq('organization_id', secondOrganizationId)
    .maybeSingle();
  secondSubscriptionId = pending.data?.stripe_subscription_id;
  secondCustomerId = pending.data?.stripe_customer_id;
  check('status incompleto não dá acesso', pending.data?.status === 'incomplete', String(pending.data?.status));

  const effectiveSecond = await admin.rpc('organization_plan', { p_organization_id: secondOrganizationId });
  check('plano em vigor segue gratuito sem pagamento', effectiveSecond.data === 'free', String(effectiveSecond.data));

  // 14. regressão do bug crítico: tentativa incompleta na frente não pode virar cobrança imediata em
  // cima de quem foi convidado a testar de graça. Este time tem uma assinatura `incomplete` da etapa
  // anterior e o teste gratuito do Pro ainda por usar.
  await admin.from("billing_trials").delete().eq("organization_id", secondOrganizationId);

  const rescued = await api("/planos/assinatura", {
    method: "POST",
    body: JSON.stringify({ organizationId: secondOrganizationId, plan: "pro", cycle: "monthly" }),
  });
  check(
    "tentativa incompleta na frente não rouba o teste gratuito",
    rescued.body?.mode === "setup" && rescued.body?.trialDays === 7,
    JSON.stringify(rescued.body).slice(0, 160),
  );
  check("nada a cobrar no resgate", rescued.body?.amountCents === 0, String(rescued.body?.amountCents));

  const rescuedIntent = rescued.body?.setupIntentId;
  await stripe.setupIntents.confirm(rescuedIntent, { payment_method: "pm_card_visa" });

  const rescuedConfirm = await api("/planos/assinatura", {
    method: "PATCH",
    body: JSON.stringify({ organizationId: secondOrganizationId, setupIntentId: rescuedIntent }),
  });
  check(
    "resgate termina em teste gratuito, não em cobrança",
    rescuedConfirm.body?.status === "trialing",
    JSON.stringify(rescuedConfirm.body?.status),
  );

  const rescuedRow = await admin
    .from("organization_subscriptions")
    .select("stripe_subscription_id, status, amount_cents, currency")
    .eq("organization_id", secondOrganizationId)
    .maybeSingle();
  check(
    "assinatura nova substituiu a incompleta",
    rescuedRow.data?.stripe_subscription_id !== secondSubscriptionId,
    `${secondSubscriptionId} -> ${rescuedRow.data?.stripe_subscription_id}`,
  );
  check("valor cobrado gravado na linha", rescuedRow.data?.amount_cents === 9700, String(rescuedRow.data?.amount_cents));
  check("moeda gravada na linha", rescuedRow.data?.currency === "brl", String(rescuedRow.data?.currency));

  // Assinatura incompleta cancelada vira `incomplete_expired`, não `canceled`: os dois significam morta.
  const abandoned = await stripe.subscriptions.retrieve(secondSubscriptionId);
  check(
    "tentativa abandonada saiu do caminho no Stripe",
    abandoned.status === "canceled" || abandoned.status === "incomplete_expired",
    abandoned.status,
  );

  const liveSubscriptionId = rescuedRow.data?.stripe_subscription_id;

  // 15. evento de assinatura antiga não derruba a que está valendo
  const stalePayload = JSON.stringify({
    id: `evt_probe_stale_${Date.now()}`,
    object: "event",
    api_version: "2026-08-26.dahlia",
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    pending_webhooks: 1,
    request: { id: null, idempotency_key: null },
    type: "customer.subscription.updated",
    data: { object: abandoned },
  });

  const staleHeader = stripe.webhooks.generateTestHeaderString({
    payload: stalePayload,
    secret: process.env.STRIPE_WEBHOOK_SECRET,
  });

  await fetch(`${BASE}/api/webhooks/stripe`, {
    method: "POST",
    headers: { "stripe-signature": staleHeader, "content-type": "application/json" },
    body: stalePayload,
  });

  const afterStale = await admin
    .from("organization_subscriptions")
    .select("stripe_subscription_id, status")
    .eq("organization_id", secondOrganizationId)
    .maybeSingle();
  check(
    "evento de assinatura antiga não sobrescreve a que vale",
    afterStale.data?.stripe_subscription_id === liveSubscriptionId && afterStale.data?.status === "trialing",
    `${afterStale.data?.stripe_subscription_id} ${afterStale.data?.status}`,
  );

  secondSubscriptionId = liveSubscriptionId;

  // 16. troca de ciclo com assinatura em vigor não reabre teste e não cobra o ciclo inteiro
  const switchCycle = await api("/planos/assinatura", {
    method: "POST",
    body: JSON.stringify({ organizationId: secondOrganizationId, plan: "pro", cycle: "yearly" }),
  });
  check(
    "troca de ciclo durante o teste não pede cartão de novo",
    switchCycle.body?.kind === "done" || switchCycle.body?.trialDays === 0,
    JSON.stringify(switchCycle.body).slice(0, 160),
  );

  // 17. excluir organização com assinatura viva é barrado pelo banco
  const blocked = await admin.from("organizations").delete().eq("id", secondOrganizationId);
  check(
    "banco barra excluir organização com assinatura viva",
    Boolean(blocked.error),
    blocked.error?.message ?? "passou",
  );

  // 18. plano de outro time não vaza pelas funções abertas a authenticated
  const outsider2 = await admin.auth.admin.createUser({
    email: `probe-peek-${Date.now()}@specular.test`,
    password,
    email_confirm: true,
  });
  const peekClient = createClient(url, anon, { auth: { persistSession: false } });
  const peekSignIn = await peekClient.auth.signInWithPassword({
    email: outsider2.data.user.email,
    password,
  });
  const peek = await createClient(url, anon, {
    auth: { persistSession: false },
    global: { headers: { authorization: `Bearer ${peekSignIn.data.session.access_token}` } },
  }).rpc("organization_plan", { p_organization_id: organizationId });
  check("organization_plan não responde para fora do time", Boolean(peek.error), peek.error?.message ?? "respondeu");
  await admin.auth.admin.deleteUser(outsider2.data.user.id);

  // 19. faturas
  const invoices = await api("/planos/faturas");
  check("lista de faturas responde", Array.isArray(invoices.body), `${invoices.status}`);
}

async function cleanup() {
  try {
    if (subscriptionId) await stripe.subscriptions.cancel(subscriptionId).catch(() => null);
    if (customerId) await stripe.customers.del(customerId).catch(() => null);
    if (secondSubscriptionId) await stripe.subscriptions.cancel(secondSubscriptionId).catch(() => null);
    if (secondCustomerId) await stripe.customers.del(secondCustomerId).catch(() => null);
    if (secondOrganizationId) await admin.from('billing_events').delete().eq('organization_id', secondOrganizationId);
    await admin.from("plan_entitlements").delete().in("feature_key", ["probe_flag", "probe_limit"]);
    await admin.from("plan_features").delete().in("key", ["probe_flag", "probe_limit"]);
    if (organizationId) await admin.from("billing_events").delete().eq("organization_id", organizationId);
    if (userId) await admin.auth.admin.deleteUser(userId);
    console.log("\nlimpeza concluída");
  } catch (error) {
    console.error("limpeza incompleta:", error?.message ?? error);
  }
}

const up = await waitForServer();
if (!up) {
  console.error("servidor não respondeu em /api/health");
  process.exit(1);
}

try {
  await setup();
  await run();
} catch (error) {
  console.error("\nerro no teste:", error?.message ?? error);
  results.push({ name: "execução", pass: false, detail: String(error?.message ?? error) });
} finally {
  await cleanup();
}

const failed = results.filter((result) => !result.pass);
console.log(`\n${results.length - failed.length}/${results.length} verificações passaram`);
if (failed.length > 0) {
  console.log("falhas:");
  for (const item of failed) console.log(`  - ${item.name}: ${item.detail}`);
  process.exit(1);
}
