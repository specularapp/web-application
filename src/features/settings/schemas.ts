import { z } from "zod";
import { passwordSchema } from "@/features/auth/schemas";

/**
 * O que as páginas de configuração aceitam: a conta de quem entra, o currículo, o domínio do portfólio e a
 * senha. Os tetos batem com os `check` das colunas, que são a barreira que vale também para o aplicativo.
 */
export const accountLimits = { fullName: 120 } as const;

export const resumeLimits = { headline: 120, bio: 1200, location: 80, skill: 40, skills: 30, links: 8, linkLabel: 40 } as const;

export const saveAccountSchema = z.object({
  fullName: z.string().trim().min(2, "Informe o seu nome").max(accountLimits.fullName, "Nome longo demais"),
});

export type SaveAccountInput = z.infer<typeof saveAccountSchema>;

export const avatarContentTypeSchema = z.enum(["image/png", "image/jpeg", "image/webp"]);

/** As duas imagens da pessoa: o rosto e a capa larga atrás dele. Sobem para o mesmo balde, na pasta dela. */
export const userImageKindSchema = z.enum(["avatar", "cover"]);

export type UserImageKind = z.infer<typeof userImageKindSchema>;

export const avatarUploadSchema = z.object({ contentType: avatarContentTypeSchema, kind: userImageKindSchema.default("avatar") });

export const avatarAttachSchema = z.object({ path: z.string().trim().min(1).max(500), kind: userImageKindSchema.default("avatar") });

export const userImageClearSchema = z.object({ kind: userImageKindSchema });

export const changePasswordSchema = z.object({ password: passwordSchema });

/** Um link do currículo: o nome que aparece e para onde vai, sempre com protocolo. */
const linkSchema = z.object({
  label: z.string().trim().min(1, "Dê um nome ao link").max(resumeLimits.linkLabel, "Nome longo demais"),
  url: z.url("Endereço inválido").max(500),
});

export type ResumeLink = z.infer<typeof linkSchema>;

export const saveResumeSchema = z.object({
  headline: z.string().trim().max(resumeLimits.headline, "Título longo demais"),
  bio: z.string().trim().max(resumeLimits.bio, "Texto longo demais"),
  location: z.string().trim().max(resumeLimits.location, "Cidade longa demais"),
  skills: z
    .array(z.string().trim().min(1).max(resumeLimits.skill, "Habilidade longa demais"))
    .max(resumeLimits.skills, `No máximo ${resumeLimits.skills} habilidades`),
  links: z.array(linkSchema).max(resumeLimits.links, `No máximo ${resumeLimits.links} links`),
  /** O endereço público: vazio é sem endereço, e sem endereço o currículo não fica público. */
  resumeSlug: z.union([
    z.literal(""),
    z
      .string()
      .trim()
      .toLowerCase()
      .min(3, "O endereço precisa de ao menos 3 caracteres")
      .max(40, "Endereço longo demais")
      .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Só letras minúsculas, números e hifens"),
  ]),
  resumePublic: z.boolean(),
});

export type SaveResumeInput = z.infer<typeof saveResumeSchema>;

/** O que a API do perfil aceita de uma vez: a conta, o currículo, ou os dois. */
export const saveProfileSchema = z
  .object({ account: saveAccountSchema.optional(), resume: saveResumeSchema.optional() })
  .refine((value) => value.account || value.resume, "Nada para salvar");

export type SaveProfileInput = z.infer<typeof saveProfileSchema>;

/** Um nome de domínio, sem protocolo nem caminho: `portfolio.estudio.com.br`. */
export const customDomainSchema = z.object({
  domain: z.union([
    z.literal(""),
    z
      .string()
      .trim()
      .toLowerCase()
      .max(253, "Domínio longo demais")
      .regex(/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/, "Digite só o domínio, como portfolio.seusite.com.br"),
  ]),
});

export const notificationIdsSchema = z.array(z.uuid()).min(1).max(500);
