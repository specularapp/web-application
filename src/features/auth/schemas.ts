import { z } from "zod";
import { isSafePath } from "@/lib/security/safe-path";

export const oauthProviderSchema = z.enum(["github", "google", "apple"]);
export type OAuthProvider = z.infer<typeof oauthProviderSchema>;

export const nextPathSchema = z.unknown().refine(isSafePath).catch("/dashboard");

export const totpCodeSchema = z.string().regex(/^\d{6}$/);
export const factorIdSchema = z.uuid();
export const friendlyNameSchema = z.string().trim().min(1).max(60);
