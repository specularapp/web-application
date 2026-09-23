"use client";

import { useCallback, type KeyboardEvent } from "react";

/**
 * O teclado de uma fila de escolhas, uma vez só (2026-09-22, na varredura de acessibilidade).
 *
 * Oito lugares da aplicação escreviam `role="tablist"` ou `role="radiogroup"` com os papéis filhos e o estado
 * marcado nos botões: o seletor de clientes e fornecedores, o filtro de movimentações, o de notificações, as
 * abas de dados e prévia do projeto e do orçamento, o seletor de metade da ficha, as categorias do aviso e o
 * seletor de tabela ou grade da barra de ferramentas. Nenhum deles tratava seta, e todos deixavam os botões no
 * fluxo normal do Tab.
 *
 * Isso é pior que não ter papel nenhum: o papel **promete** um comportamento a quem usa leitor de tela. A
 * pessoa ouve "guia, 1 de 4", aprende que a seta troca de guia, aperta a seta e nada acontece. A regra da casa
 * pede navegação completa por teclado, então a promessa precisa ser cumprida.
 *
 * Aqui mora só o teclado e o `tabindex` móvel. A aparência fica em cada lugar, porque as oito filas são oito
 * desenhos diferentes (segmento de pílulas, aba sublinhada, deslizante com polegar, par de ícones), e uni-las
 * num visual só mudaria oito telas que ninguém pediu para mudar.
 *
 * A troca é automática ao mover a seta, que é o padrão do ARIA para aba e para rádio cujo conteúdo já está em
 * memória: é o caso de todas as oito, onde o que muda é o recorte de uma lista que já veio.
 */

export type TabListRole = "tab" | "radio";

export type TabListOptions = {
  /** `tab` é o padrão; `radio` emite `radiogroup` e `aria-checked`, para uma escolha entre jeitos de ver. */
  as?: TabListRole;
};

const GROUP_SELECTOR = '[role="tablist"],[role="radiogroup"]';
const ITEM_SELECTOR = '[role="tab"],[role="radio"]';

export function useTabList<T extends string>(
  values: readonly T[],
  value: T,
  onChange: (next: T) => void,
  options: TabListOptions = {},
) {
  const as = options.as ?? "tab";

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      const step =
        event.key === "ArrowRight" || event.key === "ArrowDown"
          ? 1
          : event.key === "ArrowLeft" || event.key === "ArrowUp"
            ? -1
            : 0;

      const first = event.key === "Home";
      const last = event.key === "End";
      if (step === 0 && !first && !last) return;

      const current = values.indexOf(value);
      if (current < 0) return;

      /* Dá a volta na ponta, como o ARIA pede: da última a seta para a direita leva à primeira. */
      const next = first ? 0 : last ? values.length - 1 : (current + step + values.length) % values.length;
      if (next === current) return;

      event.preventDefault();
      onChange(values[next]);

      /* O foco acompanha a escolha. O grupo é achado a partir de onde o evento chegou, porque numa fila de
         abas o ouvinte mora no container e numa de rádios ele mora em cada botão: o papel de `radiogroup` num
         elemento não focável é erro de lint, e com razão, já que quem recebe o foco ali é o rádio. */
      const group = event.currentTarget.closest(GROUP_SELECTOR) ?? event.currentTarget;
      const items = group.querySelectorAll<HTMLElement>(ITEM_SELECTOR);
      items[next]?.focus();
    },
    [onChange, value, values],
  );

  /** O que vai no container da fila. Na fila de rádios, o `onKeyDown` daqui não é usado. */
  const listProps =
    as === "radio"
      ? { role: "radiogroup" as const }
      : { role: "tablist" as const, onKeyDown };

  /**
   * O que vai em cada escolha. Só a marcada fica no fluxo do Tab: é isso que faz a fila inteira contar como
   * uma parada, e não como quatro, que é a outra metade do que o papel promete.
   */
  const tabProps = (entry: T) =>
    as === "radio"
      ? { role: "radio" as const, "aria-checked": entry === value, tabIndex: entry === value ? 0 : -1, onKeyDown }
      : { role: "tab" as const, "aria-selected": entry === value, tabIndex: entry === value ? 0 : -1 };

  return { listProps, tabProps };
}
