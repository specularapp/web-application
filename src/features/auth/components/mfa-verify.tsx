"use client";

import { useState } from "react";
import { CodeInput } from "@/components/ui/code-input";
import { Text } from "@/components/ui/text";
import { signOut, verifyTotp } from "../actions";
import authStyles from "./auth-form.module.css";
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
    <section aria-label="Verificação em duas etapas" className={styles.root}>
      <Text as="h1" variant="title2" weight="medium" align="center">
        Verificação em duas etapas
      </Text>

      <Text variant="subheadline" tone="secondary" align="center">
        Informe o código de 6 dígitos do seu aplicativo autenticador para continuar.
      </Text>

      <CodeInput
        label="Código de verificação de 6 dígitos"
        fullWidth
        disabled={verifying}
        invalid={Boolean(error)}
        onChange={(value) => {
          setCode(value);
          setError(undefined);
        }}
        onComplete={(value) => void verify(value)}
      />

      {verifying && (
        <Text variant="footnote" tone="secondary" align="center">
          Verificando o código
        </Text>
      )}

      {error && !verifying && (
        <Text role="alert" variant="footnote" tone="danger" align="center">
          {error}
        </Text>
      )}

      <form action={signOut}>
        <Text variant="footnote" tone="secondary" align="center">
          Entrou na conta errada?{" "}
          <button type="submit" className={authStyles.linkButton}>
            Sair da conta
          </button>
        </Text>
      </form>
    </section>
  );
}
