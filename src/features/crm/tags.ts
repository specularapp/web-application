import { createTagCatalog, type TagOption } from "@/lib/tags";

/**
 * A gama de etiquetas de uma oportunidade (2026-09-16), no mesmo contrato das outras. Ela não repete o que
 * a oportunidade já guarda em campo próprio (temperatura, etapa, origem): serve para o que não tem campo,
 * como o porte da venda, o que trava o fechamento e o que a proposta envolve.
 */
export type OpportunityTag = TagOption;

const catalog = createTagCatalog([
  { id: "Alto valor", hue: "var(--sys-yellow)", group: "Porte" },
  { id: "Ticket médio", hue: "var(--sys-orange)", group: "Porte" },
  { id: "Entrada", hue: "var(--sys-brown)", group: "Porte" },
  { id: "Recorrente", hue: "var(--sys-orange)", group: "Porte" },

  { id: "Urgente", hue: "var(--sys-red)", group: "Ritmo" },
  { id: "Sem pressa", hue: "var(--sys-gray)", group: "Ritmo" },
  { id: "Prazo apertado", hue: "var(--sys-red)", group: "Ritmo" },

  { id: "Aguarda orçamento", hue: "var(--sys-blue)", group: "Trava" },
  { id: "Aguarda decisão", hue: "var(--sys-indigo)", group: "Trava" },
  { id: "Preço", hue: "var(--sys-blue)", group: "Trava" },
  { id: "Concorrência", hue: "var(--sys-indigo)", group: "Trava" },
  { id: "Escopo aberto", hue: "var(--sys-blue)", group: "Trava" },

  { id: "Design", hue: "var(--sys-purple)", group: "Escopo" },
  { id: "Desenvolvimento", hue: "var(--sys-teal)", group: "Escopo" },
  { id: "Conteúdo", hue: "var(--sys-mint)", group: "Escopo" },
  { id: "Manutenção", hue: "var(--sys-teal)", group: "Escopo" },
  { id: "Consultoria", hue: "var(--sys-mint)", group: "Escopo" },
]);

export const opportunityTagCatalog = catalog;
export const opportunityTags = catalog.options;

/** Os nomes da gama, para o zod da ficha aceitar só o que o leque oferece. */
export const opportunityTagValues = catalog.values;

/** O matiz de uma etiqueta; o que não está na gama fica no cinza, em vez de derrubar a tela. */
export const opportunityTagHue = catalog.hueOf;
