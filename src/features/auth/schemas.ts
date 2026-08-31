import { z } from "zod";
import { isSafePath } from "@/lib/security/safe-path";

export const oauthProviderSchema = z.enum(["github", "google", "apple"]);
export type OAuthProvider = z.infer<typeof oauthProviderSchema>;

export const nextPathSchema = z.unknown().refine(isSafePath).catch("/dashboard");

export const signInSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
  password: z.string().min(1).max(128),
  remember: z.boolean(),
});
export type SignInInput = z.infer<typeof signInSchema>;

export const totpCodeSchema = z.string().regex(/^\d{6}$/);
export const factorIdSchema = z.uuid();
export const friendlyNameSchema = z.string().trim().min(1).max(60);

// O bcrypt do Supabase corta em 72 bytes, e acento ocupa dois: contar caractere deixaria
// passar senha que o servidor recusa depois, com mensagem genérica.
export const passwordSchema = z
  .string()
  .min(8)
  .max(72)
  .refine((value) => new TextEncoder().encode(value).length <= 72);

export const signUpSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
  password: passwordSchema,
});

export const emailSchema = z.string().trim().toLowerCase().pipe(z.email().max(254));

export const otpTypeSchema = z.enum(["signup", "invite", "magiclink", "recovery", "email_change", "email"]);
export type OtpType = z.infer<typeof otpTypeSchema>;

export const tokenHashSchema = z.string().trim().min(16).max(512);
