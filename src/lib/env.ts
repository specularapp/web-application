import { z } from "zod";

type Reader = () => Record<string, string | undefined>;

function define<T extends z.ZodObject>(service: string, schema: T, read: Reader) {
  let cached: z.infer<T> | undefined;
  return (): z.infer<T> => {
    if (cached) return cached;
    const parsed = schema.safeParse(read());
    if (!parsed.success) {
      const fields = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
      throw new Error(`Configuração inválida para ${service}. Verifique no .env.local: ${fields}`);
    }
    cached = parsed.data;
    return cached;
  };
}

export const env = {
  supabase: define(
    "Supabase",
    z.object({
      NEXT_PUBLIC_SUPABASE_URL: z.url(),
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
    }),
    () => ({
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    }),
  ),
  supabaseAdmin: define(
    "Supabase (chave secreta)",
    z.object({ SUPABASE_SECRET_KEY: z.string().min(1) }),
    () => ({ SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY }),
  ),
  redis: define(
    "Redis",
    z.object({ REDIS_URL: z.url() }),
    () => ({ REDIS_URL: process.env.REDIS_URL }),
  ),
  resend: define(
    "Resend",
    z.object({
      RESEND_API_KEY: z.string().startsWith("re_"),
      RESEND_FROM_EMAIL: z.string().min(1),
    }),
    () => ({
      RESEND_API_KEY: process.env.RESEND_API_KEY,
      RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL,
    }),
  ),
  resendWebhook: define(
    "Resend (webhook)",
    z.object({ RESEND_WEBHOOK_SECRET: z.string().startsWith("whsec_") }),
    () => ({ RESEND_WEBHOOK_SECRET: process.env.RESEND_WEBHOOK_SECRET }),
  ),
  stripe: define(
    "Stripe",
    z.object({ STRIPE_SECRET_KEY: z.string().startsWith("sk_") }),
    () => ({ STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY }),
  ),
  stripeWebhook: define(
    "Stripe (webhook)",
    z.object({ STRIPE_WEBHOOK_SECRET: z.string().startsWith("whsec_") }),
    () => ({ STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET }),
  ),
  stripePublic: define(
    "Stripe (chave pública)",
    z.object({ NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().startsWith("pk_") }),
    () => ({ NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY }),
  ),
  turnstile: define(
    "Turnstile (chave secreta)",
    z.object({ TURNSTILE_SECRET_KEY: z.string().min(1) }),
    () => ({ TURNSTILE_SECRET_KEY: process.env.TURNSTILE_SECRET_KEY }),
  ),
  turnstilePublic: define(
    "Turnstile (chave pública)",
    z.object({ NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().min(1) }),
    () => ({ NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY }),
  ),
  n8n: define(
    "n8n",
    z.object({
      N8N_WEBHOOK_URL: z.url(),
      N8N_WEBHOOK_SECRET: z.string().min(32),
    }),
    () => ({
      N8N_WEBHOOK_URL: process.env.N8N_WEBHOOK_URL,
      N8N_WEBHOOK_SECRET: process.env.N8N_WEBHOOK_SECRET,
    }),
  ),
  ai: define(
    "OpenAI",
    z.object({
      OPENAI_API_KEY: z.string().startsWith("sk-"),
      OPENAI_MODEL: z.string().min(1).default("gpt-4o-mini"),
    }),
    () => ({ OPENAI_API_KEY: process.env.OPENAI_API_KEY, OPENAI_MODEL: process.env.OPENAI_MODEL }),
  ),
};
