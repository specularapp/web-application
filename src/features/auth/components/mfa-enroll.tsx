"use client";

import { CopySimpleIcon, PasswordIcon, QrCodeIcon } from "@phosphor-icons/react";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useToast } from "@/components/providers/toast-provider";
import { BrandIcon } from "@/components/ui/brand-icon";
import { Button } from "@/components/ui/button";
import { CodeInput } from "@/components/ui/code-input";
import { Skeleton } from "@/components/ui/skeleton";
import { Surface } from "@/components/ui/surface";
import { Text } from "@/components/ui/text";
import { enrollTotp, verifyTotp } from "../actions";
import styles from "./mfa.module.css";

type MfaEnrollProps = {
  next: string;
};

type Factor = { factorId: string; qrCode: string; secret: string };

const authenticatorApps = [
  { name: "google-authenticator", label: "Google Authenticator" },
  { name: "microsoft-authenticator", label: "Microsoft Authenticator" },
];

export function MfaEnroll({ next }: MfaEnrollProps) {
  const { toast } = useToast();
  const [factor, setFactor] = useState<Factor | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [verifying, setVerifying] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    enrollTotp("Aplicativo autenticador").then((result) => {
      if (result.ok) setFactor(result.data);
      else setError(result.error);
    });
  }, []);

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

  const verify = async () => {
    if (!factor || code.length < 6) return;
    setVerifying(true);
    setError(undefined);
    const result = await verifyTotp(factor.factorId, code);
    if (!result.ok) {
      setError(result.error);
      setVerifying(false);
      return;
    }
    window.location.assign(next);
  };

  return (
    <Surface as="section" aria-label="Autenticação de 2 fatores" className={styles.card}>
      <header className={styles.header}>
        <Text as="h1" variant="title3">
          Autenticação de 2 fatores
        </Text>
        <span className={styles.apps}>
          {authenticatorApps.map((app) => (
            <span key={app.name} className={styles.app}>
              <BrandIcon name={app.name} label={app.label} color />
            </span>
          ))}
        </span>
      </header>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>
          <QrCodeIcon aria-hidden="true" />
          <Text as="h2" variant="subheadline" weight="medium">
            Escaneie o QR Code
          </Text>
        </div>
        <Text variant="footnote" tone="secondary">
          Com seu aplicativo autenticador, escaneie o QR Code ou insira a chave manualmente.
        </Text>
      </div>

      <Surface tone="sunken" className={styles.qrRow}>
        {factor ? (
          <div
            className={styles.qr}
            role="img"
            aria-label="QR Code para cadastrar o autenticador"
            style={{ "--qr-image": `url("${factor.qrCode}")` } as CSSProperties}
          />
        ) : (
          <Skeleton shape="rect" width="10rem" height="10rem" />
        )}
        <div className={styles.manual}>
          <Text variant="footnote" tone="secondary">
            Não conseguiu? Insira a chave manualmente:
          </Text>
          {factor ? (
            <code className={styles.secret}>{factor.secret}</code>
          ) : (
            <Skeleton shape="rect" height="2.5rem" />
          )}
          <Button
            variant="secondary"
            size="sm"
            radius="md"
            iconStart={<CopySimpleIcon />}
            disabled={!factor}
            onClick={copySecret}
          >
            Copiar chave
          </Button>
        </div>
      </Surface>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>
          <PasswordIcon aria-hidden="true" />
          <Text as="h2" variant="subheadline" weight="medium">
            Verifique o código
          </Text>
        </div>
        <Text variant="footnote" tone="secondary">
          Informe o código temporário de 6 dígitos para confirmar a ativação.
        </Text>
      </div>

      <CodeInput
        label="Código de verificação de 6 dígitos"
        disabled={!factor || verifying}
        invalid={Boolean(error)}
        onChange={(value) => {
          setCode(value);
          setError(undefined);
        }}
      />

      {error && (
        <Text role="alert" variant="footnote" tone="danger">
          {error}
        </Text>
      )}

      <footer className={styles.actions}>
        <Button variant="ghost" disabled>
          Cancelar
        </Button>
        <Button disabled={!factor || code.length < 6 || verifying} onClick={verify}>
          {verifying ? "Verificando" : "Verificar"}
        </Button>
      </footer>
    </Surface>
  );
}
