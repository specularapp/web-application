import "server-only";
import Stripe from "stripe";
import { env } from "@/lib/env";

let client: Stripe | undefined;

export function getStripe() {
  client ??= new Stripe(env.stripe().STRIPE_SECRET_KEY);
  return client;
}
