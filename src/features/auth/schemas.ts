import { z } from "zod";
import { isSafePath } from "@/lib/security/safe-path";

export const oauthProviderSchema = z.enum(["github", "google", "apple"]);
export type OAuthProvider = z.infer<typeof oauthProviderSchema>;

export const nextPathSchema = z.unknown().refine(isSafePath).catch("/dashboard");

export const signInSchema = z.object({
  email: z.email().trim().toLowerCase().max(254),
  password: z.string().min(1).max(128),
  remember: z.boolean(),
});
export type SignInInput = z.infer<typeof signInSchema>;

export const totpCodeSchema = z.string().regex(/^\d{6}$/);
export const factorIdSchema = z.uuid();
export const friendlyNameSchema = z.string().trim().min(1).max(60);

export const signUpSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.email().max(254),
  password: z.string().min(8).max(72),
});

export const emailSchema = z.email().max(254);
