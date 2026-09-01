import { z } from "zod";

export const organizationKindSchema = z.enum(["freelancer", "agency"]);
export const memberRoleSchema = z.enum(["owner", "admin", "member"]);
export const invitableRoleSchema = z.enum(["admin", "member"]);
export const organizationIndustrySchema = z.enum([
  "web_development",
  "mobile_development",
  "product_design",
  "brand_design",
  "design_and_development",
  "other",
]);

export type MemberRole = z.infer<typeof memberRoleSchema>;
export type InvitableRole = z.infer<typeof invitableRoleSchema>;
export type OrganizationIndustry = z.infer<typeof organizationIndustrySchema>;

export const organizationNameSchema = z.string().trim().min(2).max(80);
export const organizationSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(40)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);

export const inviteNameSchema = z.string().trim().min(2).max(120);
export const inviteEmailSchema = z.string().trim().toLowerCase().pipe(z.email().max(254));
export const inviteTokenSchema = z.string().regex(/^[0-9a-f]{64}$/);

export const logoContentTypeSchema = z.enum(["image/png", "image/jpeg", "image/webp"]);
export type LogoContentType = z.infer<typeof logoContentTypeSchema>;
export const LOGO_MAX_BYTES = 2 * 1024 * 1024;
export const LOGO_BUCKET = "organization-logos";

export const createOrganizationSchema = z.object({
  name: organizationNameSchema,
  slug: organizationSlugSchema,
  kind: organizationKindSchema,
});

// Quem digita "meusite.com" quer https://meusite.com, e exigir o protocolo só rende erro bobo.
export function normalizeWebsite(value: string | undefined | null) {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return null;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export const saveTeamSchema = z
  .object({
    organizationId: z.uuid().optional(),
    name: organizationNameSchema,
    industry: organizationIndustrySchema,
    website: z.string().trim().max(200).optional(),
  })
  .transform((value) => ({ ...value, website: normalizeWebsite(value.website) }))
  .refine((value) => value.website === null || z.url().max(200).safeParse(value.website).success, {
    message: "Confira o endereço do site",
    path: ["website"],
  });
export type SaveTeamInput = z.infer<typeof saveTeamSchema>;

export const createInviteSchema = z.object({
  organizationId: z.uuid(),
  email: inviteEmailSchema,
  name: inviteNameSchema,
  role: invitableRoleSchema,
});
export type CreateInviteInput = z.infer<typeof createInviteSchema>;

export const memberRoleChangeSchema = z.object({
  organizationId: z.uuid(),
  userId: z.uuid(),
  role: memberRoleSchema,
});

export const memberRemovalSchema = z.object({
  organizationId: z.uuid(),
  userId: z.uuid(),
});

export const inviteRemovalSchema = z.object({
  organizationId: z.uuid(),
  inviteId: z.uuid(),
});

export const logoUploadSchema = z.object({
  organizationId: z.uuid(),
  contentType: logoContentTypeSchema,
});

export const logoAttachSchema = z.object({
  organizationId: z.uuid(),
  path: z.string().trim().min(3).max(200),
});

export const organizationIdSchema = z.object({ organizationId: z.uuid() });

// Acento vira letra simples antes do corte para "Ateliê Três" virar "atelie-tres", e não "atelie-tr-s".
export function slugify(value: string, limit = 40) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, limit)
    .replace(/-+$/g, "");
}

// O endereço deixou de ser campo e sai do nome, então precisa nascer válido mesmo com nome curto
// ou só de símbolo. Sobra espaço para o sufixo que resolve nome repetido.
export function slugFromName(name: string) {
  const base = slugify(name, 34);
  if (base.length >= 3) return base;
  const suffix = Math.random().toString(36).slice(2, 6);
  return base ? `${base}-${suffix}` : `time-${suffix}`;
}
