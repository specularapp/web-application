"use client";

import { useEffect, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { SuccessMark } from "@/components/ui/success-mark";
import { Text } from "@/components/ui/text";
import styles from "./task-created.module.css";

/** Quanto o anel leva para fechar, e quanto o aviso fica antes de sair sozinho. */
const RING_MS = 900;
const HOLD_MS = 1900;

const subscribeToMount = () => () => undefined;

/**
 * O retorno de tarefa criada (2026-09-23, a pedido, no desenho do fim dos primeiros passos): o cartão central
 * com o brilho de fundo, o anel se fechando no check, o feito e o código
 * que ela ganhou. Aparece quando a ficha da tarefa nova fecha, para não atrapalhar quem está preenchendo, e
 * sai sozinho, sem prender o toque de ninguém por baixo.
 *
 * Camada própria, e não a janela da casa: no celular a janela vira bandeja de baixo, com alça e arrasto, e o
 * aviso precisa ficar no meio da tela nos dois tamanhos, sem ser nada que se arraste.
 */
export function TaskCreated({ reference, onDone }: { reference: string; onDone: () => void }) {
  const mounted = useSyncExternalStore(subscribeToMount, () => true, () => false);

  useEffect(() => {
    const timer = window.setTimeout(onDone, HOLD_MS);
    return () => window.clearTimeout(timer);
  }, [onDone]);

  if (!mounted) return null;

  return createPortal(
    <div className={styles.layer}>
      <div className={styles.card} role="status" aria-live="polite">
        <div className={styles.glow} aria-hidden="true" />
        {/* Só o anel se fechando no check: com o glifo da lista dentro, ele aparecia e dava lugar ao check, e
            no celular a troca lia como um ícone errado piscando. */}
        <SuccessMark size={72} stroke={2} ringMs={RING_MS} />
        <div className={styles.copy}>
          <Text as="h2" variant="title3" weight="semibold" align="center">
            Tarefa criada
          </Text>
          <Text variant="subheadline" tone="secondary" align="center" className={styles.reference}>
            {reference}
          </Text>
        </div>
      </div>
    </div>,
    document.body,
  );
}
