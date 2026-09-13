import { QuestionIcon } from "@phosphor-icons/react/ssr";
import type { CSSProperties } from "react";
import { cornerRadius, squirclePx } from "@/lib/corners";
import { cx } from "@/lib/utils/cx";
import { projectToolBrands, projectTools } from "../labels";
import type { ProjectTool } from "../summary";
import styles from "./tool-tile.module.css";

export type ToolTileProps = {
  /** A ferramenta; nula é o azulejo da interrogação, que segura o lugar quando ninguém informou nenhuma. */
  tool: ProjectTool | null;
  size?: "sm" | "md";
  /**
   * O raio do canto, em pixels: `sm` da casa por padrão, e o concêntrico de quem o monta quando ele mora
   * dentro de outra caixa com canto (a etiqueta da janela). Vai para o CSS e para o atributo do motor de
   * fallback, senão a superelipse do fallback discordaria do desenho da folha.
   */
  radius?: number;
  className?: string;
};

// O azulejo de uma ferramenta (2026-09-13, a pedido, sobre uma referência de fila de aplicativos): o fundo na
// cor oficial da marca e a marca por cima, do jeito que o arquivo dela pede (`fit` em `labels.ts`: azulejo
// que cobre a peça, máscara na tinta da marca ou glifo centrado com folga). **Quadrado de canto squircle, e
// não círculo** (acerto do mesmo dia, a pedido): as marcas que já são azulejo, como as da Adobe, são
// quadradas, e o círculo cortava as quinas delas e apertava a letra contra a borda; no squircle a marca
// encaixa inteira, e a peça passa pelo sistema de cantos da casa, com raio concêntrico ao de quem a monta.
//
// A marca entra por CSS, como imagem de fundo, e **não** pelo `BrandIcon`: os três jeitos de encaixar são
// tamanho e posição de fundo, e ali dentro o mesmo arquivo serviria de máscara e de imagem sem uma chave
// para escolher. É a mesma peça na fila do cartão, nas etiquetas da janela e no seletor da ficha, então uma
// marca nova entra num lugar só.
export function ToolTile({ tool, size = "sm", radius = cornerRadius.sm, className }: ToolTileProps) {
  const corner = { "--tile-radius": `${radius}px` } as CSSProperties;

  if (!tool) {
    return (
      <span className={cx(styles.tile, styles.empty, className)} data-size={size} style={corner} title="Ferramentas não informadas" aria-hidden="true" {...squirclePx(radius, { clip: true })}>
        <QuestionIcon weight="bold" />
      </span>
    );
  }

  const brand = projectToolBrands[tool];
  const vars = { ...corner, "--tool-bg": brand.background, "--tool-mark": `url(/brands/${tool}.svg)`, ...(brand.ink && { "--tool-ink": brand.ink }) } as CSSProperties;

  return (
    <span className={cx(styles.tile, className)} data-size={size} style={vars} title={projectTools[tool]} aria-hidden="true" {...squirclePx(radius, { clip: true })}>
      <span className={styles.mark} data-fit={brand.fit} />
    </span>
  );
}
