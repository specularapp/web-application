import { z } from "zod";
import { countNodes, docNodeSchemaFor, type DocNode } from "@/lib/rich-doc";
import { stageGlyphValues, stageKindValues } from "./stages";
import { taskTagValues } from "./tags";

/**
 * O teto de cada campo de texto, num lugar só: é daqui que sai tanto a validação do servidor quanto o
 * `maxLength` do campo na tela, e os números batem com os `check` da tabela, que é a barreira que vale
 * também para o aplicativo.
 */
export const taskLimits = {
  title: 120,
  /** O teto do texto puro do documento, que é o que a coluna `description` guarda para a busca. */
  description: 20000,
  /** Quantos nós a descrição aceita: uma lista de trinta itens com imagens cabe folgada, e um documento
   *  colado de fora não entra inteiro sem ninguém perceber. */
  descriptionNodes: 2000,
  alert: 300,
  comment: 4000,
  subtask: 200,
} as const;

/** Quantas etiquetas uma tarefa leva (2026-09-22, a pedido): menos que a regra geral da casa, porque o cartão
 *  e a ficha as mostram inteiras, e acima disso a etiqueta deixa de separar uma tarefa da outra. */
export const TASK_MAX_TAGS = 8;

export const priorityValues = ["low", "normal", "high", "urgent"] as const;
export const attachmentTypeValues = ["pdf", "image", "figma", "link", "file"] as const;

/* Os nós e as marcas que a descrição aceita: a mesma lista que o editor oferece e que o `RichTextView`
   desenha. Nó fora dela é recusado no servidor, e não ignorado, porque o documento é o que a pessoa
   escreveu. */
const descriptionNodes = [
  "doc",
  "paragraph",
  "heading",
  "text",
  "bulletList",
  "orderedList",
  "listItem",
  "taskList",
  "taskItem",
  "blockquote",
  "codeBlock",
  "horizontalRule",
  "hardBreak",
  "image",
] as const;

const descriptionMarks = ["bold", "italic", "underline", "strike", "code", "link"] as const;

const docSchema = docNodeSchemaFor(descriptionNodes, descriptionMarks);

/** Todo endereço de imagem do documento aponta para um arquivo servido por HTTPS; o resto não entra. */
function imagesAreSafe(node: DocNode): boolean {
  if (node.type === "image") {
    const src = node.attrs?.src;
    return typeof src === "string" && src.startsWith("https://");
  }
  return (node.content ?? []).every(imagesAreSafe);
}

/**
 * A descrição como documento (2026-09-22). Nula é a tarefa que ainda não tem descrição nenhuma; o texto puro
 * dela, para a busca e para o cartão, é derivado no servidor e não vem da tela.
 */
export const taskDescriptionSchema = docSchema
  .nullable()
  .refine((node) => !node || node.type === "doc", "A descrição precisa começar pela raiz")
  .refine((node) => !node || countNodes(node) <= taskLimits.descriptionNodes, "Descrição longa demais")
  .refine((node) => !node || imagesAreSafe(node), "Imagem de endereço inválido");

const isoDay = z.iso.date("Data inválida");
const blank = z.literal("");

/** O que a ficha de tarefa aceita, na criação e na edição: é o mesmo formulário. */
/** O nome de uma tarefa que ninguém nomeou: ela existe, aparece no quadro e espera o título. */
export const DEFAULT_TASK_TITLE = "Nova tarefa";

export const taskFormSchema = z
  .object({
    /** Presente na edição; ausente na criação. */
    id: z.uuid().optional(),
    /** Nulo é o balde de quem não tem projeto: tarefa solta continua tendo lugar. */
    projectId: z.uuid().nullable(),
    /* Título em branco vira o padrão, e não erro: a tarefa nasce antes de ser nomeada, e uma ficha aberta
       que se recusa a gravar por causa do nome trava quem só queria anotar o resto. */
    title: z
      .string()
      .trim()
      .max(taskLimits.title, "Título longo demais")
      .transform((value) => value || DEFAULT_TASK_TITLE),
    /** O documento da descrição; o texto puro dele é derivado no servidor, para a busca e para o cartão. */
    description: taskDescriptionSchema.default(null),
    dueDate: isoDay,
    startDate: z.union([blank, isoDay]),
    estimate: z.number().int().min(1, "A estimativa precisa ser positiva").max(100000).nullable(),
    /** A etapa é a linha do catálogo da equipe, então o que vem é o id dela. */
    stageId: z.uuid("Escolha uma etapa"),
    priority: z.enum(priorityValues),
    ownerId: z.uuid().nullable(),
    /* Etiqueta é escolha da gama do domínio, e não texto livre (regra de `lib/tags.ts`): o leque só oferece
       essas, e o servidor recusa o resto, que é o que mantém nome e cor iguais em toda a base. */
    tags: z.array(z.enum(taskTagValues, { message: "Escolha uma etiqueta da lista" })).max(TASK_MAX_TAGS, `No máximo ${TASK_MAX_TAGS} etiquetas`),
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
  stageId: z.uuid(),
  position: z.number().int().min(0).max(100000),
});

