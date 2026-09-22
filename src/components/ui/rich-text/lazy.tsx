"use client";

import dynamic from "next/dynamic";
import { Spinner } from "@/components/ui/spinner";
import styles from "./rich-text.module.css";

/**
 * O editor carregado sob demanda (2026-09-22). Ele traz o Tiptap junto, e quem só abre uma ficha para ler,
 * ou uma janela de criar para preencher três campos, não deve pagar por isso: o pacote só chega quando o
 * editor entra na tela. Sem SSR, porque ele nasce de um clique e o servidor desenha o texto pelo
 * `RichTextView`, que é estático.
 *
 * Num arquivo próprio para o `dynamic` ser um só: chamado em cada tela, cada chamada viraria um pedaço
 * separado no pacote, com a mesma biblioteca dentro.
 */
export const LazyRichTextEditor = dynamic(() => import("./editor").then((mod) => mod.RichTextEditor), {
  ssr: false,
  loading: () => (
    <div className={styles.editor} aria-busy="true">
      <div className={styles.surface}>
        <Spinner size="sm" />
      </div>
    </div>
  ),
});
