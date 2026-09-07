"use client";

import { useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Text } from "@/components/ui/text";
import type { Subtask } from "../summary";
import styles from "./task-sheet.module.css";

export type SubtasksProps = { subtasks: Subtask[] };

// As subtarefas com a caixa da casa para marcar e desmarcar: a conta e a barra do cabeçalho seguem o
// que está marcado. O estado é só da janela enquanto o domínio não existe no banco; quem ligar a tabela
// troca o `useState` por uma Server Action com o mesmo `toggle`.
export function Subtasks({ subtasks }: SubtasksProps) {
  const [done, setDone] = useState(() => new Set(subtasks.filter((subtask) => subtask.done).map((subtask) => subtask.id)));

  const toggle = (id: string) =>
    setDone((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <Text as="h3" variant="callout" weight="semibold">
          Subtarefas
        </Text>
        <span className={styles.count}>
          <Text as="span" variant="footnote" tone="secondary">
            {done.size} de {subtasks.length}
          </Text>
          <Progress value={done.size} max={subtasks.length} segments={subtasks.length} size="xs" tone="success" className={styles.progress} />
        </span>
      </div>
      <ul className={styles.list}>
        {subtasks.map((subtask) => (
          <li key={subtask.id} className={styles.subtask} data-done={done.has(subtask.id) || undefined}>
            <Checkbox checked={done.has(subtask.id)} onChange={() => toggle(subtask.id)} className={styles.check}>
              {subtask.title}
            </Checkbox>
            {subtask.person && <Avatar name={subtask.person.name} src={subtask.person.avatarUrl ?? undefined} size="xs" />}
          </li>
        ))}
      </ul>
    </section>
  );
}
