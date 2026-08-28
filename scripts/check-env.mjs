import { readFileSync } from "node:fs";
import Redis from "ioredis";
import OpenAI from "openai";
import { Resend } from "resend";
import Stripe from "stripe";

const expected = readFileSync(".env.example", "utf8")
  .split("\n")
  .filter((line) => /^[A-Z_]+=/.test(line))
  .map((line) => line.split("=")[0]);

const results = [];

async function check(name, vars, run, { optional = false } = {}) {
  const missing = vars.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    results.push({
      name,
      status: optional ? "skip" : "fail",
      detail: optional ? "não configurado (opcional por enquanto)" : `faltando ${missing.join(", ")}`,
    });
    return;
  }
  try {
    results.push({ name, status: "ok", detail: await run() });
  } catch (error) {
    results.push({ name, status: "fail", detail: error instanceof Error ? error.message : String(error) });
  }
}

const e = process.env;

await check("Supabase", ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"], async () => {
  const response = await fetch(`${e.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/health`, {
    headers: { apikey: e.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY },
  });
  if (!response.ok) throw new Error(`auth respondeu HTTP ${response.status}`);
  return "projeto acessível";
});

await check("Supabase (secreta)", ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SECRET_KEY"], async () => {
  const response = await fetch(`${e.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`, {
    headers: { apikey: e.SUPABASE_SECRET_KEY, authorization: `Bearer ${e.SUPABASE_SECRET_KEY}` },
  });
  if (!response.ok) throw new Error(`rest respondeu HTTP ${response.status}`);
  return "acesso admin OK";
});

await check("OpenAI", ["OPENAI_API_KEY"], async () => {
  const model = e.OPENAI_MODEL || "gpt-4o-mini";
  await new OpenAI({ apiKey: e.OPENAI_API_KEY }).models.retrieve(model);
  return `modelo ${model} disponível`;
});

await check("Resend", ["RESEND_API_KEY", "RESEND_FROM_EMAIL"], async () => {
  const { data, error } = await new Resend(e.RESEND_API_KEY).domains.list();
  if (error) throw new Error(error.message);
  const domains = data?.data ?? [];
  const verified = domains.filter((domain) => domain.status === "verified").length;
  return `${domains.length} domínio(s), ${verified} verificado(s)`;
});

await check("Stripe", ["STRIPE_SECRET_KEY", "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"], async () => {
  const balance = await new Stripe(e.STRIPE_SECRET_KEY).balance.retrieve();
  return balance.livemode ? "modo live" : "modo test";
});

await check("Stripe (webhook)", ["STRIPE_WEBHOOK_SECRET"], async () => {
  if (!e.STRIPE_WEBHOOK_SECRET.startsWith("whsec_")) throw new Error("deve começar com whsec_");
  return "formato OK";
}, { optional: true });

await check("Resend (webhook)", ["RESEND_WEBHOOK_SECRET"], async () => {
  if (!e.RESEND_WEBHOOK_SECRET.startsWith("whsec_")) throw new Error("deve começar com whsec_");
  return "formato OK";
}, { optional: true });

await check("Redis", ["REDIS_URL"], async () => {
  if (/^https?:/.test(e.REDIS_URL)) {
    throw new Error("essa é a URL REST do Upstash; use a URL rediss://default:SENHA@HOST:6379 da aba ioredis");
  }
  const redis = new Redis(e.REDIS_URL, { lazyConnect: true, connectTimeout: 5000, maxRetriesPerRequest: 1 });
  try {
    await redis.connect();
    return `ping ${await redis.ping()}`;
  } finally {
    redis.disconnect();
  }
}, { optional: true });

await check("n8n", ["N8N_WEBHOOK_URL", "N8N_WEBHOOK_SECRET"], async () => {
  new URL(e.N8N_WEBHOOK_URL);
  if (e.N8N_WEBHOOK_SECRET.length < 32) throw new Error("secret precisa ter no mínimo 32 caracteres");
  return "formato OK (sem ping)";
}, { optional: true });

const icons = { ok: "✓", fail: "✗", skip: "○" };
for (const { name, status, detail } of results) {
  console.log(`${icons[status]} ${name.padEnd(20)} ${detail}`);
}

const undefinedKeys = expected.filter((key) => !(key in e));
if (undefinedKeys.length > 0) console.log(`\nAusentes no .env.local: ${undefinedKeys.join(", ")}`);

process.exitCode = results.some((result) => result.status === "fail") ? 1 : 0;