export const taskIdSchema = z.uuid();

/** O identificador que a pessoa lê, como vem no endereço: `TAR-2026-0005`. */
export const taskReferenceSchema = z.string().trim().regex(/^[A-Z]{3}-\d{4}-\d{4,}$/);

/** Uma marcação dentro de um comentário: o sinal digitado e o que ele aponta. */
const mentionSchema = z.object({
  token: z.string().trim().min(1).max(120),
  kind: z.enum(["person", "task", "client", "quote", "project", "contract", "catalog"]),
  name: z.string().trim().min(1).max(120),
  reference: z.string().trim().max(40).optional(),
  recordKey: z.string().trim().max(120).optional(),
  /** O rosto de quem foi marcado, guardado junto para a conversa desenhar a pessoa e não só o nome. */
  avatarUrl: z.url().max(800).nullable().optional(),
});


/* As etapas da equipe (2026-09-21). O teto do nome bate com o `check` da coluna, e a cor e o glifo são
   listas fechadas, as mesmas dos enums do banco: é o que impede uma cor inventada de virar um quadrado sem
   cor na tela. */
export const stageLimits = { name: 40 } as const;

export const paletteHueValues = [
  "red",
  "orange",
  "yellow",
  "green",
  "mint",
  "teal",
  "cyan",
  "blue",
  "indigo",
  "purple",
  "pink",
  "brown",
  "gray",
] as const;

export const saveStageSchema = z.object({
  /** Presente ao editar; ausente ao criar. */
  id: z.uuid().optional(),
  name: z.string().trim().min(1, "Dê um nome à etapa").max(stageLimits.name, "Nome longo demais"),
  hue: z.enum(paletteHueValues),
  glyph: z.enum(stageGlyphValues),
  kind: z.enum(stageKindValues),
});

export type SaveStageInput = z.infer<typeof saveStageSchema>;

/** Apagar uma etapa: com tarefas dentro, é preciso dizer para onde elas vão. */
export const deleteStageSchema = z.object({ id: z.uuid(), moveTo: z.uuid().nullable().default(null) });

/** A ordem do catálogo da equipe, na ordem em que as etapas aparecem. */
export const stageOrderSchema = z.object({ ids: z.array(z.uuid()).min(1).max(60) });

/** As colunas de um quadro: as etapas que ele usa, na ordem, sem repetir. */
export const projectStagesSchema = z.object({
  id: z.uuid(),
  stageIds: z
    .array(z.uuid())
    .min(1, "O quadro precisa de ao menos uma etapa")
    .max(60)
    .refine((list) => new Set(list).size === list.length, "Etapa repetida"),
});

/**
 * A tarefa que nasce já aberta (2026-09-22, a pedido: "ao invés de abrir um modal independente, ele já abrir
 * a visualização de uma tarefa mesmo"). Só o lugar dela; o resto se preenche na ficha, que grava sozinha.
 */
export const createTaskSchema = z.object({
  /* O id nasce na tela (2026-09-22, a pedido de tudo responder no mesmo segundo): a ficha abre com ele antes
     de o banco responder, e a gravação chega depois sem precisar trocar de tarefa no meio. */
  id: z.uuid().optional(),
  projectId: z.uuid().nullable().default(null),
  stageId: z.uuid(),
});

/** Salvar só a descrição, que é o que a ficha grava sozinha enquanto a pessoa escreve. */
export const saveTaskDescriptionSchema = z.object({ id: z.uuid(), description: taskDescriptionSchema });

/** A imagem que vai para dentro da descrição: o dono dela e o tipo do arquivo. */
export const taskImageUploadSchema = z.object({
  taskId: z.uuid(),
  contentType: z.enum(["image/png", "image/jpeg", "image/webp", "image/avif"]),
});

/**
 * As etapas da equipe arrumadas de uma vez (2026-09-22, no desenho que o funil de vendas já usa): a lista
 * inteira, na ordem, com o que é novo sem id; e, à parte, as que saem, cada uma dizendo para onde vão as
 * tarefas que estavam nela. Uma janela só e uma gravação só, em vez de três janelas conversando entre si.
 */
export const configureStagesSchema = z.object({
  stages: z
    .array(
      z.object({
        id: z.uuid().optional(),
        name: z.string().trim().min(1, "Dê um nome à etapa").max(stageLimits.name, "Nome longo demais"),
        hue: z.enum(paletteHueValues),
        glyph: z.enum(stageGlyphValues),
        kind: z.enum(stageKindValues),
      }),
    )
    .min(1, "A equipe precisa de ao menos uma etapa")
    .max(60),
  /** As que saem, com o destino das tarefas de cada uma. */
  removals: z.array(z.object({ id: z.uuid(), moveTo: z.uuid().nullable().default(null) })).max(60).default([]),
  /** O quadro que está sendo arrumado, quando é o de um projeto: as colunas dele ficam sendo estas. */
  projectId: z.uuid().nullable().default(null),
});

