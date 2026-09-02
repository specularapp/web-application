"use client";

import { loadStripe, type Stripe } from "@stripe/stripe-js";

// Uma promessa só para toda a aplicação: `loadStripe` injeta o script do Stripe, e chamar duas vezes
// carregaria de novo. A chave publicável é pública por design; a proteção é a assinatura no servidor.
let loading: Promise<Stripe | null> | null = null;

export function getStripeBrowser() {
  const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  if (!key) return null;

  loading ??= loadStripe(key, { locale: "pt-BR" });
  return loading;
}
