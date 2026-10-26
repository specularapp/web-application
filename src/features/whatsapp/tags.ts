import { createTagCatalog } from "@/lib/tags";

/** A gama de etiquetas de um contato do WhatsApp, no mesmo contrato das outras gamas da casa. */
export const whatsappTagCatalog = createTagCatalog([
  { id: "Cliente", hue: "var(--sys-green)", group: "Relação" },
  { id: "Lead quente", hue: "var(--sys-red)", group: "Relação" },
  { id: "Lead frio", hue: "var(--sys-gray)", group: "Relação" },
  { id: "Parceiro", hue: "var(--sys-mint)", group: "Relação" },

  { id: "Orçamento enviado", hue: "var(--sys-blue)", group: "Andamento" },
  { id: "Aguarda pagamento", hue: "var(--sys-orange)", group: "Andamento" },
  { id: "Suporte", hue: "var(--sys-indigo)", group: "Andamento" },

  { id: "Site", hue: "var(--sys-teal)", group: "Escopo" },
  { id: "Identidade visual", hue: "var(--sys-purple)", group: "Escopo" },
  { id: "Aplicativo", hue: "var(--sys-teal)", group: "Escopo" },
  { id: "Manutenção", hue: "var(--sys-purple)", group: "Escopo" },
]);
