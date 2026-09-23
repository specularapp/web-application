"use client";

import { XIcon } from "@phosphor-icons/react";
import { Dialog } from "@/components/ui/dialog";
import { IconButton } from "@/components/ui/icon-button";
import { Spinner } from "@/components/ui/spinner";
import { PlanChooser } from "./plan-chooser";
import type { BillingState } from "../service";
import styles from "./plan-dialog.module.css";

export type PlanDialogProps = {
  open: boolean;
  onClose: () => void;
  /** O estado de cobrança do time; nulo enquanto ele está sendo buscado. */
  state: BillingState | null;
  /** O plano entrou: fecha e manda a tela reler o que o bloqueio escondia. */
  onSubscribed?: () => void;
};

/**
 * O modal central de plano: **um só** para toda a aplicação.
 *
 * Por dentro é o `PlanChooser`, o mapa de planos do passo 3 dos primeiros passos, do jeito que ele é. Ele já
 * desenha o próprio título e subtítulo, então a janela não repete um segundo por cima: o que é dela aqui é
 * só a caixa e o fechar, flutuando sobre o conteúdo.
 */
export function PlanDialog({ open, onClose, state, onSubscribed }: PlanDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} label="Escolher plano" size="xl" surface="glass" className={styles.panel}>
      <div className={styles.dialog}>
        <IconButton label="Fechar" variant="ghost" size="sm" onClick={onClose} className={styles.close}>
          <XIcon />
        </IconButton>
        {state ? (
          <PlanChooser organizationId={state.organizationId} billing={state} onDone={onSubscribed ?? onClose} />
        ) : (
          <div className={styles.loading}>
            <Spinner label="Carregando os planos" />
          </div>
        )}
      </div>
    </Dialog>
  );
}
