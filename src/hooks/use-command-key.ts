import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * Rótulo do modificador do atalho. Mac escreve ⌘ onde o resto escreve Ctrl, e a leitura é do cliente,
 * então o servidor responde Ctrl e a troca acontece na hidratação, sem discordância de marcação.
 */
export function useCommandKey() {
  return useSyncExternalStore(
    subscribe,
    () => (/Mac|iPhone|iPad|iPod/.test(navigator.userAgent) ? "⌘" : "Ctrl"),
    () => "Ctrl",
  );
}
