import { createTagCatalog, type TagOption } from "@/lib/tags";

/**
 * A gama de etiquetas de um cliente (2026-09-16): no mesmo contrato de projetos e tarefas, etiqueta é
 * escolha de uma lista pronta, e não texto livre, então "VIP", "vip" e "V.I.P." param de conviver na base e
 * no filtro. Antes disto a ficha do cliente aceitava qualquer texto.
 *
 * As famílias respondem ao que a equipe pergunta sobre um cliente: por onde ele chegou, que tipo de conta é,
 * em que ponto da relação está, e o que ele costuma contratar.
 */
export type ClientTag = TagOption;

const catalog = createTagCatalog([
  { id: "Indicação", hue: "var(--sys-green)", group: "Origem" },
  { id: "Site", hue: "var(--sys-blue)", group: "Origem" },
  { id: "Redes sociais", hue: "var(--sys-cyan)", group: "Origem" },
  { id: "Anúncio", hue: "var(--sys-blue)", group: "Origem" },
  { id: "Evento", hue: "var(--sys-cyan)", group: "Origem" },
  { id: "Prospecção", hue: "var(--sys-green)", group: "Origem" },

  { id: "Pessoa física", hue: "var(--sys-indigo)", group: "Perfil" },
  { id: "Empresa", hue: "var(--sys-purple)", group: "Perfil" },
  { id: "Agência", hue: "var(--sys-indigo)", group: "Perfil" },
  { id: "Startup", hue: "var(--sys-purple)", group: "Perfil" },
  { id: "Órgão público", hue: "var(--sys-indigo)", group: "Perfil" },

  { id: "Recorrente", hue: "var(--sys-orange)", group: "Relação" },
  { id: "Chave", hue: "var(--sys-yellow)", group: "Relação" },
  { id: "Primeiro contato", hue: "var(--sys-brown)", group: "Relação" },
  { id: "Inativo", hue: "var(--sys-gray)", group: "Relação" },
  { id: "Em negociação", hue: "var(--sys-orange)", group: "Relação" },
  { id: "Atenção", hue: "var(--sys-red)", group: "Relação" },

  { id: "Design", hue: "var(--sys-pink)", group: "Contrata" },
  { id: "Desenvolvimento", hue: "var(--sys-teal)", group: "Contrata" },
  { id: "Conteúdo", hue: "var(--sys-mint)", group: "Contrata" },
  { id: "Manutenção", hue: "var(--sys-teal)", group: "Contrata" },
  { id: "Consultoria", hue: "var(--sys-mint)", group: "Contrata" },
]);

export const clientTagCatalog = catalog;
export const clientTags = catalog.options;

/** Os nomes da gama, para o zod da ficha aceitar só o que o leque oferece. */
export const clientTagValues = catalog.values;

/** O matiz de uma etiqueta; o que não está na gama fica no cinza, em vez de derrubar a tela. */
export const clientTagHue = catalog.hueOf;
