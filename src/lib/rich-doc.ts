import { z } from "zod";

/**
 * O documento de texto rico da casa, num lugar só (2026-09-22). É a forma do JSON que o editor grava, e é a
 * mesma do contrato, que a inaugurou em 2026-09-14: uma árvore de nós com marcas, guardada como dado e
 * **desenhada nó por nó**, nunca injetada como HTML.
 *
 * O tipo é solto de propósito (`type: string`), porque a árvore é genérica; quem fecha a lista de nós e de
 * marcas é o zod de cada domínio, que sabe quais deles a tela desenha. Nó fora da lista é recusado no
 * servidor, e não ignorado: o documento é o conteúdo, e aceitar calado o que não se desenha é perder o que
 * a pessoa escreveu sem avisar.
 */

export type DocMark = { type: string; attrs?: Record<string, unknown> };

export type DocNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: DocNode[];
  marks?: DocMark[];
  text?: string;
};

/** Quantos nós a árvore tem, para o teto valer sobre o todo e não só sobre a raiz. */
export function countNodes(node: DocNode): number {
  return 1 + (node.content?.reduce((sum, child) => sum + countNodes(child), 0) ?? 0);
}

/**
 * O esquema de uma árvore com a lista de nós e de marcas que o domínio desenha. Recebe as listas em vez de
 * fechá-las aqui porque contrato e tarefa não escrevem a mesma coisa: um tem cláusula e citação, o outro tem
 * lista de tarefas e imagem.
 */
export function docNodeSchemaFor(nodeTypes: readonly [string, ...string[]], markTypes: readonly [string, ...string[]]): z.ZodType<DocNode> {
  const markSchema = z.object({
    type: z.enum(markTypes),
    attrs: z.record(z.string(), z.unknown()).optional(),
  });

  const schema: z.ZodType<DocNode> = z.lazy(() =>
    z.object({
      type: z.enum(nodeTypes),
      attrs: z.record(z.string(), z.unknown()).optional(),
      content: z.array(schema).optional(),
      marks: z.array(markSchema).optional(),
      text: z.string().max(20_000).optional(),
    }),
  );

  return schema;
}

/** Os nós que quebram linha na leitura em texto puro: entre dois deles entra uma quebra, e não um espaço. */
const BLOCKS = new Set([
  "paragraph",
  "heading",
  "listItem",
  "taskItem",
  "blockquote",
  "codeBlock",
  "horizontalRule",
  "image",
]);

/**
 * O documento achatado em texto puro. É o que a busca varre e o que o cartão e o resumo mostram: procurar
 * dentro de um jsonb aninhado com índice de trigrama não existe, e uma lista de quatro itens precisa virar
 * quatro linhas, e não uma frase emendada.
 */
export function docText(node: DocNode | null | undefined): string {
  if (!node) return "";

  const parts: string[] = [];

  const walk = (current: DocNode) => {
    if (current.type === "text" && current.text) {
      parts.push(current.text);
      return;
    }
    if (current.type === "hardBreak") {
      parts.push("\n");
      return;
    }
    for (const child of current.content ?? []) walk(child);
    if (BLOCKS.has(current.type)) parts.push("\n");
  };

  walk(node);

  return parts
    .join("")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Se a árvore tem algum conteúdo de verdade: documento vazio é o parágrafo que o editor deixa ao abrir. */
export const docIsEmpty = (node: DocNode | null | undefined) => docText(node).length === 0 && !hasNode(node, "image");

/** Se algum nó do tipo pedido existe na árvore; é como o vazio sabe que uma imagem sozinha conta. */
export function hasNode(node: DocNode | null | undefined, type: string): boolean {
  if (!node) return false;
  if (node.type === type) return true;
  return (node.content ?? []).some((child) => hasNode(child, type));
}

/** O documento mínimo que o editor abre: um parágrafo vazio. */
export const emptyDoc = (): DocNode => ({ type: "doc", content: [{ type: "paragraph" }] });
