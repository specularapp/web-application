import { z } from "zod";
import { MAX_TAGS } from "@/lib/tags";
import { stageValues } from "./stages";
import { taskTagValues } from "./tags";

/**
 * O teto de cada campo de texto, num lugar só: é daqui que sai tanto a validação do servidor quanto o
 * `maxLength` do campo na tela, e os números batem com os `check` da tabela, que é a barreira que vale
 * também para o aplicativo.
 */
export const taskLimits = {
  title: 120,
  description: 4000,
  alert: 300,
  comment: 4000,
  subtask: 200,
} as const;

export { MAX_TAGS };

export const priorityValues = ["low", "normal", "high", "urgent"] as const;
export const attachmentTypeValues = ["pdf", "image", "figma", "link", "file"] as const;

const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida");
const blank = z.literal("");

/** O que a ficha de tarefa aceita, na criação e na edição: é o mesmo formulário. */
export const taskFormSchema = z
  .object({
    /** Presente na edição; ausente na criação. */
    id: z.uuid().optional(),
    /** Nulo é o balde de quem não tem projeto: tarefa solta continua tendo lugar. */
    projectId: z.uuid().nullable(),
    title: z.string().trim().min(2, "Dê um título à tarefa").max(taskLimits.title, "Título longo demais"),
    description: z.string().trim().max(taskLimits.description, "Descrição longa demais"),
    dueDate: isoDay,
    startDate: z.union([blank, isoDay]),
    estimate: z.number().int().min(1, "A estimativa precisa ser positiva").max(100000).nullable(),
    stage: z.enum(stageValues),
    priority: z.enum(priorityValues),
    ownerId: z.uuid().nullable(),
    /* Etiqueta é escolha da gama do domínio, e não texto livre (regra de `lib/tags.ts`): o leque só oferece
       essas, e o servidor recusa o resto, que é o que mantém nome e cor iguais em toda a base. */
    tags: z.array(z.enum(taskTagValues, { message: "Escolha uma etiqueta da lista" })).max(MAX_TAGS, `No máximo ${MAX_TAGS} etiquetas`),
    alert: z.union([blank, z.string().trim().max(taskLimits.alert, "Aviso longo demais")]),
  })
  .superRefine((data, ctx) => {
    if (data.startDate && data.dueDate < data.startDate) {
      ctx.addIssue({ code: "custom", path: ["dueDate"], message: "O prazo não pode vir antes do começo" });
    }
  });

export type TaskFormInput = z.infer<typeof taskFormSchema>;

/** Arrastar o cartão de coluna: a tarefa, a etapa de destino e onde ela ficou na coluna. */
export const taskMoveSchema = z.object({
  id: z.uuid(),
  stage: z.enum(stageValues),
  position: z.number().int().min(0).max(100000),
});

export const taskIdSchema = z.uuid();

export const subtaskToggleSchema = z.object({ id: z.uuid(), done: z.boolean() });

/** Uma marcação dentro de um comentário: o sinal digitado e o que ele aponta. */
const mentionSchema = z.object({
  token: z.string().trim().min(1).max(120),
  kind: z.enum(["person", "task", "client", "quote", "project", "contract", "catalog"]),
  name: z.string().trim().min(1).max(120),
  reference: z.string().trim().max(40).optional(),
  recordKey: z.string().trim().max(120).optional(),
});

export const taskCommentSchema = z.object({
  taskId: z.uuid(),
  text: z.string().trim().min(1, "Escreva alguma coisa").max(taskLimits.comment, "Comentário longo demais"),
  mentions: z.array(mentionSchema).max(30),
});

export type TaskCommentInput = z.infer<typeof taskCommentSchema>;
