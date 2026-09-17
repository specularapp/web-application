"use client";

import { Dialog } from "@/components/ui/dialog";
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
 * Por dentro é o `PlanChooser`, o mapa de planos do passo 3 dos primeiros passos, do jeito que ele é. O que
 * é do modal é só a caixa: toda ação bloqueada abre este mesmo mapa sem tirar a pessoa de onde ela estava.
 */
export function PlanDialog({ open, onClose, state, onSubscribed }: PlanDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} label="Escolher plano" size="xl" surface="glass" className={styles.panel}>
      <div className={styles.dialog}>
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
