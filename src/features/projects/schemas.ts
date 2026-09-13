import { z } from "zod";
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
export const projectLimits = {
  name: 60,
  url: 120,
  description: 100,
} as const;

/** Quantas etiquetas um projeto aceita. Sai daqui para o zod e para o campo, num número só. */
export const MAX_TAGS = 12;

/**
 * O teto da capa em caracteres: a imagem sobe embutida (`data:image/...`), já redimensionada no navegador
 * para 1440 por 810, e precisa caber no envio da action, que é de 1 MB. Quando o armazenamento de arquivos
 * nascer, o campo passa a levar o endereço do arquivo e o teto some.
 */
export const COVER_MAX_CHARS = 800_000;

const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data");

/* Vazio é sem capa; embutida é a que acabou de ser escolhida; com protocolo é a que já estava guardada. */
const coverUrl = z
  .string()
  .max(COVER_MAX_CHARS, "Imagem grande demais")
  .refine((value) => value === "" || /^data:image\/(png|jpeg|webp);base64,/.test(value) || /^https?:\/\//.test(value), "Imagem inválida");

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
    clientId: z.string().trim().min(1, "Escolha o cliente"),
    ownerName: z.string().trim().min(1, "Escolha quem responde pelo projeto"),
    status: z.enum(projectStatusValues),
    isPublic: z.boolean(),
    /* Etiqueta é escolha da gama de `tags.ts`, e não texto livre: o leque só oferece essas, e o servidor
       recusa o resto, que é o que mantém nome e cor iguais em toda a base. */
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
