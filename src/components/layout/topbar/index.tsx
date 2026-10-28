"use client";

import { usePathname } from "next/navigation";
import type { AiUsage } from "@/features/ai/summary";
import { navLocation } from "../nav";
import styles from "./topbar.module.css";

export type TopbarProps = {
  /** Sobrescreve o nome da página, quando ele não é o que o menu chama. */
  title?: string;
  /** Sem uso desde 2026-10-27: o uso da IA saiu do topo para o botão do SpeculAI no pé do menu lateral. Segue
   *  aceito para as telas que ainda o passam. */
  ai?: AiUsage;
};

// O topo das páginas (2026-10-27, a pedido: "remova esse header de todas as páginas, otimize para ganharmos
// espaço"). A barra com a rota, o nome no meio e o uso da IA saiu: o menu lateral já diz onde a pessoa está e o
// SpeculAI ganhou o botão dele no pé do menu. Fica só o `h1` com o nome da página, para o leitor de tela e para o
// título do documento, numa faixa de um pixel recortada que não ocupa espaço na tela. Ele continua sendo o
// primeiro filho das telas, que reservam a primeira linha da grade para ele, então nenhuma tela precisou mudar.
export function Topbar({ title }: TopbarProps) {
  const pathname = usePathname();
  const name = title ?? navLocation(pathname)?.page.label;

  if (!name) return null;

  return (
    <header className={styles.topbar}>
      <h1 className={styles.title}>{name}</h1>
    </header>
  );
}
