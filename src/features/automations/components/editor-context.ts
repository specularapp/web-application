"use client";

import { createContext, useContext } from "react";
import type { NodeConfig } from "../summary";

export type Branch = "yes" | "no" | null;

export type EditorActions = {
  /** Abre o "O que acontece depois?" para ligar um passo novo à saída de um nó. */
  pickNext: (from: string, branch: Branch) => void;
  /** O nome que a pessoa deu ao passo, editado no próprio card. */
  rename: (id: string, title: string) => void;
  /** Um campo preenchido no próprio card. */
  configure: (id: string, patch: NodeConfig) => void;
};

/* As ações que os nós do quadro precisam sem receber por prop: o React Flow desenha os nós por conta, então
   o contexto é o canal entre o editor e cada nó. */
export const EditorActionsContext = createContext<EditorActions>({ pickNext: () => undefined, rename: () => undefined, configure: () => undefined });

export const useEditorActions = () => useContext(EditorActionsContext);
