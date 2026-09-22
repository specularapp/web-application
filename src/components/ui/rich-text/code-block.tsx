"use client";

import { CheckIcon, CopySimpleIcon } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { IconButton } from "@/components/ui/icon-button";
import { Text } from "@/components/ui/text";
import type { CodeToken } from "./highlight";
import styles from "./rich-text.module.css";

/**
 * O bloco de código da leitura (2026-09-22, sobre três referências do usuário): a folha clara com o código
 * realçado, a indentação preservada, rolagem por dentro e, na quina de cima, a linguagem e o copiar, que
 * aparecem ao apontar. Em repouso o bloco é só o código, como nas referências.
 *
 * O realce **chega depois**: o código aparece na hora, sem cor, e o `lowlight` entra por importação dinâmica
 * só quando existe um bloco de código na tela. Assim uma descrição sem código não paga pelas gramáticas,
 * que é a mesma decisão do editor, carregado só no clique.
 */
export function CodeBlock({ code, language }: { code: string; language?: string | null }) {
  const [tokens, setTokens] = useState<CodeToken[]>([{ text: code }]);
  const [label, setLabel] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    let live = true;

    void import("./highlight").then(({ highlightTokens, languageLabel }) => {
      if (!live) return;
      setTokens(highlightTokens(code, language));
      setLabel(languageLabel(language));
    });

    return () => {
      live = false;
    };
  }, [code, language]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className={styles.code}>
      {/* O invólucro é quem se posiciona, e os controles ficam em fluxo dentro dele: dois posicionamentos
          absolutos aninhados era o que jogava o copiar para fora da quina. */}
      <span className={styles.codeTools}>
        {label && (
          <Text as="span" variant="caption2" tone="tertiary" className={styles.codeLanguage}>
            {label}
          </Text>
        )}
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
      <pre className={styles.codeBody}>
        <code>
          {tokens.map((token, index) => (
            <span key={index} data-token={token.kind}>
              {token.text}
            </span>
          ))}
        </code>
      </pre>
    </div>
  );
}
