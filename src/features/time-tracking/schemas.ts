import { z } from "zod";

export const startTimerSchema = z.object({
  projectId: z.uuid().nullable().optional(),
  taskId: z.uuid().nullable().optional(),
  note: z.string().trim().max(300).default(""),
}).refine((value) => Boolean(value.projectId || value.taskId), "Escolha um projeto ou uma tarefa.");

export const stopTimerSchema = z.object({ id: z.uuid() });
export type StartTimerInput = z.infer<typeof startTimerSchema>;
export const taskTimeSchema = z.object({ taskId: z.uuid() });
