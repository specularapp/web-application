"use client";

import { WarningCircleIcon } from "@phosphor-icons/react";
import { Tooltip } from "@/components/ui/tooltip";
import styles from "./auth-form.module.css";

// Mensagem de erro cabe numa linha e o texto inteiro fica na bolha: sem isso um aviso longo
// empurra o formulário inteiro para baixo.
export function AuthNotice({ message }: { message: string }) {
  return (
    <div className={styles.notice} role="alert">
      <Tooltip content={message} side="top" align="center">
        <button type="button" className={styles.noticeTrigger} aria-label="Ver o aviso completo">
          <WarningCircleIcon weight="fill" aria-hidden="true" />
          <span className={styles.noticeText}>{message}</span>
        </button>
      </Tooltip>
    </div>
  );
}
