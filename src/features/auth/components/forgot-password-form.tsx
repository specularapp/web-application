"use client";

import Image from "next/image";
import { useActionState, useState } from "react";
import { TURNSTILE_FIELD_NAME, TurnstileWidget } from "@/components/security/turnstile-widget";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { TextLink } from "@/components/ui/link";
import { Stack } from "@/components/ui/stack";
import { Text } from "@/components/ui/text";
import { requestPasswordReset, type RecoverState } from "../actions";
import styles from "./auth-form.module.css";

type ForgotPasswordFormProps = {
  turnstileSiteKey?: string;
};

const initialState: RecoverState = {};

export function ForgotPasswordForm({ turnstileSiteKey }: ForgotPasswordFormProps) {
  const [state, formAction, pending] = useActionState(requestPasswordReset, initialState);
  const [turnstileToken, setTurnstileToken] = useState("");
  const verified = !turnstileSiteKey || turnstileToken !== "";

  if (state.sentTo) {
    return (
      <Stack gap={4} align="center" className={styles.confirmation}>
        <Image src="/3d-icons/check.png" alt="" width={174} height={178} className={styles.confirmationImage} />
        <Text as="h1" variant="title3" weight="medium" align="center">
          Confira seu e-mail
        </Text>
        <Text variant="subheadline" tone="secondary" align="center">
          Se existir uma conta com {state.sentTo}, enviamos um link para redefinir a senha. Abra o mais recente.
        </Text>
        <Text variant="footnote" tone="secondary" align="center">
          Não chegou? Veja o spam ou{" "}
          <TextLink href="/login" tone="inherit" underline="always" className={styles.emphasis}>
            volte para o login
          </TextLink>
          .
        </Text>
      </Stack>
    );
  }

  return (
    <div className={styles.root}>
      <Text as="h1" variant="title1" weight="medium" align="center" className={styles.title}>
        Sem pânico, vamos recuperar seu acesso.
      </Text>

      <form action={formAction} className={styles.form}>
        <Field label="Endereço de e-mail" hint="Enviaremos um link para você redefinir a senha">
          <Input
            type="email"
            name="email"
            placeholder="seuemail@provedor.com"
            autoComplete="email"
            inputMode="email"
            required
          />
        </Field>

        {turnstileSiteKey && (
          <>
            <TurnstileWidget
              siteKey={turnstileSiteKey}
              onVerify={setTurnstileToken}
              onExpire={() => setTurnstileToken("")}
              resetOn={state}
              className={styles.turnstile}
            />
            <input type="hidden" name={TURNSTILE_FIELD_NAME} value={turnstileToken} readOnly />
          </>
        )}

        {state.error && (
          <Text role="alert" variant="footnote" tone="danger">
            {state.error}
          </Text>
        )}

        <Button type="submit" size="lg" fullWidth disabled={pending || !verified}>
          {pending ? "Enviando" : "Enviar link"}
        </Button>
      </form>

      <Text variant="footnote" tone="secondary" align="center" className={styles.create}>
        Lembrou a senha?{" "}
        <TextLink href="/login" tone="inherit" underline="always" className={styles.emphasis}>
          Entrar
        </TextLink>
      </Text>
    </div>
  );
}
