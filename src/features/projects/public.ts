import "server-only";
import { headers } from "next/headers";
import { checkRateLimit, clientIp } from "@/lib/security/rate-limit";
import { isShareToken } from "@/lib/security/share-token";
import { createAdminClient } from "@/lib/supabase/server";
import { getProjectTracking, markProjectTrackingViewed } from "./tracking";

export async function loadPublicProjectTracking(token: string) {
  if (!isShareToken(token)) return null;
  const ip = clientIp(await headers());
  const { allowed } = await checkRateLimit("publicLink", `project-tracking:${ip}`, crypto.randomUUID());
  if (!allowed) return null;
  return getProjectTracking(createAdminClient(), token);
}

export async function recordPublicProjectTrackingView(token: string) {
  if (!isShareToken(token)) return;
  await markProjectTrackingViewed(createAdminClient(), token);
}
