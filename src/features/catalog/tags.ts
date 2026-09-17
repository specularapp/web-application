import { createTagCatalog, type TagOption } from "@/lib/tags";

/**
 * A gama de etiquetas de um produto ou serviço (2026-09-16), no mesmo contrato das outras: escolha de lista
 * pronta, e não texto livre. É o que faz o filtro do catálogo e o do orçamento falarem a mesma língua.
 *
 * As famílias respondem ao que a equipe pergunta sobre um item: que tecnologia ele envolve, para quem serve,
 * como ele é vendido e o que ele entrega.
 */
export type CatalogTag = TagOption;

const catalog = createTagCatalog([
  { id: "Web", hue: "var(--sys-teal)", group: "Tecnologia" },
  { id: "Mobile", hue: "var(--sys-mint)", group: "Tecnologia" },
  { id: "Design", hue: "var(--sys-purple)", group: "Tecnologia" },
  { id: "Infraestrutura", hue: "var(--sys-teal)", group: "Tecnologia" },
  { id: "Integração", hue: "var(--sys-mint)", group: "Tecnologia" },
  { id: "Automação", hue: "var(--sys-teal)", group: "Tecnologia" },

  { id: "Pequeno negócio", hue: "var(--sys-blue)", group: "Público" },
  { id: "Empresa", hue: "var(--sys-indigo)", group: "Público" },
  { id: "Agência", hue: "var(--sys-blue)", group: "Público" },
  { id: "Profissional", hue: "var(--sys-indigo)", group: "Público" },

  { id: "Recorrente", hue: "var(--sys-orange)", group: "Venda" },
  { id: "Avulso", hue: "var(--sys-yellow)", group: "Venda" },
  { id: "Sob medida", hue: "var(--sys-brown)", group: "Venda" },
  { id: "Pacote", hue: "var(--sys-orange)", group: "Venda" },
  { id: "Carro-chefe", hue: "var(--sys-yellow)", group: "Venda" },

  { id: "Entrega rápida", hue: "var(--sys-green)", group: "Entrega" },
  { id: "Projeto longo", hue: "var(--sys-green)", group: "Entrega" },
  { id: "Com suporte", hue: "var(--sys-mint)", group: "Entrega" },
  { id: "Com garantia", hue: "var(--sys-green)", group: "Entrega" },
]);

export const catalogTagCatalog = catalog;
export const catalogTags = catalog.options;

/** Os nomes da gama, para o zod da ficha aceitar só o que o leque oferece. */
export const catalogTagValues = catalog.values;

/** O matiz de uma etiqueta; o que não está na gama fica no cinza, em vez de derrubar a tela. */
export const catalogTagHue = catalog.hueOf;
