"use client";

import { useCallback, useInsertionEffect, useRef } from "react";

/**
 * Um retorno de chamada que **nunca troca de identidade** e sempre executa a versão mais nova.
 *
 * Existe por causa das listas longas (2026-09-17, do relato de que as telas com volume de dado travam): um
 * quadro com centenas de cartões passava o mesmo `() => abrir(tarefa)` escrito na hora para cada um, então
 * `memo` no cartão não segurava nada, e digitar uma letra na busca redesenhava a lista inteira. Envolver a
 * função em `useCallback` não resolve: ela depende do estado do quadro, e a identidade voltaria a mudar a
 * cada movimento.
 *
 * O `useInsertionEffect` guarda a função nova antes de qualquer efeito de layout rodar, que é o que garante
 * que um filho chamando durante a renderização não pegue a versão velha. É o padrão que o React descreve
 * como `useEffectEvent`, escrito aqui enquanto ele não é estável.
 *
 * **Não serve para tudo**: o que o retorno lê só é atual na hora da chamada, então não se usa em algo que
 * precise reagir à mudança, como dependência de `useEffect`. É para manipulador de evento, que é onde a
 * identidade estável rende.
 */
export function useEventCallback<Args extends unknown[], Result>(callback: (...args: Args) => Result) {
  const latest = useRef(callback);

  useInsertionEffect(() => {
    latest.current = callback;
  }, [callback]);

  return useCallback((...args: Args) => latest.current(...args), []);
}
