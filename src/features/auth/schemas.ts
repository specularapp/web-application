import { z } from "zod";

export const oauthProviderSchema = z.enum(["github", "google", "apple"]);
export type OAuthProvider = z.infer<typeof oauthProviderSchema>;

export const nextPathSchema = z
  .string()
  .max(512)
  .regex(/^\/(?!\/)/)
  .catch("/dashboard");

export const totpCodeSchema = z.string().regex(/^\d{6}$/);
export const factorIdSchema = z.uuid();
export const friendlyNameSchema = z.string().trim().min(1).max(60);
