"use client";

import { EnvelopeSimpleIcon } from "@phosphor-icons/react";
import { useActionState, useState, useSyncExternalStore } from "react";
import { useToast } from "@/components/providers/toast-provider";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { TextLink } from "@/components/ui/link";
import { PasswordInput } from "@/components/ui/password-input";
import { Separator } from "@/components/ui/separator";
import { Text } from "@/components/ui/text";
import { cx } from "@/lib/utils/cx";
import { resendConfirmation, signInWithPassword, type SignInState } from "../actions";
import styles from "./auth-form.module.css";
import { useAuthToast } from "./use-auth-toast";
import { OAuthButtons } from "./oauth-buttons";
import { TURNSTILE_UNAVAILABLE, useTurnstile } from "./use-turnstile";

type LoginFormProps = {
  next: string;
  notice?: string;
  turnstileSiteKey?: string;
};

type Step = "choose" | "email";

const initialState: SignInState = {};

function subscribeToHash(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

function useLocationHash() {
  return useSyncExternalStore(subscribeToHash, () => window.location.hash, () => "");
}

function hashNoticeFrom(hash: string) {
  const params = new URLSearchParams(hash.slice(1));
  if (!params.get("error")) return undefined;
  return params.get("error_code") === "otp_expired"
    ? "O link do e-mail expirou ou já foi usado. Entre com sua senha ou peça um e-mail novo no cadastro."
    : "Não foi possível concluir pelo link do e-mail. Entre com sua senha para continuar.";
}

export function LoginForm({ next, notice, turnstileSiteKey }: LoginFormProps) {
  const [state, formAction, pending] = useActionState(signInWithPassword, initialState);
  const turnstile = useTurnstile(turnstileSiteKey, state);
  const [step, setStep] = useState<Step>("choose");
  const { toast } = useToast();
  const [resending, setResending] = useState(false);
  const hashNotice = hashNoticeFrom(useLocationHash());
  const arrivalNotice = state.error ? undefined : (notice ?? hashNotice);

  useAuthToast("Não foi possível entrar", state.error, state);
  useAuthToast("Não foi possível entrar", arrivalNotice);
  useAuthToast("Verificação de segurança", turnstile.unavailable ? TURNSTILE_UNAVAILABLE : undefined);

  const resend = async (email: string) => {
    setResending(true);
    await resendConfirmation(email);
    toast({ title: "E-mail reenviado", description: `Confira a caixa de entrada de ${email}`, tone: "success" });
    setResending(false);
  };

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

        <OAuthButtons next={next} />
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

        {turnstile.field}

        {state.unconfirmed && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            radius="md"
            loading={resending}
            onClick={() => void resend(state.unconfirmed as string)}
          >
            Reenviar e-mail de confirmação
          </Button>
        )}

        <Button type="submit" size="lg" fullWidth loading={pending} disabled={!turnstile.verified}>
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