export type ConfigureStagesInput = z.infer<typeof configureStagesSchema>;

/* ---------------------------------- o que muda dentro da ficha ---------------------------------- */

/** Um arquivo que já subiu para o Storage: o caminho dele e o que a lista mostra. */
const storedFileSchema = z.object({
  path: z.string().trim().min(1).max(600),
  name: z.string().trim().min(1).max(200),
  type: z.enum(attachmentTypeValues),
  sizeBytes: z.number().int().positive().max(26214400).nullable().default(null),
});

export const linkKindOptions = ["client", "quote", "project", "contract"] as const;

/**
 * Tudo o que se mexe dentro da ficha e não é campo do formulário (2026-09-22, a pedido: "os dados precisam
 * propagar na tarefa de fato e não sumir"). Uma entrada só, com a operação no `op`, para a web e o
 * aplicativo passarem pela mesma regra: comentário com áudio e arquivos, subtarefas, envolvidos, vínculos,
 * anexos e o envio de arquivo. Os ids novos nascem na tela, para a lista mostrar a linha antes de o banco
 * responder e continuar falando da mesma linha depois.
 */
export const taskChangeSchema = z.discriminatedUnion("op", [
  z
    .object({
      op: z.literal("comment"),
      text: z.string().trim().max(taskLimits.comment, "Comentário longo demais"),
      mentions: z.array(mentionSchema).max(30).default([]),
      audio: z.object({ path: z.string().trim().min(1).max(600), seconds: z.number().int().min(1).max(7200) }).nullable().default(null),
      files: z.array(storedFileSchema).max(10).default([]),
    })
    .refine((value) => value.text.length > 0 || value.audio !== null || value.files.length > 0, "Escreva, grave ou anexe alguma coisa"),
  z.object({
    op: z.literal("subtask-add"),
    id: z.uuid(),
    title: z.string().trim().min(1, "Dê um nome à subtarefa").max(200),
    assigneeId: z.uuid().nullable().default(null),
    priority: z.enum(priorityValues).nullable().default(null),
    dueDate: isoDay.nullable().default(null),
  }),
  z.object({
    op: z.literal("subtask-update"),
    id: z.uuid(),
    title: z.string().trim().min(1).max(200).optional(),
    done: z.boolean().optional(),
    assigneeId: z.uuid().nullable().optional(),
    priority: z.enum(priorityValues).nullable().optional(),
    dueDate: isoDay.nullable().optional(),
  }),
  z.object({ op: z.literal("subtask-remove"), id: z.uuid() }),
  /* A ordem da lista inteira, depois de a pessoa arrastar uma subtarefa para outro lugar. */
  z.object({
    op: z.literal("subtask-order"),
    ids: z
      .array(z.uuid())
      .min(1)
      .max(200)
      .refine((list) => new Set(list).size === list.length, "Subtarefa repetida"),
  }),
  z.object({ op: z.literal("people"), userIds: z.array(z.uuid()).max(30) }),
  /* A prioridade e as etiquetas trocadas do próprio cartão do quadro (2026-09-23), sem abrir a ficha. */
  z.object({ op: z.literal("priority"), priority: z.enum(priorityValues) }),
  z.object({ op: z.literal("due"), dueDate: isoDay }),
  z.object({
    op: z.literal("tags"),
    tags: z.array(z.enum(taskTagValues, { message: "Escolha uma etiqueta da lista" })).max(TASK_MAX_TAGS, `No máximo ${TASK_MAX_TAGS} etiquetas`),
  }),
  z.object({ op: z.literal("link-add"), kind: z.enum(linkKindOptions), recordId: z.uuid() }),
  z.object({ op: z.literal("link-remove"), kind: z.enum(linkKindOptions), recordId: z.uuid() }),
  z
    .object({
      op: z.literal("attachment-add"),
      id: z.uuid(),
      name: z.string().trim().min(1).max(200),
      type: z.enum(attachmentTypeValues),
      path: z.string().trim().min(1).max(600).optional(),
      url: z.url().max(800).optional(),
      sizeBytes: z.number().int().positive().max(26214400).nullable().default(null),
    })
    .refine((value) => Boolean(value.path) !== Boolean(value.url), "Mande o arquivo ou o endereço"),
  z.object({ op: z.literal("attachment-remove"), id: z.uuid() }),
  z.object({ op: z.literal("upload"), name: z.string().trim().min(1).max(200), contentType: z.string().trim().max(120).default("") }),
]);

export type TaskChangeInput = z.infer<typeof taskChangeSchema>;
/** A mesma mudança como a tela a monta, com os campos que têm padrão ainda opcionais. */
export type TaskChangeDraft = z.input<typeof taskChangeSchema>;

export const taskChangeRequestSchema = z.object({ taskId: z.uuid(), change: taskChangeSchema });
