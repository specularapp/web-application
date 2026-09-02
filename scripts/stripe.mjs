import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

// Publica o catálogo de planos no Stripe e grava o vínculo em `billing_prices`. O valor cobrado vive
// no Stripe e o texto de vitrine em `src/features/billing/plans.ts`; o banco guarda só o mapa plano +
// ciclo para o id do preço, porque uma terceira cópia do dinheiro só criaria divergência.
//
// Idempotente: produto tem id fixo (`specular_<plano>`) e preço é achado por `lookup_key`. Preço com
// valor diferente do catálogo vira preço novo com a mesma chave, e o antigo é desativado dos dois
// lados, para as assinaturas em vigor continuarem apontando para o que assinaram.

const CURRENCY = "brl";
const intervals = { monthly: "month", yearly: "year" };
const cycles = ["monthly", "yearly"];

function fail(message) {
  console.error(message);
  process.exit(1);
}

const { plans, chargeCents } = await import("../src/features/billing/plans.ts");

const secretKey = process.env.STRIPE_SECRET_KEY;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY;

if (!secretKey) fail("Falta STRIPE_SECRET_KEY no .env");
if (!supabaseUrl || !supabaseKey) fail("Falta NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SECRET_KEY no .env");

const stripe = new Stripe(secretKey);
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function ensureProduct(plan) {
  const id = `specular_${plan.id}`;

  try {
    const existing = await stripe.products.retrieve(id);
    if (existing.name !== plan.name || existing.description !== plan.description || !existing.active) {
      await stripe.products.update(id, { name: plan.name, description: plan.description, active: true });
      return { id, action: "atualizado" };
    }
    return { id, action: "em dia" };
  } catch (error) {
    if (error?.code !== "resource_missing") throw error;
  }

  await stripe.products.create({
    id,
    name: plan.name,
    description: plan.description,
    metadata: { plan: plan.id },
  });

  return { id, action: "criado" };
}

async function ensurePrice(plan, cycle, productId) {
  const lookupKey = `specular_${plan.id}_${cycle}`;
  const amount = chargeCents(plan.id, cycle);
  const interval = intervals[cycle];

  const { data } = await stripe.prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 });
  const found = data[0];

  const matches =
    found &&
    found.unit_amount === amount &&
    found.currency === CURRENCY &&
    found.recurring?.interval === interval &&
    found.recurring?.interval_count === 1;

  if (matches) return { id: found.id, action: "em dia", amount };

  const created = await stripe.prices.create({
    product: productId,
    currency: CURRENCY,
    unit_amount: amount,
    recurring: { interval },
    lookup_key: lookupKey,
    transfer_lookup_key: Boolean(found),
    metadata: { plan: plan.id, cycle },
  });

  if (found) await stripe.prices.update(found.id, { active: false });

  return { id: created.id, action: found ? "substituído" : "criado", amount };
}

// A linha antiga sai de `active` antes da nova entrar: o índice parcial do banco garante uma única
// linha ativa por plano e ciclo, então inserir primeiro daria conflito de unicidade.
async function linkPrice(plan, cycle, priceId) {
  const retire = await supabase
    .from("billing_prices")
    .update({ active: false })
    .eq("plan", plan.id)
    .eq("cycle", cycle)
    .eq("active", true)
    .neq("stripe_price_id", priceId);

  if (retire.error) fail(`Não foi possível desativar o preço anterior de ${plan.id}/${cycle}: ${retire.error.message}`);

  const upsert = await supabase
    .from("billing_prices")
    .upsert(
      { plan: plan.id, cycle, stripe_price_id: priceId, currency: CURRENCY, active: true },
      { onConflict: "plan,cycle,stripe_price_id" },
    );

  if (upsert.error) fail(`Não foi possível gravar o preço de ${plan.id}/${cycle}: ${upsert.error.message}`);
}

async function sync() {
  const account = await stripe.accounts.retrieve().catch(() => null);
  const mode = secretKey.startsWith("sk_live") ? "PRODUÇÃO" : "teste";
  console.log(`Stripe em modo ${mode}${account ? ` (conta ${account.id}, ${account.country})` : ""}`);

  if (account && !account.charges_enabled) {
    console.log("Aviso: a conta ainda não tem cobrança habilitada. Guardar cartão funciona; cobrança imediata não.");
  }

  for (const plan of plans) {
    if (plan.price.monthly === 0 && plan.price.yearly === 0) {
      console.log(`${plan.id}: gratuito, nada a publicar`);
      continue;
    }

    const product = await ensureProduct(plan);
    console.log(`${plan.id}: produto ${product.id} ${product.action}`);

    for (const cycle of cycles) {
      const price = await ensurePrice(plan, cycle, product.id);
      await linkPrice(plan, cycle, price.id);
      console.log(`  ${cycle}: ${price.id} ${price.action} (${(price.amount / 100).toFixed(2)} ${CURRENCY})`);
    }
  }

  const { data } = await supabase
    .from("billing_prices")
    .select("plan, cycle, stripe_price_id, active")
    .order("plan")
    .order("cycle");

  console.log("\nbilling_prices:");
  for (const row of data ?? []) {
    console.log(`  ${row.plan} ${row.cycle} ${row.stripe_price_id} ${row.active ? "ativo" : "inativo"}`);
  }
}

const [command = "sync"] = process.argv.slice(2);

if (command !== "sync") fail("Comandos: sync");

await sync();
