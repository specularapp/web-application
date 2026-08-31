"use client";

import { PasswordIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CodeInput } from "@/components/ui/code-input";
import { Surface } from "@/components/ui/surface";
import { Text } from "@/components/ui/text";
import { signOut, verifyTotp } from "../actions";
import styles from "./mfa.module.css";

type MfaVerifyProps = {
  next: string;
  factorId: string;
};

export function MfaVerify({ next, factorId }: MfaVerifyProps) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [verifying, setVerifying] = useState(false);

  const verify = async (value = code) => {
    if (value.length < 6 || verifying) return;
    setVerifying(true);
    setError(undefined);
    const result = await verifyTotp(factorId, value);
    if (!result.ok) {
      setError(result.error);
      setVerifying(false);
      return;
    }
    window.location.assign(next);
  };

  return (
    <Surface as="section" aria-label="Verificação em duas etapas" className={styles.card}>
      <header className={styles.header}>
        <Text as="h1" variant="title3">
          Verificação em duas etapas
        </Text>
      </header>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>
          <PasswordIcon aria-hidden="true" />
          <Text as="h2" variant="subheadline" weight="medium">
            Verifique o código
          </Text>
        </div>
        <Text variant="footnote" tone="secondary">
          Informe o código de 6 dígitos do seu aplicativo autenticador para continuar.
        </Text>
      </div>

      <CodeInput
        label="Código de verificação de 6 dígitos"
        disabled={verifying}
        invalid={Boolean(error)}
        onChange={(value) => {
          setCode(value);
          setError(undefined);
        }}
        onComplete={(value) => void verify(value)}
      />

      {error && (
        <Text role="alert" variant="footnote" tone="danger">
          {error}
        </Text>
      )}

      <footer className={styles.actions}>
        <form action={signOut}>
          <Button type="submit" variant="ghost">
            Sair da conta
          </Button>
        </form>
        <Button disabled={code.length < 6 || verifying} onClick={() => void verify()}>
          {verifying ? "Verificando" : "Verificar"}
        </Button>
      </footer>
    </Surface>
  );
}
