"use client";

import { EnvelopeSimpleIcon } from "@phosphor-icons/react";
import { useActionState, useState } from "react";
import { TurnstileWidget } from "@/components/security/turnstile-widget";
import { BrandIcon } from "@/components/ui/brand-icon";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { TextLink } from "@/components/ui/link";
import { PasswordInput } from "@/components/ui/password-input";
import { Separator } from "@/components/ui/separator";
import { Text } from "@/components/ui/text";
import { cx } from "@/lib/utils/cx";
import { signInWithOAuth, signInWithPassword, type SignInState } from "../actions";
import type { OAuthProvider } from "../schemas";
import styles from "./login-form.module.css";

type LoginFormProps = {
  next: string;
  notice?: string;
  turnstileSiteKey?: string;
};

type Step = "choose" | "email";

const providers: { id: OAuthProvider; label: string; color?: boolean }[] = [
  { id: "google", label: "Google", color: true },
  { id: "github", label: "GitHub" },
];

const initialState: SignInState = {};

export function LoginForm({ next, notice, turnstileSiteKey }: LoginFormProps) {
  const [state, formAction, pending] = useActionState(signInWithPassword, initialState);
  const [verified, setVerified] = useState(!turnstileSiteKey);
  const [step, setStep] = useState<Step>("choose");
  const message = state.error ?? notice;

  return (
    <div className={styles.root} data-step={step}>
      <Text as="h1" variant="title1" weight="medium" align="center" className={styles.title}>
        É ótimo ter você com a gente, faça seu login e vamos trabalhar.
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
            Entrar com e-mail e senha
          </Button>
        </div>

        <div className={styles.providers}>
          {providers.map(({ id, label, color }) => (
            <form key={id} action={signInWithOAuth.bind(null, id, next)}>
              <Button
                type="submit"
                variant="outline"
                fullWidth
                iconStart={<BrandIcon name={id} color={color} />}
              >
                <span className={styles.mobileOnly}>Continuar com </span>
                {label}
              </Button>
            </form>
          ))}
        </div>
      </div>

      <div className={styles.divider} role="presentation">
        <Separator />
        <Text variant="caption1" tone="inherit" className={styles.dividerLabel}>
          Faça login com e-mail
        </Text>
        <Separator />
      </div>

      <form action={formAction} className={styles.form}>
        <input type="hidden" name="next" value={next} />

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

        <Field label="Senha">
          <PasswordInput name="password" placeholder="Digite sua senha" required />
        </Field>

        <div className={styles.row}>
          <Checkbox name="remember" defaultChecked>
            Relembrar senha
          </Checkbox>
          <Text variant="footnote" tone="secondary">
            <TextLink href="/recuperar-senha" tone="inherit" underline="always">
              Esqueci minha senha
            </TextLink>
          </Text>
        </div>

        {turnstileSiteKey && (
          <TurnstileWidget
            siteKey={turnstileSiteKey}
            onVerify={() => setVerified(true)}
            onExpire={() => setVerified(false)}
            className={styles.turnstile}
          />
        )}

        {message && (
          <Text role="alert" variant="footnote" tone="danger">
            {message}
          </Text>
        )}

        <Button type="submit" size="lg" fullWidth disabled={pending || !verified}>
          {pending ? "Entrando" : "Entrar"}
        </Button>
      </form>

      <Text variant="footnote" tone="secondary" align="center" className={styles.create}>
        Não tem conta?{" "}
        <TextLink href="/cadastro" tone="inherit" underline="always" className={styles.emphasis}>
          Criar agora
        </TextLink>
      </Text>

      <Text variant="footnote" tone="secondary" align="center" className={cx(styles.mobileOnly, styles.back)}>
        Mude a forma de login,{" "}
        <button type="button" className={styles.linkButton} onClick={() => setStep("choose")}>
          voltar
        </button>
      </Text>
    </div>
  );
}
