import "server-only";
import OpenAI from "openai";
import { env } from "@/lib/env";

let client: OpenAI | undefined;

export function getOpenAI() {
  client ??= new OpenAI({ apiKey: env.ai().OPENAI_API_KEY });
  return client;
}

export function getAiModel() {
  return env.ai().OPENAI_MODEL;
}
