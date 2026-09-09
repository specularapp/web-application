import { z } from "zod";
import { catalogHues } from "./list-options";
import type { CatalogKind, CatalogUnit } from "./summary";

export const catalogKinds = ["product", "service"] as const satisfies readonly CatalogKind[];
export const catalogUnits = ["project", "hour", "month", "unit"] as const satisfies readonly CatalogUnit[];

/* A lista de matizes mora em `list-options.ts`, junto de quem deriva a cor pelo nome do item: ela roda no
   cliente também, e este arquivo carrega o zod. Segue saindo daqui para quem já a importava. */
export { catalogHues };

/** Quantas entradas cada lista da ficha aceita: entregáveis, pré-requisitos e etiquetas. */
export const MAX_LIST_ITEMS = 12;

const int = z.number().int();
const days = int.min(1, "Informe o prazo em dias").max(730, "Prazo longo demais");

/**
 * O que a ficha de produto ou serviço aceita, na criação e na edição: é o mesmo formulário. Dinheiro em
 * centavos, como em todo lugar do produto; prazo e revisões só fazem sentido em serviço, estoque só em
 * produto, e o formulário manda nulo no que não se aplica.
 */
export const catalogFormSchema = z
  .object({
    /** Presente na edição; ausente na criação. */
    id: z.string().trim().min(1).optional(),
    kind: z.enum(catalogKinds),
    name: z.string().trim().min(2, "Informe o nome do item").max(80, "Nome longo demais"),
    description: z.string().trim().min(10, "Descreva o item em uma ou duas frases").max(400, "Descrição longa demais"),
    category: z.string().trim().min(2, "Informe a categoria").max(40, "Categoria longa demais"),
    price: int.min(1, "Informe o preço"),
    unit: z.enum(catalogUnits),
    /** Custo direto estimado; nulo quando a equipe não mede. */
    cost: int.min(0).nullable(),
    /** Em pontos percentuais inteiros. */
    maxDiscount: int.min(0, "O desconto não pode ser negativo").max(100, "O desconto vai até 100%"),
    supportDays: int.min(0).max(3650, "Garantia longa demais").nullable(),
    duration: z.object({ min: days, max: days }).nullable(),
    revisions: int.min(0).max(20, "Revisões demais para uma entrega").nullable(),
    stock: z
      .object({
        quantity: int.min(0, "A quantidade não pode ser negativa"),
        capacity: int.min(1, "Informe quanto cabe quando está cheio"),
        minimum: int.min(0, "O aviso não pode ser negativo"),
      })
      .nullable(),
    deliverables: z.array(z.string().trim().min(1).max(80, "Entregável longo demais")).max(MAX_LIST_ITEMS, `No máximo ${MAX_LIST_ITEMS} entregáveis`),
    requirements: z.array(z.string().trim().min(1).max(80, "Pré-requisito longo demais")).max(MAX_LIST_ITEMS, `No máximo ${MAX_LIST_ITEMS} pré-requisitos`),
    tags: z.array(z.string().trim().min(1).max(30, "Etiqueta longa demais")).max(MAX_LIST_ITEMS, `No máximo ${MAX_LIST_ITEMS} etiquetas`),
    notes: z.string().trim().max(1000, "Anotação longa demais"),
    active: z.boolean(),
  })
  .superRefine((data, ctx) => {
    if (data.duration && data.duration.max < data.duration.min) {
      ctx.addIssue({ code: "custom", path: ["duration", "max"], message: "O prazo máximo não pode ser menor que o mínimo" });
    }
    if (data.stock && data.stock.quantity > data.stock.capacity) {
      ctx.addIssue({ code: "custom", path: ["stock", "quantity"], message: "Há mais em estoque do que cabe" });
    }
    if (data.stock && data.stock.minimum > data.stock.capacity) {
      ctx.addIssue({ code: "custom", path: ["stock", "minimum"], message: "O aviso passa do que cabe" });
    }
  });

export type CatalogFormInput = z.infer<typeof catalogFormSchema>;
