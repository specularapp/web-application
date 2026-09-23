"use client";

import { useEffect } from "react";
import { Logo } from "@/components/layout/logo";
import { SuccessMark } from "@/components/ui/success-mark";
import { Text } from "@/components/ui/text";
import styles from "./onboarding.module.css";

type WelcomeStepProps = {
  teamName: string;
  onClose: () => void;
};

const SIZE = 88;
const STROKE = 2;

// O anel fecha antes do tempo total, e o que sobra é o instante do check. Sem essa folga o check
// apareceria junto com o fechamento da tela e ninguém veria.
const RING_MS = 1300;
const HOLD_MS = 2000;

/**
 * Fechamento do fluxo: aparece, se despede e sai sozinha em dois segundos. O anel em volta da marca
 * completa no caminho, então ele não é enfeite: é o que conta que a tela vai fechar, sem precisar de
 * texto para isso. Mesma linguagem do anel de etapas, um arco num círculo. Quando ele fecha, a marca dá
 * lugar ao check.
 */
export function WelcomeStep({ teamName, onClose }: WelcomeStepProps) {
  useEffect(() => {
    const timer = window.setTimeout(onClose, HOLD_MS);
    return () => window.clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={styles.welcome} role="status">
      <div className={styles.welcomeGlow} aria-hidden="true" />

      <SuccessMark size={SIZE} stroke={STROKE} ringMs={RING_MS}>
        <Logo variant="icon" height={30} />
      </SuccessMark>

      <div className={styles.welcomeText}>
        <Text as="h2" variant="title2" weight="semibold" align="center">
          Tudo pronto
        </Text>
        <Text variant="subheadline" tone="secondary" align="center">
          Boas-vindas ao Specular, {teamName}
        </Text>
      </div>
    </div>
  );
}
