import { common, createLowlight } from "lowlight";

/**
 * O realce de sintaxe do bloco de código (2026-09-22, a pedido de "uma visualização de codigo bem
 * organizada, colorida estilo vs code mesmo" e, depois, de "usar uma lib para essa parte do código para
 * ficar bem completo").
 *
 * Entra pelo conjunto **`common`** do lowlight: as trinta e sete linguagens que o highlight.js considera as
 * do dia a dia, em vez das dez que este arquivo registrava à mão. A lista completa tem cento e noventa
 * gramáticas, e essas cento e cinquenta a mais são dialetos que ninguém cola numa descrição de tarefa. O
 * conjunto só chega ao navegador junto do editor, que já é carregado sob demanda.
 *
 * O lowlight devolve uma **árvore**, e não HTML: é o formato certo para a casa, porque documento nosso é
 * desenhado nó por nó, no editor e na leitura, e nunca injetado como marcação pronta.
 */
export const lowlight = createLowlight(common);

/** As linguagens que o seletor do bloco oferece, com o nome que a pessoa lê. */
export const codeLanguages = [
  { value: "plaintext", label: "Texto" },
  { value: "typescript", label: "TypeScript" },
  { value: "javascript", label: "JavaScript" },
  { value: "json", label: "JSON" },
  { value: "xml", label: "HTML" },
  { value: "css", label: "CSS" },
  { value: "scss", label: "SCSS" },
  { value: "sql", label: "SQL" },
  { value: "python", label: "Python" },
  { value: "php", label: "PHP" },
  { value: "java", label: "Java" },
  { value: "csharp", label: "C#" },
  { value: "go", label: "Go" },
  { value: "rust", label: "Rust" },
  { value: "ruby", label: "Ruby" },
  { value: "kotlin", label: "Kotlin" },
  { value: "swift", label: "Swift" },
  { value: "bash", label: "Terminal" },
  { value: "yaml", label: "YAML" },
  { value: "markdown", label: "Markdown" },
  { value: "diff", label: "Diff" },
  { value: "graphql", label: "GraphQL" },
] as const;

export type CodeLanguage = (typeof codeLanguages)[number]["value"];

export const languageLabel = (value: string | null | undefined) =>
  codeLanguages.find((entry) => entry.value === value)?.label ?? "Texto";

/** Um pedaço de código já classificado: o texto e a classe do highlight.js que diz o que ele é. */
export type CodeToken = { text: string; kind?: string };

type HastNode = {
  type: string;
  value?: string;
  tagName?: string;
  properties?: { className?: string[] };
  children?: HastNode[];
};

/**
 * O código quebrado em pedaços com a classe de cada um, para quem desenha emitir `span`s em vez de receber
 * marcação pronta. A classe herdada desce para os filhos: o highlight.js aninha (uma string dentro de uma
 * chamada de função), e quem lê só precisa saber a cor mais específica de cada trecho.
 *
 * Sem linguagem declarada, ela é **adivinhada** pelo próprio highlight.js: colar um trecho de SQL num bloco
 * recém-criado passou a sair colorido sem ninguém dizer o que era.
 */
export function highlightTokens(code: string, language: string | null | undefined): CodeToken[] {
  const known = language && language !== "plaintext" && lowlight.registered(language);

  let tree: HastNode;
  try {
    tree = (known ? lowlight.highlight(language, code) : lowlight.highlightAuto(code)) as unknown as HastNode;
  } catch {
    return [{ text: code }];
  }

  const tokens: CodeToken[] = [];

  const walk = (node: HastNode, inherited?: string) => {
    if (node.type === "text" && node.value) {
      tokens.push(inherited ? { text: node.value, kind: inherited } : { text: node.value });
      return;
    }

    /* `hljs-keyword` vira `keyword`: a classe do highlight.js é o nome do tipo de trecho, e o prefixo só
       existe para o CSS dele, que não é o nosso. */
    const own = node.properties?.className?.find((name) => name.startsWith("hljs-"))?.slice(5);
    for (const child of node.children ?? []) walk(child, own ?? inherited);
  };

  walk(tree);
  return tokens;
}
