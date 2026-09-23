import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import { isShareToken } from "@/lib/security/share-token";
import { getPublicClientFeedback } from "./service";

export async function loadPublicClientFeedback(token: string) {
  if (!isShareToken(token)) return null;
  return getPublicClientFeedback(createAdminClient(), token);
}
