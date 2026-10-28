/*
 * Quem do cargo só de tarefas vê uma página ou uma pasta (2026-10-28, a pedido: "faça essa funcionalidade ficar
 * direto na edição da pasta e página"). Os tipos que a janela de acesso lê, sem servidor.
 */

export type TaskAccessTarget = { kind: "board" | "folder"; id: string; name: string };

export type TaskAccessPerson = {
  userId: string;
  name: string;
  email: string | null;
  avatarUrl: string | null;
  /** Liberado direto aqui. */
  granted: boolean;
  /** Liberado por uma pasta de cima: já vê, e o interruptor daqui não tira. */
  inheritedFrom: string | null;
};
