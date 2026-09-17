import { createTagCatalog, type TagOption } from "@/lib/tags";

/**
 * A gama de etiquetas que uma tarefa pode receber (2026-09-10, a pedido): etiqueta deixou de ser texto livre
 * e passou a ser escolha de uma lista pronta, cada uma com o próprio matiz. É o que faz a mesma coisa ter
 * sempre o mesmo nome e a mesma cor em toda tarefa, em vez de "Design", "design" e "Desing" convivendo.
 *
 * O matiz é escolhido à mão, e não sorteado por hash: as etiquetas andam em famílias (desenho, conteúdo,
 * comercial, técnico, entrega, risco), e ver a família pela cor vale mais que ter trinta cores diferentes.
 * Dentro de cada família as cores se alternam, então duas etiquetas vizinhas numa tarefa raramente repetem.
 *
 * Quando isto virar tabela, a lista vem do banco por equipe e o `id` continua sendo o que a tarefa guarda.
 * A forma e os auxiliares são os de `lib/tags.ts`, os mesmos das outras quatro gamas da casa.
 */
export type TaskTag = TagOption;

const catalog = createTagCatalog([
  { id: "Design", hue: "var(--sys-purple)", group: "Desenho" },
  { id: "Marca", hue: "var(--sys-pink)", group: "Desenho" },
  { id: "Tokens", hue: "var(--sys-indigo)", group: "Desenho" },
  { id: "Componentes", hue: "var(--sys-purple)", group: "Desenho" },
  { id: "Acessibilidade", hue: "var(--sys-indigo)", group: "Desenho" },

  { id: "Conteúdo", hue: "var(--sys-blue)", group: "Conteúdo" },
  { id: "Vídeo", hue: "var(--sys-cyan)", group: "Conteúdo" },
  { id: "Redes", hue: "var(--sys-blue)", group: "Conteúdo" },
  { id: "Apresentação", hue: "var(--sys-cyan)", group: "Conteúdo" },
  { id: "Portfólio", hue: "var(--sys-blue)", group: "Conteúdo" },

  { id: "Comercial", hue: "var(--sys-orange)", group: "Comercial" },
  { id: "Orçamento", hue: "var(--sys-yellow)", group: "Comercial" },
  { id: "Contratos", hue: "var(--sys-orange)", group: "Comercial" },
  { id: "Preço", hue: "var(--sys-yellow)", group: "Comercial" },
  { id: "Pesquisa", hue: "var(--sys-brown)", group: "Comercial" },
  { id: "Reunião", hue: "var(--sys-brown)", group: "Comercial" },
  { id: "Escopo", hue: "var(--sys-orange)", group: "Comercial" },

  { id: "Integração", hue: "var(--sys-teal)", group: "Técnico" },
  { id: "Pagamento", hue: "var(--sys-mint)", group: "Técnico" },
  { id: "Infraestrutura", hue: "var(--sys-teal)", group: "Técnico" },
  { id: "Performance", hue: "var(--sys-mint)", group: "Técnico" },
  { id: "Migração", hue: "var(--sys-teal)", group: "Técnico" },
  { id: "Automação", hue: "var(--sys-mint)", group: "Técnico" },
  { id: "Loja", hue: "var(--sys-teal)", group: "Técnico" },

  { id: "Entrega", hue: "var(--sys-green)", group: "Entrega" },
  { id: "Publicação", hue: "var(--sys-green)", group: "Entrega" },
  { id: "Revisão", hue: "var(--sys-gray)", group: "Entrega" },
  { id: "Aprovação", hue: "var(--sys-gray)", group: "Entrega" },

  { id: "Segurança", hue: "var(--sys-red)", group: "Risco" },
  { id: "Bloqueio", hue: "var(--sys-red)", group: "Risco" },
]);

export const taskTagCatalog = catalog;
export const taskTags = catalog.options;

/** Os nomes da gama, para o zod da ficha aceitar só o que o leque oferece. */
export const taskTagValues = catalog.values;

/** O matiz de uma etiqueta; o que não está na gama fica no cinza, em vez de derrubar a tela. */
export const tagHue = catalog.hueOf;

/** As famílias na ordem em que aparecem, para o menu de escolha listar por grupo. */
export const tagGroups = catalog.groups;
