import { createTagCatalog, type TagOption } from "@/lib/tags";

/**
 * A gama de etiquetas que um projeto pode receber (2026-09-13, a pedido: "etiquetas abre um leque de opção,
 * acesse em tarefas"), no mesmo contrato de `features/tasks/tags.ts`: etiqueta é escolha de uma lista pronta,
 * e não texto livre, então a mesma coisa tem sempre o mesmo nome e a mesma cor em todo projeto, em vez de
 * "Web design", "web-design" e "Webdesign" convivendo na base e no filtro.
 *
 * A gama é a do trabalho de estúdio, agrupada pelo que o projeto entrega: desenho, código, conteúdo, entrega
 * e relação. O matiz é escolhido à mão, por família, como nas tarefas: ver a família pela cor vale mais que
 * ter vinte cores diferentes. Quando isto virar tabela, a lista vem do banco por equipe e o `id` continua
 * sendo o que o projeto guarda. A forma e os auxiliares são os de `lib/tags.ts`.
 */
export type ProjectTag = TagOption;

const catalog = createTagCatalog([
  { id: "Web design", hue: "var(--sys-purple)", group: "Desenho" },
  { id: "Product design", hue: "var(--sys-indigo)", group: "Desenho" },
  { id: "Design system", hue: "var(--sys-purple)", group: "Desenho" },
  { id: "Branding", hue: "var(--sys-pink)", group: "Desenho" },
  { id: "Identidade visual", hue: "var(--sys-pink)", group: "Desenho" },
  { id: "Papelaria", hue: "var(--sys-purple)", group: "Desenho" },

  { id: "Desenvolvimento", hue: "var(--sys-teal)", group: "Código" },
  { id: "Manutenção", hue: "var(--sys-mint)", group: "Código" },
  { id: "Integração", hue: "var(--sys-teal)", group: "Código" },
  { id: "Automação", hue: "var(--sys-mint)", group: "Código" },
  { id: "Performance", hue: "var(--sys-teal)", group: "Código" },

  { id: "Conteúdo", hue: "var(--sys-blue)", group: "Conteúdo" },
  { id: "SEO", hue: "var(--sys-cyan)", group: "Conteúdo" },
  { id: "Redes sociais", hue: "var(--sys-blue)", group: "Conteúdo" },
  { id: "Vídeo", hue: "var(--sys-cyan)", group: "Conteúdo" },
  { id: "Portfólio", hue: "var(--sys-blue)", group: "Conteúdo" },

  { id: "Landing page", hue: "var(--sys-green)", group: "Entrega" },
  { id: "Loja virtual", hue: "var(--sys-green)", group: "Entrega" },
  { id: "Aplicativo", hue: "var(--sys-mint)", group: "Entrega" },
  { id: "Sistema interno", hue: "var(--sys-green)", group: "Entrega" },

  { id: "Comercial", hue: "var(--sys-orange)", group: "Relação" },
  { id: "Consultoria", hue: "var(--sys-yellow)", group: "Relação" },
  { id: "Treinamento", hue: "var(--sys-brown)", group: "Relação" },
  { id: "Suporte", hue: "var(--sys-orange)", group: "Relação" },
]);

export const projectTagCatalog = catalog;
export const projectTags = catalog.options;

/** Os nomes da gama, para o zod da ficha aceitar só o que o leque oferece. */
export const projectTagValues = catalog.values;

/** O matiz de uma etiqueta; o que não está na gama fica no cinza, em vez de derrubar a tela. */
export const projectTagHue = catalog.hueOf;

/** As famílias na ordem em que aparecem, para o leque listar por grupo. */
export const projectTagGroups = catalog.groups;
