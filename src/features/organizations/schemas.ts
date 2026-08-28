import { z } from "zod";

export const organizationKindSchema = z.enum(["freelancer", "agency"]);
export const memberRoleSchema = z.enum(["owner", "admin", "member"]);
export const invitableRoleSchema = z.enum(["admin", "member"]);

export const organizationNameSchema = z.string().trim().min(2).max(80);
export const organizationSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(40)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);

export const inviteEmailSchema = z.email().trim().toLowerCase();
export const inviteTokenSchema = z.string().regex(/^[0-9a-f]{64}$/);

export const createOrganizationSchema = z.object({
  name: organizationNameSchema,
  slug: organizationSlugSchema,
  kind: organizationKindSchema,
});

export const createInviteSchema = z.object({
  organizationId: z.uuid(),
  email: inviteEmailSchema,
  role: invitableRoleSchema,
});
