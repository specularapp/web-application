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
 */
export type TaskTag = {
  /** O que a tarefa guarda, e o que a pessoa lê: o nome é o próprio identificador. */
  id: string;
  /** Token de cor, como no `NavGroup`: a etiqueta se tinge sozinha pelo `hue` do `Badge`. */
  hue: string;
  /** A família, que é o título do grupo no menu de escolha. */
  group: string;
};

export const taskTags: TaskTag[] = [
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
];

const byId = new Map(taskTags.map((tag) => [tag.id, tag]));

/** O matiz de uma etiqueta; o que não está na gama fica no cinza, em vez de derrubar a tela. */
export const tagHue = (id: string) => byId.get(id)?.hue ?? "var(--sys-gray)";

/** As famílias na ordem em que aparecem, para o menu de escolha listar por grupo. */
export const tagGroups = [...new Set(taskTags.map((tag) => tag.group))];
