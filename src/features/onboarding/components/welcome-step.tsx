"use client";

import { CheckIcon } from "@phosphor-icons/react";
import { useEffect, type CSSProperties } from "react";
import { Logo } from "@/components/layout/logo";
import { Text } from "@/components/ui/text";
import styles from "./onboarding.module.css";

type WelcomeStepProps = {
  teamName: string;
  onClose: () => void;
};

const SIZE = 88;
const STROKE = 2;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

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

  const vars = {
    "--mark-size": `${SIZE / 16}rem`,
    "--ring-length": `${CIRCUMFERENCE}px`,
    "--ring-duration": `${RING_MS}ms`,
  } as CSSProperties;

  return (
    <div className={styles.welcome} role="status" style={vars}>
      <div className={styles.welcomeGlow} aria-hidden="true" />

      <span className={styles.mark}>
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true">
          <circle
            className={styles.ringTrack}
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            strokeWidth={STROKE}
          />
          <circle
            className={styles.ringFill}
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            strokeWidth={STROKE}
            strokeLinecap="round"
            transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
          />
        </svg>

        <Logo variant="icon" height={30} className={styles.markLogo} />

        <CheckIcon weight="bold" className={styles.markCheck} aria-hidden="true" />
      </span>

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
