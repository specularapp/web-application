"use client";

import { EnvelopeSimpleIcon } from "@phosphor-icons/react";
import type { Route } from "next";
import Image from "next/image";
import { useActionState, useEffect, useState } from "react";
import { useToast } from "@/components/providers/toast-provider";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { TextLink } from "@/components/ui/link";
import { PasswordInput } from "@/components/ui/password-input";
import { Separator } from "@/components/ui/separator";
import { Stack } from "@/components/ui/stack";
import { Text } from "@/components/ui/text";
import { cx } from "@/lib/utils/cx";
import { resendConfirmation, sessionEstablished, signUpWithPassword, type SignUpState } from "../actions";
import styles from "./auth-form.module.css";
import { OAuthButtons } from "./oauth-buttons";
import { TURNSTILE_UNAVAILABLE, useTurnstile } from "./use-turnstile";

type SignUpFormProps = {
  next: string;
  turnstileSiteKey?: string;
};

type Step = "choose" | "email";

const initialState: SignUpState = {};

const RESEND_COOLDOWN_MS = 30000;
const MAX_SESSION_CHECKS = 60;

export function SignUpForm({ next, turnstileSiteKey }: SignUpFormProps) {
  const [state, formAction, pending] = useActionState(signUpWithPassword, initialState);
  const turnstile = useTurnstile(turnstileSiteKey, state);
  const [step, setStep] = useState<Step>("choose");
  const { toast } = useToast();
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(false);

  useEffect(() => {
    if (!state.sentTo) return;
    const goNext = () => window.location.assign(next);

    // A aba do link só avisa por canal; a consulta de sessão é a rede de segurança para
    // quando o canal não existe no navegador. Ela para sozinha para não bater no servidor a noite toda.
    let checks = 0;
    const interval = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      if (++checks > MAX_SESSION_CHECKS) {
        window.clearInterval(interval);
        return;
      }
      void sessionEstablished().then((ok) => {
        if (ok) goNext();
      });
    }, 5000);

    let channel: BroadcastChannel | undefined;
    try {
      channel = new BroadcastChannel("sp-auth");
      channel.addEventListener("message", (event) => {
        if (event.data === "confirmed") goNext();
      });
    } catch {
      channel = undefined;
    }

    return () => {
      channel?.close();
      window.clearInterval(interval);
    };
  }, [state.sentTo, next]);

  useEffect(() => {
    if (!cooldown) return;
    const timeout = window.setTimeout(() => setCooldown(false), RESEND_COOLDOWN_MS);
    return () => window.clearTimeout(timeout);
  }, [cooldown]);

  const resend = async (email: string) => {
    setResending(true);
    await resendConfirmation(email);
    toast({ title: "E-mail reenviado", description: `Confira a caixa de entrada de ${email}`, tone: "success" });
    setResending(false);
    setCooldown(true);
  };

  const sentTo = state.sentTo;
  if (sentTo) {
    return (
      <Stack gap={4} align="center" className={styles.confirmation}>
        <Image src="/3d-icons/check.png" alt="" width={174} height={178} className={styles.confirmationImage} />
        <Text as="h1" variant="title3" weight="medium" align="center">
          Confirme seu e-mail
        </Text>
        <Text variant="subheadline" tone="secondary" align="center">
          Enviamos um link de confirmação para {sentTo}. Assim que você confirmar, esta aba continua sozinha.
        </Text>
        <Button
          variant="secondary"
          size="sm"
          radius="md"
          loading={resending}
          disabled={cooldown}
          onClick={() => void resend(sentTo)}
        >
          {cooldown ? "Reenviado, aguarde um instante" : "Reenviar e-mail"}
        </Button>
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
    <div className={styles.root} data-step={step}>
      <Text as="h1" variant="title1" weight="medium" align="center" className={styles.title}>
        Crie sua conta e organize sua empresa de ponta a ponta.
      </Text>

      <div className={styles.choices}>
        <div className={styles.mobileOnly}>
          <Button
            type="button"
            variant="outline"
            fullWidth
            iconStart={<EnvelopeSimpleIcon />}
            onClick={() => setStep("email")}
          >
            Criar conta com e-mail
          </Button>
        </div>

        <OAuthButtons next={next} />
      </div>

      <div className={styles.divider} role="presentation">
        <Separator />
        <Text variant="caption1" tone="inherit" className={styles.dividerLabel}>
          Crie a conta com e-mail
        </Text>
        <Separator />
      </div>

      <form action={formAction} className={styles.form}>
        <input type="hidden" name="next" value={next} />

        <Field label="Como devemos te chamar">
          <Input type="text" name="name" placeholder="Seu nome" autoComplete="name" required />
        </Field>

        <Field label="Endereço de e-mail">
          <Input
            type="email"
            name="email"
            placeholder="seuemail@provedor.com"
            autoComplete="email"
            inputMode="email"
            required
          />
        </Field>

        <Field label="Senha" hint="No mínimo 8 caracteres">
          <PasswordInput name="password" placeholder="Crie uma senha" autoComplete="new-password" required />
        </Field>

        {turnstile.field}

        {state.error && (
          <Text role="alert" variant="footnote" tone="danger">
            {state.error}
            {state.exists && (
              <>
                {" "}
                <TextLink href={`/login?next=${encodeURIComponent(next)}` as Route} tone="inherit" underline="always">
                  Entre para continuar
                </TextLink>
              </>
            )}
          </Text>
        )}

        {turnstile.unavailable && (
          <Text role="alert" variant="footnote" tone="danger">
            {TURNSTILE_UNAVAILABLE}
          </Text>
        )}

        <Button type="submit" size="lg" fullWidth loading={pending} disabled={!turnstile.verified}>
          {pending ? "Criando conta" : "Criar conta"}
        </Button>

        <Text variant="caption1" tone="secondary" align="center">
          Ao criar a conta, você concorda com os Termos de uso e a Política de Privacidade do Specular.
        </Text>
      </form>

      <Text variant="footnote" tone="secondary" align="center" className={styles.create}>
        Já tem conta?{" "}
        <TextLink href="/login" tone="inherit" underline="always" className={styles.emphasis}>
          Entrar
        </TextLink>
      </Text>

      <Text variant="footnote" tone="secondary" align="center" className={cx(styles.mobileOnly, styles.back)}>
        Mude a forma de cadastro,{" "}
        <button type="button" className={styles.linkButton} onClick={() => setStep("choose")}>
          voltar
        </button>
      </Text>
    </div>
  );
}
