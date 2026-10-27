import { z } from "zod";
import { SEARCH_MAX_LENGTH, SEARCH_MIN_LENGTH, searchable } from "./summary";

/* Termo longo é recusado, e não cortado: a busca de cada quadro descarta o termo que passa do teto, e um
   termo descartado viraria a base inteira no resultado. */
export const searchSchema = z.object({
  term: z.string().trim().min(SEARCH_MIN_LENGTH).max(SEARCH_MAX_LENGTH).refine(searchable),
});

export type SearchInput = z.infer<typeof searchSchema>;
