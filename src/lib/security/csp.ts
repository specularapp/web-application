import type { NextResponse } from "next/server";

const isDev = process.env.NODE_ENV === "development";

export function createNonce() {
  return Buffer.from(crypto.randomUUID()).toString("base64");
}

export function buildContentSecurityPolicy(nonce: string) {
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'nonce-${nonce}'`,
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' blob: data: https://*.supabase.co https://avatars.githubusercontent.com https://lh3.googleusercontent.com https://*.stripe.com",
    "font-src 'self' data:",
    // O Payment Element fala com api.stripe.com, manda telemetria para r.stripe.com e busca a
    // configuração de meios de pagamento em merchant-ui-api.stripe.com. Sem os três, o formulário
    // monta e não carrega o cartão.
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://r.stripe.com https://merchant-ui-api.stripe.com https://challenges.cloudflare.com",
    "frame-src https://js.stripe.com https://hooks.stripe.com https://challenges.cloudflare.com",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];
  if (!isDev) directives.push("upgrade-insecure-requests");
  return directives.join("; ");
}

export function applyContentSecurityPolicy(response: NextResponse, csp: string) {
  response.headers.set("Content-Security-Policy", csp);
  return response;
}
