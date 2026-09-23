import { z } from "zod";

export const approvalIdSchema = z.uuid();
export const approvalVersionIdSchema = z.uuid();
export const approvalSourceTypeSchema = z.enum(["url", "images"]);
export const approvalDecisionSchema = z.enum(["approved", "changes_requested", "rejected"]);

export const createApprovalSchema = z.object({
  projectId: z.uuid("Escolha um projeto."),
  taskId: z.uuid().nullable().optional(),
  title: z.string().trim().min(2, "Informe o título.").max(120),
  description: z.string().trim().max(1200).default(""),
});

const approvalVersionFields = {
  title: z.string().trim().min(2, "Informe o título da versão.").max(120),
  notes: z.string().trim().max(2000).default(""),
  sourceType: approvalSourceTypeSchema,
  previewUrl: z.string().trim().max(800).default("").refine((value) => !value || /^https?:\/\//i.test(value), "Informe uma URL completa."),
};

function validateApprovalVersion(value: { sourceType: "url" | "images"; previewUrl: string }, context: z.RefinementCtx) {
  if (value.sourceType === "url" && !value.previewUrl) context.addIssue({ code: "custom", path: ["previewUrl"], message: "Informe a URL da entrega." });
  if (value.sourceType === "images" && value.previewUrl) context.addIssue({ code: "custom", path: ["previewUrl"], message: "Anexe as imagens em vez de informar uma URL." });
}

export const createApprovalVersionBodySchema = z.object(approvalVersionFields).superRefine(validateApprovalVersion);
export const createApprovalVersionSchema = z.object({ approvalId: z.uuid(), ...approvalVersionFields }).superRefine(validateApprovalVersion);

export const submitApprovalDecisionSchema = z.object({
  versionId: z.uuid(),
  decision: approvalDecisionSchema,
  feedback: z.string().trim().max(3000).default(""),
  respondentName: z.string().trim().max(80).default("").refine((value) => !value || value.length >= 2, "Informe seu nome completo."),
}).superRefine((value, context) => {
  if (value.decision !== "approved" && value.feedback.length < 2) context.addIssue({ code: "custom", path: ["feedback"], message: "Explique o que precisa ser alterado." });
});

export const approvalImageTypeSchema = z.enum(["image/png", "image/jpeg", "image/webp", "image/avif"]);
export const prepareApprovalAssetSchema = z.object({ versionId: z.uuid(), contentType: approvalImageTypeSchema, name: z.string().trim().min(1).max(200) });
export const attachApprovalAssetSchema = z.object({ versionId: z.uuid(), path: z.string().trim().min(1).max(800), name: z.string().trim().min(1).max(200), position: z.number().int().min(0).max(49) });
export const publishApprovalVersionSchema = z.object({ versionId: z.uuid() });

export type CreateApprovalInput = z.infer<typeof createApprovalSchema>;
export type CreateApprovalVersionInput = z.infer<typeof createApprovalVersionSchema>;
export type SubmitApprovalDecisionInput = z.infer<typeof submitApprovalDecisionSchema>;
