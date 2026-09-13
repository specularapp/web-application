import { QuestionIcon } from "@phosphor-icons/react/ssr";
import type { CSSProperties } from "react";
import { cx } from "@/lib/utils/cx";
import { projectToolBrands, projectTools } from "../labels";
import type { ProjectTool } from "../summary";
import styles from "./tool-bubble.module.css";

export type ToolBubbleProps = {
  /** A ferramenta; nula é a bolinha da interrogação, que segura o lugar quando ninguém informou nenhuma. */
  tool: ProjectTool | null;
  size?: "sm" | "md";
  className?: string;
};

// A bolinha de uma ferramenta (2026-09-13, a pedido, sobre uma referência de fila de aplicativos): o fundo na
// cor oficial da marca e a marca por cima, do jeito que o arquivo dela pede (`fit` em `labels.ts`: azulejo
// que cobre a bolinha, máscara na tinta da marca ou glifo centrado com folga). Redonda, e não squircle,
// porque círculo não passa pelo sistema de cantos, pela regra da casa, e com fio em volta para a marca clara
// se separar do fundo claro.
//
// A marca entra por CSS, como imagem de fundo, e **não** pelo `BrandIcon`: os três jeitos de encaixar são
// tamanho e posição de fundo, e ali dentro o mesmo arquivo serviria de máscara e de imagem sem uma chave
// para escolher. É a mesma peça na fila do cartão, nas etiquetas da janela e no seletor da ficha, então uma
// marca nova entra num lugar só.
export function ToolBubble({ tool, size = "sm", className }: ToolBubbleProps) {
  if (!tool) {
    return (
      <span className={cx(styles.bubble, styles.empty, className)} data-size={size} title="Ferramentas não informadas" aria-hidden="true">
        <QuestionIcon weight="bold" />
      </span>
    );
  }

  const brand = projectToolBrands[tool];
  const vars = { "--tool-bg": brand.background, "--tool-mark": `url(/brands/${tool}.svg)`, ...(brand.ink && { "--tool-ink": brand.ink }) } as CSSProperties;

  return (
    <span className={cx(styles.bubble, className)} data-size={size} style={vars} title={projectTools[tool]} aria-hidden="true">
      <span className={styles.mark} data-fit={brand.fit} />
    </span>
  );
}
