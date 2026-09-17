/**
 * A forma de uma gama de etiquetas, igual em todo domínio que tem etiqueta.
 *
 * Etiqueta é **escolha de uma lista pronta**, e não texto livre. É o que faz a mesma coisa ter sempre o
 * mesmo nome e a mesma cor em toda a base, em vez de "Web design", "web-design" e "Webdesign" convivendo no
 * cadastro e no filtro. Nasceu nas tarefas em 2026-09-10, passou para os projetos em 2026-09-13 e virou a
 * regra de todo domínio em 2026-09-16.
 *
 * O matiz é escolhido à mão, por família: as etiquetas andam em grupos, e ver a família pela cor vale mais
 * que ter trinta cores diferentes. Dentro de cada família as cores se alternam, então duas etiquetas
 * vizinhas no mesmo registro raramente repetem.
 *
 * Quando a gama virar tabela, a lista vem do banco por equipe e o `id` continua sendo o que o registro
 * guarda: é por isso que o identificador é o próprio nome que a pessoa lê.
 */
export type TagOption = {
  /** O que o registro guarda, e o que a pessoa lê: o nome é o próprio identificador. */
  id: string;
  /** Token de cor: a etiqueta se tinge sozinha pelo `hue` do `Badge` e pela bolinha do seletor. */
  hue: string;
  /** A família, que é o título do grupo no leque de escolha. */
  group: string;
};

export type TagCatalog = {
  options: TagOption[];
  /** Os nomes da gama, para o zod da ficha aceitar só o que o leque oferece. */
  values: [string, ...string[]];
  /** O matiz de uma etiqueta; o que não está na gama fica no cinza, em vez de derrubar a tela. */
  hueOf: (id: string) => string;
  /** As famílias na ordem em que aparecem, para o leque listar por grupo. */
  groups: string[];
  /** As etiquetas de uma família, na ordem da gama. */
  inGroup: (group: string) => TagOption[];
};

/**
 * Monta a gama de um domínio. Existe para as cinco gamas da casa serem literalmente a mesma coisa: sem ela,
 * cada domínio reescrevia o mapa por id, a lista de nomes e a lista de famílias, e a quinta cópia divergia
 * da primeira no primeiro acerto.
 */
export function createTagCatalog(options: TagOption[]): TagCatalog {
  const byId = new Map(options.map((tag) => [tag.id, tag]));

  return {
    options,
    values: options.map((tag) => tag.id) as [string, ...string[]],
    hueOf: (id: string) => byId.get(id)?.hue ?? "var(--sys-gray)",
    groups: [...new Set(options.map((tag) => tag.group))],
    inGroup: (group: string) => options.filter((tag) => tag.group === group),
  };
}

/** Quantas etiquetas um registro aceita. O mesmo número em todo domínio, do zod ao campo da tela. */
export const MAX_TAGS = 12;
