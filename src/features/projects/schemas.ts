import { z } from "zod";
import { MAX_TAGS } from "@/lib/tags";
import { projectTagValues } from "./tags";
import type { ProjectStatus, ProjectTool } from "./summary";

export const projectStatusValues = ["active", "paused", "done", "cancelled"] as const satisfies readonly ProjectStatus[];

/** As ferramentas que a ficha aceita, na mesma lista fechada do modelo: marca sem arquivo não desenha nada. */
export const projectToolValues = [
  "figma",
  "adobexd",
  "adobeillustrator",
  "adobephotoshop",
  "adobepremierepro",
  "after-effects",
  "canva",
  "webflow",
  "wordpress",
  "woocommerce",
  "nextjs",
  "react",
  "vuejs",
  "nuxtjs",
  "angular",
  "typescript",
  "javascript",
  "nodejs",
  "python",
  "php",
  "flutter",
  "dart",
  "kotlin",
  "swift",
  "tailwindcss",
  "sass",
  "html5",
  "css",
  "firebase",
  "vercel",
  "cloudflare",
  "aws",
  "googlecloud",
  "docker",
  "github",
  "gitlab",
  "postgresSQL",
  "mySQL",
  "mongodb",
  "redis",
  "threejs",
  "jest",
  "vitejs",
] as const satisfies readonly ProjectTool[];

/**
 * O teto de cada campo de texto, num lugar só: é daqui que sai tanto a validação do servidor quanto o
 * `maxLength` do campo na tela, então o campo para de aceitar no mesmo ponto em que o zod recusaria. A
 * descrição tem cem caracteres porque é a linha que o cartão mostra sob o nome (a pedido, 2026-09-13).
 */
/** Quantos colaboradores um projeto aceita. Teto do servidor, não escolha da tela. */
export const MAX_MEMBERS = 50;

export const projectLimits = {
  name: 60,
  url: 120,
  description: 100,
} as const;

/* Etiqueta segue o teto comum da casa, em `lib/tags.ts`. */
export { MAX_TAGS };

/**
 * O teto da capa em caracteres, o mesmo que o banco cobra na coluna. A capa **é um endereço**, e não mais a
 * imagem embutida (2026-09-16, quando o armazenamento nasceu): ela sobe para o balde `project-covers` e o
 * que chega aqui é o endereço público. Embutida, ela ia num envio de quase um mega e era recusada pela
 * checagem de 500 caracteres da coluna, então capa de verdade nunca chegava a salvar.
 */
export const COVER_MAX_CHARS = 500;

const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data");

/**
 * As pastas de projeto (2026-09-16, a pedido). Elas já existiam no banco e já eram lidas pelo menu de
 * tarefas, que é a mesma árvore; o que faltava era poder criar, renomear, apagar e mover, que é o que estes
 * esquemas abrem.
 */
export const folderLimits = { name: 60 } as const;

export const saveFolderSchema = z.object({
  /** Presente ao renomear; ausente ao criar. */
  id: z.uuid().optional(),
  name: z.string().trim().min(1, "Dê um nome à pasta").max(folderLimits.name, "Nome longo demais"),
  /** A pasta de cima, quando ela nasce dentro de outra. */
  parentId: z.uuid().nullable().default(null),
});

export const folderIdSchema = z.uuid();

/** Para onde o projeto vai: uma pasta, ou a raiz quando é nulo. */
export const moveProjectSchema = z.object({
  id: z.uuid(),
  folderId: z.uuid().nullable(),
});

/* Vazio é sem capa; com protocolo é o endereço do arquivo no armazenamento. */
const coverUrl = z
  .string()
  .max(COVER_MAX_CHARS, "Endereço longo demais")
  .refine((value) => value === "" || /^https?:\/\//.test(value), "Imagem inválida");

/**
 * O que a ficha de projeto aceita, na criação e na edição: é o mesmo formulário. Dinheiro em centavos, como
 * em todo lugar do produto; datas em `yyyy-MM-dd`; a faixa de valor vem em dois números que o formulário
 * manda nulos quando o valor não foi combinado.
 */
export const projectFormSchema = z
  .object({
    /** Presente na edição; ausente na criação. */
    id: z.string().trim().min(1).optional(),
    name: z.string().trim().min(2, "Informe o nome do projeto").max(projectLimits.name, "Nome longo demais"),
    /** Sem protocolo vale também: a action recoloca o `https://` antes de guardar. */
    url: z.string().trim().max(projectLimits.url, "Endereço longo demais"),
    description: z.string().trim().max(projectLimits.description, "Descrição longa demais"),
    /* Vazio é projeto sem cliente; com valor, precisa ser um cliente de verdade. */
    clientId: z.union([z.literal(""), z.uuid("Escolha o cliente")]),
    ownerId: z.uuid("Escolha quem responde pelo projeto"),
    /* Os colaboradores, pelos ids da equipe. O teto é o mesmo do time que o plano maior comporta: é grade de
       segurança contra envio forjado, e não regra de produto. */
    memberIds: z.array(z.uuid("Escolha alguém da equipe")).max(MAX_MEMBERS, `No máximo ${MAX_MEMBERS} colaboradores`),
    status: z.enum(projectStatusValues),
    isPublic: z.boolean(),
    /* Etiqueta é escolha da gama do domínio, e não texto livre (regra de `lib/tags.ts`): o leque só oferece
       essas, e o servidor recusa o resto, que é o que mantém nome e cor iguais em toda a base. */
    tags: z.array(z.enum(projectTagValues, { message: "Escolha uma etiqueta da lista" })).max(MAX_TAGS, `No máximo ${MAX_TAGS} etiquetas`),
    tools: z.array(z.enum(projectToolValues)).max(projectToolValues.length),
    budgetMin: z.number().int().min(0, "O valor não pode ser negativo").nullable(),
    budgetMax: z.number().int().min(0, "O valor não pode ser negativo").nullable(),
    startedAt: isoDay,
    dueAt: z.union([z.literal(""), isoDay]),
    progress: z.number().int().min(0, "O andamento vai de 0 a 100").max(100, "O andamento vai de 0 a 100"),
    coverUrl,
  })
  .superRefine((data, ctx) => {
    if (data.budgetMin !== null && data.budgetMax !== null && data.budgetMax < data.budgetMin) {
      ctx.addIssue({ code: "custom", path: ["budgetMax"], message: "O valor máximo não pode ser menor que o mínimo" });
    }
    if (data.dueAt && data.dueAt < data.startedAt) {
      ctx.addIssue({ code: "custom", path: ["dueAt"], message: "A entrega não pode vir antes do começo" });
    }
  });

export type ProjectFormInput = z.infer<typeof projectFormSchema>;

/** O identificador de um projeto vindo da tela: uuid, porque é o que a tabela gera. */
export const projectIdSchema = z.uuid();
