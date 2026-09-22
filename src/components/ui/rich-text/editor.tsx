"use client";

import {
  BracketsCurlyIcon,
  CaretDownIcon,
  CheckSquareIcon,
  CodeIcon,
  DotsThreeIcon,
  LinkSimpleIcon,
  ListBulletsIcon,
  ListNumbersIcon,
  QuotesIcon,
  TextBIcon,
  TextHOneIcon,
  TextHTwoIcon,
  TextItalicIcon,
  TextStrikethroughIcon,
  TextTIcon,
  TextUnderlineIcon,
} from "@phosphor-icons/react";
import { CodeBlockLowlight } from "@tiptap/extension-code-block-lowlight";
import { Placeholder } from "@tiptap/extensions";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { StarterKit } from "@tiptap/starter-kit";
import { useEffect, useRef, type ReactNode } from "react";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { IconButton } from "@/components/ui/icon-button";
import { Spinner } from "@/components/ui/spinner";
import { useEventCallback } from "@/hooks/use-event-callback";
import type { DocNode } from "@/lib/rich-doc";
import { codeBlockNodeView } from "./code-block-node";
import { lowlight } from "./highlight";
import { Figure, TaskItem, TaskList } from "./nodes";
import styles from "./rich-text.module.css";

/**
 * O editor de texto rico da casa (2026-09-22, a pedido de a descrição da tarefa funcionar "igual um notion",
 * com títulos, caixas de marcar, listas e imagens). É o mesmo motor do editor de contrato, que já mora aqui
 * desde 2026-09-14, com o conjunto de blocos apertado para caber numa ficha em vez de numa folha A4.
 *
 * Três decisões seguram o "sem pesar o sistema" que foi pedido junto:
 *
 * - **Quem lê não carrega o editor.** A leitura é o `RichTextView`, estático e sem cliente nenhum; esta peça
 *   só chega ao navegador quando alguém entra no modo de edição, pelo `LazyRichTextEditor`.
 * - **Atalho de escrita antes de barra de ferramentas.** `# `, `- `, `1. `, `> `, `[] ` e três crases já
 *   viram bloco enquanto se digita, porque quem escreve não quer tirar a mão do teclado; a bolha da seleção
 *   cuida das marcas, e a barra, que só existe no modo com moldura, é para quem não conhece os atalhos.
 * - **Nada de componente por linha.** A caixa de marcar é um atributo trocado por um plugin, e não uma view
 *   em React por item, que numa lista de trinta seria trinta componentes montados.
 *
 * A imagem entra colada, arrastada ou pelo botão, e nas três ela **sobe antes de aparecer**: um endereço
 * `blob:` do navegador só existe naquela aba e sumiria no primeiro recarregamento.
 */

export type RichTextEditorProps = {
  value: DocNode | null;
  onChange: (doc: DocNode) => void;
  /** O texto de exemplo do primeiro parágrafo vazio. */
  placeholder?: string;
  label: string;
  disabled?: boolean;
  /**
   * Sobe a imagem escolhida e devolve o endereço dela, ou o erro. Sem isto a imagem não entra: nem pelo
   * botão, nem colada, nem arrastada. É o caso da tarefa que ainda não existe, em que não há pasta para o
   * arquivo.
   */
  onUploadImage?: (file: File) => Promise<{ ok: true; url: string } | { ok: false; error: string }>;
  /** Avisa o erro de uma imagem que não subiu, para quem chama mostrar no padrão da tela. */
  onImageError?: (message: string) => void;
  /** Põe o cursor no fim do texto assim que o editor monta: é o que faz o clique no texto já deixar escrevendo. */
  focusOnMount?: boolean;
};

