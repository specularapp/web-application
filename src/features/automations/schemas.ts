import { z } from "zod";
import { nodeCatalog, nodeKinds } from "./catalog";
import type { NodeKind } from "./summary";

/**
 * O zod das automações: o que chega do editor é entrada de usuário e é fechado aqui, no servidor. A lista de
 * nós é a do catálogo, o que cada nó guarda é texto, número ou booleano com teto, e o fluxo só vale com as
 * ligações apontando para nós que existem e com um gatilho no máximo.
 */

export const automationLimits = {
  name: 80,
  description: 160,
  nodes: 60,
  edges: 120,
  text: 4000,
  key: 40,
  title: 60,
} as const;

/* O id de um nó e de uma ligação é gerado no editor, no navegador: texto curto, e não uuid. */
const idSchema = z.string().trim().min(1).max(40);

/* O id da automação é o uuid que a tabela gera. */
const automationId = z.uuid();

const nodeKindSchema = z.enum(nodeKinds as [NodeKind, ...NodeKind[]]);

const configValueSchema = z.union([z.string().max(automationLimits.text), z.number().min(-1_000_000_000).max(1_000_000_000), z.boolean()]);

export const automationNodeSchema = z.object({
  id: idSchema,
  kind: nodeKindSchema,
  title: z.string().trim().max(automationLimits.title).optional(),
  x: z.number().min(-100_000).max(100_000),
  y: z.number().min(-100_000).max(100_000),
  config: z.record(z.string().max(automationLimits.key), configValueSchema),
});

export const automationEdgeSchema = z.object({
  id: idSchema,
  from: idSchema,
  to: idSchema,
  branch: z.enum(["yes", "no"]).nullable(),
});

export const saveAutomationSchema = z
  .object({
    id: automationId,
    name: z.string().trim().min(2, "Dê um nome à automação.").max(automationLimits.name, "O nome está longo demais."),
    description: z.string().trim().max(automationLimits.description, "A descrição está longa demais."),
    nodes: z.array(automationNodeSchema).max(automationLimits.nodes, "O fluxo passou do limite de passos."),
    edges: z.array(automationEdgeSchema).max(automationLimits.edges),
  })
  .superRefine((value, context) => {
    const ids = new Set<string>();
    let triggers = 0;
    for (const entry of value.nodes) {
      if (ids.has(entry.id)) context.addIssue({ code: "custom", path: ["nodes"], message: "Há passos repetidos no fluxo." });
      ids.add(entry.id);
      if (nodeCatalog[entry.kind].category === "trigger") triggers += 1;
    }
    if (triggers > 1) context.addIssue({ code: "custom", path: ["nodes"], message: "Um fluxo tem um gatilho só." });
    for (const link of value.edges) {
      if (!ids.has(link.from) || !ids.has(link.to) || link.from === link.to) {
        context.addIssue({ code: "custom", path: ["edges"], message: "Há uma ligação apontando para um passo que não existe." });
        break;
      }
    }
  });

export type SaveAutomationInput = z.infer<typeof saveAutomationSchema>;

export const createAutomationSchema = z.object({
  /** O modelo de origem; nulo começa do zero. */
  templateId: z.string().trim().max(40).nullable(),
});

export const automationIdSchema = z.object({ id: automationId });

export const automationStatusSchema = z.object({ id: automationId, status: z.enum(["active", "paused"]) });
