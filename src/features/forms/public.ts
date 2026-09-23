import "server-only";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/server";
import { checkRateLimit, clientIp } from "@/lib/security/rate-limit";
import { isShareToken } from "@/lib/security/share-token";
import { getPublicIntakeForm } from "./service";

export async function loadPublicIntakeForm(token: string) {
  if (!isShareToken(token)) return null;
  const ip = clientIp(await headers());
  const { allowed } = await checkRateLimit("publicLink", `intake-load:${ip}`, crypto.randomUUID());
  if (!allowed) return null;
  return getPublicIntakeForm(createAdminClient(), token);
}
