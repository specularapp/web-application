import type { CSSProperties, ReactNode } from "react";
import { StoredImage } from "@/components/ui/stored-image";
import { CodeBlock } from "./code-block";
import { cx } from "@/lib/utils/cx";
import type { DocNode } from "@/lib/rich-doc";
import styles from "./rich-text.module.css";

/**
 * O documento desenhado, nó por nó (2026-09-22). É o par de leitura do editor: a mesma árvore, o mesmo CSS,
 * e nada de HTML injetado, que é a regra que o contrato já seguia desde que o texto rico nasceu na casa.
 *
 * Peça estática, sem diretiva de cliente: ela serve tanto o servidor, que desenha a descrição no primeiro
 * carregamento, quanto a ficha, que a mostra enquanto ninguém está editando. É o que faz o editor de verdade
 * só chegar ao navegador quando alguém clica para editar.
 */

export type RichTextViewProps = {
  doc: DocNode | null | undefined;
  /** O que aparece quando não há nada escrito; sem isto, documento vazio não desenha nada. */
  placeholder?: string;
  className?: string;
};

/** Só endereços que abrem numa aba: o resto vira texto, porque o conteúdo é de quem escreveu, não do link. */
const safeHref = (value: unknown) => (typeof value === "string" && /^https?:\/\//i.test(value) ? value : null);

const alignOf = (node: DocNode): CSSProperties | undefined => {
  const align = node.attrs?.textAlign;
  return typeof align === "string" ? { textAlign: align as CSSProperties["textAlign"] } : undefined;
};

function renderText(node: DocNode, key: number): ReactNode {
  let out: ReactNode = node.text ?? "";
  for (const mark of node.marks ?? []) {
    if (mark.type === "bold") out = <strong key={`${key}-b`}>{out}</strong>;
    else if (mark.type === "italic") out = <em key={`${key}-i`}>{out}</em>;
    else if (mark.type === "underline") out = <u key={`${key}-u`}>{out}</u>;
    else if (mark.type === "strike") out = <s key={`${key}-s`}>{out}</s>;
    else if (mark.type === "code") out = <code key={`${key}-c`}>{out}</code>;
    else if (mark.type === "link") {
      const href = safeHref(mark.attrs?.href);
      out = href ? (
        <a key={`${key}-a`} href={href} target="_blank" rel="noreferrer">
          {out}
        </a>
      ) : (
        out
      );
    }
  }
  return <span key={key}>{out}</span>;
}

const children = (node: DocNode) => node.content?.map((child, index) => renderNode(child, index)) ?? null;

export function renderNode(node: DocNode, key = 0): ReactNode {
  switch (node.type) {
    case "doc":
      return <div key={key}>{children(node)}</div>;

    case "heading": {
      const level = Number(node.attrs?.level ?? 2);
      const Tag = (level <= 1 ? "h2" : level === 2 ? "h3" : "h4") as "h2" | "h3" | "h4";
      return (
        <Tag key={key} style={alignOf(node)}>
          {children(node)}
        </Tag>
      );
    }

    case "paragraph":
      return (
        <p key={key} style={alignOf(node)}>
          {node.content?.length ? children(node) : <br />}
        </p>
      );

    case "text":
      return renderText(node, key);

    case "bulletList":
      return <ul key={key}>{children(node)}</ul>;

    case "orderedList":
      return <ol key={key}>{children(node)}</ol>;

    case "listItem":
      return <li key={key}>{children(node)}</li>;

    /* A lista de tarefas é a única que não usa a marca da lista: cada item traz a própria caixa, e aqui ela
       é lida, e não mexida, então vem desligada e sem foco. */
    case "taskList":
      return (
        <ul key={key} data-type="taskList">
          {children(node)}
        </ul>
      );

    case "taskItem": {
      const checked = node.attrs?.checked === true;
      return (
        <li key={key} data-type="taskItem" data-checked={checked ? "true" : "false"}>
          <span>
            <input type="checkbox" checked={checked} disabled readOnly aria-label={checked ? "Feito" : "A fazer"} />
            <span />
          </span>
          <div>{children(node)}</div>
        </li>
      );
    }

    case "blockquote":
      return <blockquote key={key}>{children(node)}</blockquote>;

    /* O bloco de código tem barra com a linguagem e o copiar, e o realce chega por importação dinâmica: o
       texto dele é puro, então sai do nó direto em vez de passar pelo desenho de marcas. */
    case "codeBlock": {
      const code = (node.content ?? []).map((child) => child.text ?? "").join("");
      const language = typeof node.attrs?.language === "string" ? node.attrs.language : null;
      return <CodeBlock key={key} code={code} language={language} />;
    }

    case "horizontalRule":
      return <hr key={key} />;

    case "hardBreak":
      return <br key={key} />;

    case "image": {
      const src = node.attrs?.src;
      if (typeof src !== "string" || !src) return null;
      const alt = typeof node.attrs?.alt === "string" ? node.attrs.alt : "";
      /* Pelo `StoredImage`, como toda imagem nossa: arquivo do Storage passa pelo otimizador com corte na
         medida e cache longo, e endereço de fora segue cru. */
      return (
        <figure key={key}>
          <StoredImage src={src} alt={alt} width={960} height={540} sizes="(max-width: 47.9375rem) 100vw, 44rem" />
          {alt && <figcaption>{alt}</figcaption>}
        </figure>
      );
    }

    default:
      return null;
  }
}

export function RichTextView({ doc, placeholder, className }: RichTextViewProps) {
  const empty = !doc?.content?.some((node) => node.type !== "paragraph" || (node.content?.length ?? 0) > 0);

  if (empty) {
    return placeholder ? <p className={cx(styles.body, styles.empty, className)}>{placeholder}</p> : null;
  }

  return <div className={cx(styles.body, className)}>{doc ? children(doc) : null}</div>;
}
