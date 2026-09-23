import "server-only";
import { isShareToken } from "@/lib/security/share-token";
import { createAdminClient } from "@/lib/supabase/server";
import { getPublicApproval } from "./service";

export async function loadPublicApproval(token: string) {
  if (!isShareToken(token)) return null;
  return getPublicApproval(createAdminClient(), token);
}
