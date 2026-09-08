"use client";

import { useEffect, useState } from "react";

/**
 * Pilha das camadas flutuantes abertas, na ordem em que abriram. Janela, gaveta, bandeja e caixa colada
 * no gatilho entram na mesma fila, porque uma abre de dentro da outra: o menu de opções do cliente nasce
 * dentro da janela do perfil. Sem essa fila cada camada só enxerga a si mesma, e o Escape ou o toque fora
 * que fecha a de cima fecha a de baixo junto.
 */
const layers: symbol[] = [];

/** Registra a camada enquanto ela está aberta e devolve a identidade dela, estável entre renders. */
export function useLayer(active: boolean) {
  // Estado com inicializador preguiçoso, e não `useRef`: o símbolo nasce uma vez por camada e é lido no
  // render sem tocar em `current`, que o lint barra por não valer para renderizar.
  const [id] = useState(() => Symbol("layer"));

  useEffect(() => {
    if (!active) return;
    layers.push(id);
    return () => {
      const index = layers.lastIndexOf(id);
      if (index !== -1) layers.splice(index, 1);
    };
  }, [active, id]);

  return id;
}

/** Verdadeiro quando nenhuma outra camada abriu depois desta, ou seja, quando esta é quem responde. */
export function isTopLayer(id: symbol) {
  return layers.length === 0 || layers[layers.length - 1] === id;
}