/** Um botão da barra ou da bolha, no mesmo desenho do editor de contrato. */
function Tool({ label, icon, on = false, disabled = false, onClick }: { label: string; icon: ReactNode; on?: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <IconButton label={label} variant={on ? "secondary" : "ghost"} size="sm" radius="md" aria-pressed={on} disabled={disabled} onClick={onClick}>
      {icon}
    </IconButton>
  );
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Escreva os detalhes",
  label,
  disabled = false,
  onUploadImage,
  onImageError,
  focusOnMount = false,
}: RichTextEditorProps) {
  const editorRef = useRef<Editor | null>(null);
  const canUpload = Boolean(onUploadImage);

  /* As funções de quem chama mudam a cada tecla da ficha; presas numa identidade fixa, o editor não é
     remontado por isso, e o que o ProseMirror chama por dentro é sempre a versão em vigor. */
  const change = useEventCallback(onChange);
  const upload = useEventCallback(async (file: File) =>
    onUploadImage ? onUploadImage(file) : ({ ok: false, error: "Sem lugar para guardar a imagem." } as const),
  );
  const fail = useEventCallback((message: string) => onImageError?.(message));

  /**
   * As imagens que chegam pelo botão, coladas ou arrastadas. Cada arquivo sobe e entra no texto como nó de
   * imagem, na ordem em que veio; a que falhar avisa e não interrompe as outras.
   */
  const insertImages = useEventCallback(async (files: File[], at?: number) => {
    const editor = editorRef.current;
    if (!editor || files.length === 0) return;

    let position = at;

    for (const file of files) {
      const result = await upload(file);
      if (!result.ok) {
        fail(result.error);
        continue;
      }

      const node = { type: "image", attrs: { src: result.url, alt: file.name.replace(/\.[^.]+$/, "") } };
      if (position === undefined) editor.chain().focus().insertContent(node).run();
      else editor.chain().focus().insertContentAt(position, node).run();
      /* Só a primeira cai no ponto em que foi solta; as seguintes entram depois dela. */
      position = undefined;
    }
  });

  const imagesOf = (list: FileList | undefined | null) => Array.from(list ?? []).filter((file) => file.type.startsWith("image/"));

  const editor = useEditor({
    immediatelyRender: false,
    editable: !disabled,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: { openOnClick: false, autolink: true },
        /* O bloco de código do StarterKit sai para entrar o que realça: são o mesmo nó, com o mesmo nome, e
           os dois juntos brigariam pelo tipo. */
        codeBlock: false,
      }),
      /* O bloco ganha a casca da leitura, com o copiar na quina: a descrição fica em edição enquanto a
         ficha está aberta, então é este desenho que se vê quase sempre. */
      CodeBlockLowlight.extend({ addNodeView: codeBlockNodeView }).configure({ lowlight, defaultLanguage: "typescript" }),
      TaskList,
      TaskItem,
      Figure,
      Placeholder.configure({ placeholder }),
    ],
    content: value ?? undefined,
    editorProps: {
      attributes: { class: styles.body, "aria-label": label },
      /* Colar uma imagem é anexá-la: o navegador manda o arquivo no `clipboardData`, e sem isto ela entraria
         como um endereço `blob:` que só existe naquela aba. */
      handlePaste: (_view, event) => {
        const files = imagesOf(event.clipboardData?.files);
        if (files.length === 0 || !canUpload) return false;
        event.preventDefault();
        void insertImages(files);
        return true;
      },
      /* Arrastar para dentro solta a imagem no ponto em que o cursor está, e não no fim do texto. */
      handleDrop: (view, event, _slice, moved) => {
        if (moved) return false;
        const files = imagesOf(event.dataTransfer?.files);
        if (files.length === 0 || !canUpload) return false;
        event.preventDefault();
        const at = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos;
        void insertImages(files, at);
        return true;
      },
    },
    onUpdate: ({ editor: instance }) => change(instance.getJSON() as unknown as DocNode),
    autofocus: focusOnMount ? "end" : false,
  });

  /* O editor precisa de si mesmo dentro dos manipuladores do ProseMirror, que nascem junto dele; a
     referência é preenchida depois da montagem, e não durante o render, que é o que o React pede. */
  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [editor, disabled]);

  const state = useEditorState({
    editor,
    selector: ({ editor: instance }) => ({
      bold: instance?.isActive("bold") ?? false,
      italic: instance?.isActive("italic") ?? false,
      underline: instance?.isActive("underline") ?? false,
      strike: instance?.isActive("strike") ?? false,
      code: instance?.isActive("code") ?? false,
      link: instance?.isActive("link") ?? false,
      h2: instance?.isActive("heading", { level: 2 }) ?? false,
      h3: instance?.isActive("heading", { level: 3 }) ?? false,
      bullet: instance?.isActive("bulletList") ?? false,
      ordered: instance?.isActive("orderedList") ?? false,
      task: instance?.isActive("taskList") ?? false,
      quote: instance?.isActive("blockquote") ?? false,
      codeBlock: instance?.isActive("codeBlock") ?? false,
      paragraph: instance?.isActive("paragraph") ?? false,
    }),
  });

  if (!editor || !state) {
    return (
      <div className={styles.editor} aria-busy="true">
        <div className={styles.surface}>
          <Spinner size="sm" />
        </div>
      </div>
    );
  }

  /* O link pergunta o endereço e some quando a pessoa apaga o que estava lá. É o `prompt` do navegador de
     propósito: uma janela nossa por cima de outra, só para uma linha de texto, custaria mais do que ajuda. */
  const toggleLink = () => {
    const current = editor.getAttributes("link").href as string | undefined;
    const href = window.prompt("Endereço do link", current ?? "https://");
    if (href === null) return;
    if (!href.trim()) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: href.trim() }).run();
  };

  /**
   * Em que bloco o trecho está, e a lista para trocá-lo. O leque mostra o nome, e não só o glifo: "citação"
   * e "código" são dois quadrados parecidos numa fila de ícones, e aqui a escolha é de uma coisa por vez.
   */
  const blocks = [
    { id: "paragraph", label: "Texto", icon: TextTIcon, on: state.paragraph, run: () => editor.chain().focus().setParagraph().run() },
    { id: "h2", label: "Título", icon: TextHOneIcon, on: state.h2, run: () => editor.chain().focus().toggleHeading({ level: 2 }).run() },
    { id: "h3", label: "Subtítulo", icon: TextHTwoIcon, on: state.h3, run: () => editor.chain().focus().toggleHeading({ level: 3 }).run() },
    { id: "bullet", label: "Lista", icon: ListBulletsIcon, on: state.bullet, run: () => editor.chain().focus().toggleBulletList().run() },
    { id: "ordered", label: "Lista numerada", icon: ListNumbersIcon, on: state.ordered, run: () => editor.chain().focus().toggleOrderedList().run() },
    { id: "task", label: "Lista de marcar", icon: CheckSquareIcon, on: state.task, run: () => editor.chain().focus().toggleList("taskList", "taskItem").run() },
    { id: "quote", label: "Citação", icon: QuotesIcon, on: state.quote, run: () => editor.chain().focus().toggleBlockquote().run() },
    { id: "code", label: "Código", icon: BracketsCurlyIcon, on: state.codeBlock, run: () => editor.chain().focus().toggleCodeBlock().run() },
  ];

  /* O bloco em vigor nomeia o gatilho; sem nenhum marcado, vale "Texto", que é o que um parágrafo é. */
  const block = blocks.find((entry) => entry.on && entry.id !== "paragraph") ?? blocks[0];

  const blockItems = blocks.map((entry) => ({
    id: entry.id,
    label: entry.label,
    icon: entry.icon,
    selected: entry.id === block.id,
    onSelect: entry.run,
  }));

  /* As marcas que não cabem na fila: as três de fora são negrito, itálico e link. */
  const markItems = [
    { id: "underline", label: "Sublinhado", icon: TextUnderlineIcon, selected: state.underline, onSelect: () => editor.chain().focus().toggleUnderline().run() },
    { id: "strike", label: "Tachado", icon: TextStrikethroughIcon, selected: state.strike, onSelect: () => editor.chain().focus().toggleStrike().run() },
    { id: "code", label: "Código no texto", icon: CodeIcon, selected: state.code, onSelect: () => editor.chain().focus().toggleCode().run() },
  ];

  return (
    <div className={styles.editor}>
      <div className={styles.surface}>
        <EditorContent editor={editor} />
      </div>

      {/* A bolha é uma fila só, que nunca quebra linha (2026-09-22, a pedido): o que é escolha de bloco vai
          num leque, porque ali só um vale por vez e o nome ajuda mais que o glifo; as três marcas do dia a
          dia ficam soltas, porque são as que se aperta sem pensar; e o resto vai no leque da ponta. São
          seis alvos, e não quatorze, o que cabe numa tela de 320px sem dobrar a bolha. */}
      <BubbleMenu editor={editor} className={styles.bubble} shouldShow={({ from, to }) => from !== to}>
        <DropdownMenu
          label="Transformar o bloco"
          triggerLabel={`Bloco: ${block.label}. Transformar em outro`}
          size="sm"
          sections={[{ id: "blocks", label: "Transformar em", items: blockItems }]}
          triggerContent={
            <span className={styles.pick}>
              <block.icon aria-hidden="true" />
              <span className={styles.pickName}>{block.label}</span>
              <CaretDownIcon weight="bold" aria-hidden="true" />
            </span>
          }
        />
        <span className={styles.divider} aria-hidden="true" />
        <Tool label="Negrito" icon={<TextBIcon />} on={state.bold} onClick={() => editor.chain().focus().toggleBold().run()} />
        <Tool label="Itálico" icon={<TextItalicIcon />} on={state.italic} onClick={() => editor.chain().focus().toggleItalic().run()} />
        <Tool label="Link" icon={<LinkSimpleIcon />} on={state.link} onClick={toggleLink} />
        <span className={styles.divider} aria-hidden="true" />
        <DropdownMenu
          label="Mais formatação"
          triggerLabel="Mais formatação"
          size="sm"
          icon={<DotsThreeIcon weight="bold" />}
          sections={[{ id: "marks", label: "Estilo do texto", items: markItems }]}
        />
      </BubbleMenu>
    </div>
  );
}
