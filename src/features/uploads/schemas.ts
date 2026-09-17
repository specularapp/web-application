import { z } from "zod";

/**
 * A subida de imagem de todo domínio, num contrato só. Cada tela tinha o seu jeito de escolher um arquivo e
 * nenhuma tinha o de guardá-lo: a imagem virava um endereço `blob:`, que só existe naquela aba, e sumia no
 * primeiro recarregamento. Era o que o usuário via como "salva e não fica" (2026-09-16).
 *
 * O alvo diz o que muda de um caso para o outro: o balde e a pasta dentro dele. Onde o endereço é gravado
 * (a tabela e a coluna) mora em `service.ts`, com os nomes escritos por extenso, porque só lá isso é usado e
 * assim o tipo gerado do banco confere cada escrita.
 */
export const uploadTargets = {
  "client-avatar": { bucket: "client-avatars", folder: "avatar" },
  "client-logo": { bucket: "client-avatars", folder: "logo" },
  "catalog-image": { bucket: "catalog-images", folder: "item" },
  "project-cover": { bucket: "project-covers", folder: "capa" },
  "project-logo": { bucket: "project-covers", folder: "logo" },
} as const;

export type UploadTarget = keyof typeof uploadTargets;

export const uploadTargetSchema = z.enum(Object.keys(uploadTargets) as [UploadTarget, ...UploadTarget[]]);

/**
 * Os tipos que os baldes aceitam. A lista é a mesma do `allowed_mime_types` da migração: dois números para a
 * mesma regra é como eles saem de sincronia, e aqui o que vale é recusar cedo, na tela, em vez de deixar o
 * Storage devolver um erro cru depois de a pessoa esperar a subida.
 */
export const imageContentTypeSchema = z.enum(["image/png", "image/jpeg", "image/webp", "image/avif"]);
export type ImageContentType = z.infer<typeof imageContentTypeSchema>;

export const imageExtensions: Record<ImageContentType, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/avif": "avif",
};

/** O teto de cada balde, em bytes, igual ao da migração. O avatar é menor porque nunca é mostrado grande. */
export const uploadMaxBytes: Record<UploadTarget, number> = {
  "client-avatar": 2 * 1024 * 1024,
  "client-logo": 2 * 1024 * 1024,
  "catalog-image": 5 * 1024 * 1024,
  "project-cover": 5 * 1024 * 1024,
  "project-logo": 2 * 1024 * 1024,
};

/* O avatar de cliente só aceita três tipos, como o balde dele; os outros aceitam avif também. */
export const avatarContentTypeSchema = z.enum(["image/png", "image/jpeg", "image/webp"]);

export function contentTypesOf(target: UploadTarget) {
  return target === "client-avatar" || target === "client-logo" ? avatarContentTypeSchema : imageContentTypeSchema;
}

export const createUploadSchema = z.object({
  target: uploadTargetSchema,
  /** O registro que vai receber a imagem: ele precisa existir antes, para a pasta ser a dele. */
  recordId: z.uuid(),
  contentType: imageContentTypeSchema,
});

export const attachUploadSchema = z.object({
  target: uploadTargetSchema,
  recordId: z.uuid(),
  path: z.string().trim().min(1).max(500),
});

export const clearUploadSchema = z.object({
  target: uploadTargetSchema,
  recordId: z.uuid(),
});
