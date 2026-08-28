import "server-only";
import { Resend } from "resend";
import { env } from "@/lib/env";

let client: Resend | undefined;

export function getResend() {
  client ??= new Resend(env.resend().RESEND_API_KEY);
  return client;
}

export function getFromEmail() {
  return env.resend().RESEND_FROM_EMAIL;
}
