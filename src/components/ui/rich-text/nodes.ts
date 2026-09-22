import { Node, mergeAttributes, wrappingInputRule } from "@tiptap/core";
import { Plugin } from "@tiptap/pm/state";

/**
 * Os dois nós que o texto rico da casa tem além do que vem no `StarterKit`: a lista de tarefas com marca e a
 * imagem que ocupa a largura do texto.
 *
 * São escritos aqui, e não trazidos em pacote (`@tiptap/extension-task-list`, `@tiptap/extension-image`),
 * porque cada pacote do Tiptap exige a versão exata do núcleo e são mais duas dependências para o que cabe
 * em cem linhas: um `li` com atributo e um clique que o alterna, e uma figura com endereço e legenda. A
 * regra da casa é não instalar biblioteca sem necessidade clara, e aqui não há.
 */

export type TaskItemOptions = Record<string, never>;

/** `[] ` e `[x] ` no começo da linha abrem a lista de tarefas, como no editor que a referência imita. */
const TASK_INPUT = /^\s*(\[([( |x])?\])\s$/;

export const TaskList = Node.create({
  name: "taskList",
  group: "block list",
  content: "taskItem+",

  parseHTML() {
    return [{ tag: 'ul[data-type="taskList"]', priority: 51 }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["ul", mergeAttributes(HTMLAttributes, { "data-type": "taskList" }), 0];
  },
});

export const TaskItem = Node.create({
  name: "taskItem",
  content: "paragraph block*",
  defining: true,

  addAttributes() {
    return {
      checked: {
        default: false,
        keepOnSplit: false,
        parseHTML: (element) => element.getAttribute("data-checked") === "true",
        renderHTML: (attributes) => ({ "data-checked": attributes.checked ? "true" : "false" }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'li[data-type="taskItem"]', priority: 51 }];
  },

  /* A marca é um `input` de verdade, e não um quadrado desenhado: é ele que o leitor de tela anuncia como
     caixa de seleção, e `contenteditable=false` é o que impede o cursor de entrar dentro dela. */
  renderHTML({ node, HTMLAttributes }) {
    return [
      "li",
      mergeAttributes(HTMLAttributes, { "data-type": "taskItem" }),
      [
        "label",
        { contenteditable: "false" },
        ["input", { type: "checkbox", ...(node.attrs.checked ? { checked: "checked" } : {}) }],
        ["span"],
      ],
      ["div", {}, 0],
    ];
  },

  addKeyboardShortcuts() {
    return {
      Enter: () => this.editor.commands.splitListItem(this.name),
      "Shift-Tab": () => this.editor.commands.liftListItem(this.name),
    };
  },

  addInputRules() {
    return [
      wrappingInputRule({
        find: TASK_INPUT,
        type: this.type,
        getAttributes: (match) => ({ checked: match[match.length - 1] === "x" }),
      }),
    ];
  },

  /* O clique na marca alterna o item. Vai por plugin, e não por uma view em React: uma view por item custa
     um componente montado por linha, e o que se quer aqui é um atributo mudando. */
  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          handleClick: (view, _pos, event) => {
            const target = event.target as HTMLElement | null;
            if (!target || target.nodeName !== "INPUT") return false;

            const item = target.closest("li");
            if (!item) return false;

            const at = view.posAtDOM(item, 0) - 1;
            const node = view.state.doc.nodeAt(at);
            if (!node || node.type.name !== "taskItem") return false;

            if (!view.editable) {
              event.preventDefault();
              return true;
            }

            view.dispatch(view.state.tr.setNodeMarkup(at, undefined, { ...node.attrs, checked: !node.attrs.checked }));
            return true;
          },
        },
      }),
    ];
  },
});

/**
 * A imagem do texto: ela ocupa a largura da coluna, como as "imagens estendidas" da referência, e guarda só
 * o endereço e o texto alternativo. O arquivo em si já subiu para o Storage antes de o nó existir.
 */
export const Figure = Node.create({
  name: "image",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      src: { default: null },
      alt: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: "img[src]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["img", mergeAttributes(HTMLAttributes, { loading: "lazy", decoding: "async" })];
  },
});
