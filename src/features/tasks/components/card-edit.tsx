"use client";

import { createContext, useContext } from "react";
import type { Task, TaskPerson } from "../summary";

/** O que o cartão troca sem abrir a ficha: prioridade, etiquetas e quem está envolvido. */
export type CardPatch = Partial<Pick<Task, "priority" | "tags" | "people">>;

export type CardEdit = {
  /** Quem pode ser marcado como envolvido: a equipe do quadro. */
  team: TaskPerson[];
  /** Mostra a troca no cartão na hora e grava por trás; se o servidor recusar, o cartão volta. */
  edit: (task: Task, patch: CardPatch) => void;
};

/**
 * A edição direto no cartão (2026-09-23, a pedido), por contexto, e não por prop: o cartão é desenhado pela
 * coluna em dois caminhos (com e sem arraste) e pelo painel, e passar a equipe e a gravação por todos eles
 * era fio demais para uma coisa que só o quadro oferece. Sem quem ofereça, o cartão é só leitura.
 */
export const CardEditContext = createContext<CardEdit | null>(null);

export const useCardEdit = () => useContext(CardEditContext);
