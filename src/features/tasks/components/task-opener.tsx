"use client";

import dynamic from "next/dynamic";
import { useState, type HTMLAttributes, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import { useOpenedOnce } from "@/hooks/use-opened-once";
import type { Task } from "../summary";
import styles from "./task-opener.module.css";

/* A janela da tarefa entra por importação dinâmica, e cada linha só a monta depois de abrir a primeira vez
   (varredura de peso de 2026-09-21): ela tem mais de mil e seiscentas linhas, e uma lista de vinte tarefas
   carregava e instanciava todas as vinte sem ninguém ter clicado em nenhuma. */
const TaskDialog = dynamic(() => import("./task-dialog").then((module) => module.TaskDialog));

export type TaskOpenerProps = Omit<HTMLAttributes<HTMLElement>, "onClick" | "onKeyDown" | "role" | "tabIndex"> & {
  task: Task;
  /** Nome do gatilho para leitor de tela, como "Ver detalhes de Design system v2". */
  label: string;
  children: ReactNode;
};

/** Controles de dentro da linha que têm a própria ação e não abrem a janela, a menos que se declarem. */
const INTERACTIVE = "button, a, input, select, textarea, [role='button'], [role='menuitem']";

/**
 * Uma linha que abre a janela da tarefa, na receita do `DetailsTrigger` da casa: o `li` continua sendo o que
 * era, com as mesmas classes, e só ganha papel de botão, foco por teclado e o clique. Clique que nasce num
 * controle de dentro não abre a janela, a menos que ele traga `data-open-details`, que é o caso da seta do
 * cartão de tarefa do painel.
 *
 * Existe porque a janela da tarefa (2026-09-10) passou a ser a `Dialog` `xl` com duas colunas por dentro, e
 * o `DetailsTrigger` embrulha o conteúdo na `DetailsDialog`, que é uma janela pequena de vidro com rolagem
 * própria: as duas colunas não teriam onde rolar lá dentro. Quem mostra muitos cartões de uma vez, como o
 * quadro, não usa isto e guarda **uma** janela para a tela inteira, senão seriam vinte e quatro montadas.
 */
export function TaskOpener({ task, label, children, ...props }: TaskOpenerProps) {
  const [open, setOpen] = useState(false);
  const ready = useOpenedOnce(open);

  const onClick = (event: MouseEvent<HTMLElement>) => {
    // Conteúdo portado (o menu de opções, a bandeja dele no celular) continua descendente na árvore do
    // React, mas não no DOM: sem este guarda o clique que nasce em document.body sobe até aqui e abre a
    // ficha da tarefa por cima do que acabou de fechar. Mesmo guarda do `DetailsTrigger`.
    if (!event.currentTarget.contains(event.target as Node)) return;
    const control = (event.target as HTMLElement).closest(INTERACTIVE);
    if (control && control !== event.currentTarget && !control.hasAttribute("data-open-details")) return;
    setOpen(true);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setOpen(true);
    }
  };

  /* O papel de botão vai no invólucro de dentro, e não no `li`: papel interativo em elemento de lista é
     coisa que o lint barra, e é a mesma estrutura dos cartões de cliente e de orçamento. Quem recebe as
     classes e o canto de quem chama é ele, então o `li` fica transparente e o vão da lista continua sendo do
     `ul`. */
  return (
    <li className={styles.item}>
      <div role="button" tabIndex={0} aria-haspopup="dialog" aria-label={label} onClick={onClick} onKeyDown={onKeyDown} {...props}>
        {children}
      </div>
      {ready && <TaskDialog task={task} open={open} onClose={() => setOpen(false)} />}
    </li>
  );
}
