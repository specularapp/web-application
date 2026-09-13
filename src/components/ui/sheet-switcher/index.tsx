"use client";

import type { CSSProperties } from "react";
import { iconButtonCornerRadius, squircle, squirclePx } from "@/lib/corners";
import styles from "./sheet-switcher.module.css";

export type SheetSwitcherOption<T extends string> = { id: T; label: string };

export type SheetSwitcherProps<T extends string> = {
  /** Nome do grupo para leitor de tela, como "O que ver da tarefa". */
  label: string;
  options: readonly SheetSwitcherOption<T>[];
  value: T;
  onChange: (value: T) => void;
};

/**
 * O canto de dentro do seletor: o raio da caixa menos o recuo que os separa (`lg` 20 menos `--space-half` 2),
 * que é a regra concêntrica da casa. O resultado cai no raio do botão de ícone pequeno, e não por acaso: a
 * altura aqui é a do controle pequeno, 36, e este raio é metade dela, então o deslizante fica com a geometria
 * de metade do lado que o `IconButton` já tem. O número sai daqui para o atributo do motor e o CSS declara o
 * mesmo token, senão a superelipse do fallback discordaria do desenho da folha.
 */
const CORNER = iconButtonCornerRadius.sm;

// O seletor entre as metades de uma janela de duas colunas no celular (nascido na ficha da tarefa em
// 2026-09-11, sobre um print do usuário, e promovido a peça da casa em 2026-09-13 quando a janela do projeto
// precisou do mesmo): uma peça solta **acima** da bandeja, na área escura, pela prop `above` da `Dialog`, e
// não dentro dela, porque a bandeja recorta o que passa das bordas e é navegação da janela inteira, não
// conteúdo dela. O deslizante corre por trás das opções e é ele que dá a suavidade: uma faixa que anda em
// `translate`, que o compositor resolve sem tocar em layout, em vez de dois fundos acendendo e apagando.
// Quantas opções houver, todas com a mesma largura, a do maior texto.
export function SheetSwitcher<T extends string>({ label, options, value, onChange }: SheetSwitcherProps<T>) {
  const at = Math.max(0, options.findIndex((option) => option.id === value));
  const vars = { "--count": options.length, "--at": at } as CSSProperties;

  return (
    <div className={styles.switcher} role="tablist" aria-label={label} style={vars} {...squircle("lg")}>
      <span className={styles.thumb} aria-hidden="true" {...squirclePx(CORNER)} />
      {options.map((option, index) => (
        <button
          key={option.id}
          type="button"
          role="tab"
          aria-selected={option.id === value}
          className={styles.option}
          data-on={option.id === value || undefined}
          style={{ gridColumn: index + 1 }}
          onClick={() => onChange(option.id)}
          {...squirclePx(CORNER)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
