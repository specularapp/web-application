"use client";

import { CheckIcon, CopySimpleIcon } from "@phosphor-icons/react";
import { NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from "@tiptap/react";
import { useEffect, useRef, useState } from "react";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { IconButton } from "@/components/ui/icon-button";
import { codeLanguages, languageLabel } from "./highlight";
import styles from "./rich-text.module.css";

/**
 * O bloco de código **dentro do editor** (2026-09-22). Ele existe porque a descrição fica em modo de edição
 * enquanto a ficha está aberta: sem isto, o bloco bonito só apareceria para quem estivesse lendo, e quem
 * escreve, que é quase sempre, veria outro desenho.
 *
 * É a mesma casca da leitura (`CodeBlock`), com a linguagem e o copiar na quina, e o conteúdo continua sendo
 * o do ProseMirror, pelo `NodeViewContent`: o realce do lowlight decora esse conteúdo por dentro, e o texto
 * segue editável letra a letra.
 *
 * Uma view em React por bloco é o custo disto, e ele é baixo aqui: bloco de código é coisa de um ou dois por
 * descrição, ao contrário do item de lista, que numa lista de trinta seriam trinta componentes montados, e
 * é por isso que a caixa de marcar continua sendo um atributo trocado por plugin.
 */
function CodeBlockNodeView({ node, updateAttributes }: NodeViewProps) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const language = typeof node.attrs.language === "string" ? node.attrs.language : null;

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(node.textContent);
      setCopied(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <NodeViewWrapper className={styles.code}>
      {/* Fora do conteúdo editável: `contenteditable=false` é o que impede o cursor de entrar aqui, e o
          invólucro é quem se posiciona, com os controles em fluxo dentro dele. Dois posicionamentos
          absolutos aninhados era o que jogava o copiar para fora da quina. */}
      <span className={styles.codeTools} contentEditable={false}>
        <DropdownMenu
          label="Linguagem do bloco"
          triggerLabel={`Linguagem: ${languageLabel(language)}. Escolher outra`}
          size="sm"
          searchable
          sections={[
            {
              id: "languages",
              label: "Linguagem",
              items: codeLanguages.map((entry) => ({
                id: entry.value,
                label: entry.label,
                selected: entry.value === (language ?? "plaintext"),
                onSelect: () => updateAttributes({ language: entry.value }),
              })),
            },
          ]}
          triggerContent={<span className={styles.codeLanguage}>{languageLabel(language)}</span>}
        />
        <IconButton
          label={copied ? "Código copiado" : "Copiar código"}
          variant="ghost"
          size="sm"
          radius="md"
          onClick={() => void copy()}
        >
          {copied ? <CheckIcon weight="bold" /> : <CopySimpleIcon />}
        </IconButton>
      </span>
      {/* O `as` do conteúdo é tipado como `div` no pacote, mas o que ele desenha é a tag pedida; aqui
          precisa ser `code`, que é o que o realce e o CSS esperam dentro de um `pre`. */}
      <pre className={styles.codeBody}>
        <NodeViewContent as={"code" as unknown as "div"} />
      </pre>
    </NodeViewWrapper>
  );
}

export const codeBlockNodeView = () => ReactNodeViewRenderer(CodeBlockNodeView);
