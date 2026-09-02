"use client";

import { CopySimpleIcon } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { useToast } from "@/components/providers/toast-provider";
import { BrandIcon } from "@/components/ui/brand-icon";
import { Button } from "@/components/ui/button";
import { CodeInput } from "@/components/ui/code-input";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { squircle } from "@/lib/corners";
import { cx } from "@/lib/utils/cx";
import { enrollTotp, signOut, skipMfaEnrollment, verifyTotp } from "../actions";
import authStyles from "./auth-form.module.css";
import styles from "./mfa.module.css";

type MfaEnrollProps = {
  next: string;
  preview?: { qrCode: string; secret: string };
};

type Factor = { factorId: string; qrCode: string; secret: string };

type AuthenticatorApp = { name: string; label: string; filled?: boolean };

const authenticatorApps: AuthenticatorApp[] = [
  { name: "google-authenticator", label: "Google Authenticator" },
  { name: "twilio", label: "Twilio Authy" },
  { name: "microsoft-authenticator", label: "Microsoft Authenticator", filled: true },
];

export function MfaEnroll({ next, preview }: MfaEnrollProps) {
  const { toast } = useToast();
  const [factor, setFactor] = useState<Factor | null>(
    preview ? { factorId: "", qrCode: preview.qrCode, secret: preview.secret } : null,
  );
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [verifying, setVerifying] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [enrollFailed, setEnrollFailed] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current || preview) return;
    started.current = true;
    enrollTotp("Aplicativo autenticador").then((result) => {
      if (result.ok) {
        setFactor(result.data);
        return;
      }
      setError(result.error);
      setEnrollFailed(true);
    });
  }, [preview]);

  const retryEnroll = () => {
    setError(undefined);
    setEnrollFailed(false);
    enrollTotp("Aplicativo autenticador").then((result) => {
      if (result.ok) {
        setFactor(result.data);
        return;
      }
      setError(result.error);
      setEnrollFailed(true);
    });
  };

  const copySecret = async () => {
    if (!factor) return;
    try {
      await navigator.clipboard.writeText(factor.secret);
      toast({
        title: "Chave copiada",
        description: "Cole no seu aplicativo autenticador para cadastrar a conta",
        tone: "success",
      });
    } catch {
      toast({
        title: "Não foi possível copiar",
        description: "Selecione a chave e copie manualmente",
        tone: "danger",
      });
    }
  };

  const verify = async (value = code) => {
    if (!factor || value.length < 6 || verifying) return;
    setVerifying(true);
    setError(undefined);
    const result = await verifyTotp(factor.factorId, value);
    if (!result.ok) {
      setError(result.error);
      setVerifying(false);
      setAttempt((current) => current + 1);
      return;
    }
    window.location.assign(next);
  };

  return (
    <section aria-label="Autenticação de 2 fatores" className={styles.root}>
      <span className={styles.apps}>
        {authenticatorApps.map((app) => (
          <span key={app.name} className={cx(styles.app, app.filled && styles.appFilled)}>
            <BrandIcon name={app.name} label={app.label} color />
          </span>
        ))}
      </span>

      <Text as="h1" variant="title2" weight="medium" align="center">
        Autenticação de 2 fatores
      </Text>

      <Text variant="subheadline" tone="secondary" align="center">
        Escaneie o QR Code com seu aplicativo autenticador ou insira a chave manualmente.
      </Text>

      {factor ? (
        <div className={styles.qrBox}>
          {/* eslint-disable-next-line @next/next/no-img-element -- o QR do Supabase é um data URL de SVG, que o next/image não aceita */}
          <img src={factor.qrCode} alt="QR Code para cadastrar o autenticador" />
        </div>
      ) : (
        <Skeleton shape="rect" width="11rem" height="11rem" />
      )}

      <div className={styles.secretBox} {...squircle("md")}>
        {factor ? (
          <code className={styles.secret}>{factor.secret}</code>
        ) : (
          <Skeleton shape="rect" width="100%" height="2.25rem" />
        )}
        <Button
          className={styles.copy}
          variant="secondary"
          size="sm"
          radius="md"
          iconStart={<CopySimpleIcon />}
          disabled={!factor}
          onClick={copySecret}
        >
          Copiar
        </Button>
      </div>

      <Text variant="footnote" tone="secondary" align="center" className={styles.hint}>
        Depois, informe o código temporário de 6 dígitos gerado no aplicativo. A verificação é automática.
      </Text>

      <CodeInput
        label="Código de verificação de 6 dígitos"
        fullWidth
        disabled={!factor || verifying}
        invalid={Boolean(error) && !enrollFailed}
        resetKey={attempt}
        onChange={(value) => {
          setCode(value);
          setError(undefined);
        }}
        onComplete={(value) => void verify(value)}
      />

      {verifying && (
        <div className={styles.verifying}>
          <Spinner size="sm" label="" />
          <Text variant="footnote" tone="secondary">
            Verificando o código
          </Text>
        </div>
      )}

      {error && !verifying && (
        <Text role="alert" variant="footnote" tone="danger" align="center">
          {error}
        </Text>
      )}

      {enrollFailed && (
        <Button variant="secondary" size="sm" radius="md" onClick={retryEnroll}>
          Tentar de novo
        </Button>
      )}

      <form action={skipMfaEnrollment} className={styles.skip}>
        <input type="hidden" name="next" value={next} />
        <Button type="submit" variant="secondary" size="md" fullWidth>
          Pular por agora
        </Button>
        <Text variant="caption2" tone="tertiary" align="center">
          Você pode ativar a verificação em duas etapas quando quiser, e vamos lembrar em 30 dias.
        </Text>
      </form>

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
