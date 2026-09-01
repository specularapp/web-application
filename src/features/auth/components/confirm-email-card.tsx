"use client";

import type { Route } from "next";
import Image from "next/image";
import { useActionState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { TextLink } from "@/components/ui/link";
import { Stack } from "@/components/ui/stack";
import { Text } from "@/components/ui/text";
import { confirmEmailWithToken, type ConfirmEmailState } from "../actions";
import type { OtpType } from "../schemas";
import { AuthNotice } from "./auth-notice";
import styles from "./auth-form.module.css";

type ConfirmEmailCardProps = {
  tokenHash?: string;
  type: OtpType;
  next: string;
};

const copy: Record<OtpType, { title: string; description: string; cta: string }> = {
  signup: {
    title: "Falta um clique",
    description: "Confirme que este e-mail é seu para ativar a conta e entrar no Specular.",
    cta: "Confirmar e-mail",
  },
  email: {
    title: "Falta um clique",
    description: "Confirme que este e-mail é seu para ativar a conta e entrar no Specular.",
    cta: "Confirmar e-mail",
  },
  magiclink: {
    title: "Entre no Specular",
    description: "Confirme para entrar na sua conta com este e-mail.",
    cta: "Entrar",
  },
  invite: {
    title: "Você foi convidado",
    description: "Confirme para aceitar o convite e criar seu acesso.",
    cta: "Aceitar convite",
  },
  recovery: {
    title: "Redefina sua senha",
    description: "Confirme para escolher uma senha nova para a sua conta.",
    cta: "Continuar",
  },
  email_change: {
    title: "Confirme o novo e-mail",
    description: "Confirme para concluir a troca do endereço de e-mail da conta.",
    cta: "Confirmar troca",
  },
};

const initialState: ConfirmEmailState = {};

export function ConfirmEmailCard({ tokenHash, type, next }: ConfirmEmailCardProps) {
  const [state, formAction, pending] = useActionState(confirmEmailWithToken, initialState);

  useEffect(() => {
    if (!state.done) return;
    const channel = new BroadcastChannel("sp-auth");
    channel.postMessage("confirmed");
    channel.close();
  }, [state.done]);

  if (state.done) {
    return (
      <Stack gap={4} align="center" className={styles.confirmation}>
        <Image src="/3d-icons/check.png" alt="" width={174} height={178} className={styles.confirmationImage} />
        <Text as="h1" variant="title3" weight="medium" align="center">
          E-mail confirmado
        </Text>
        <Text variant="subheadline" tone="secondary" align="center">
          Volte para a aba onde você criou a conta, ela continua sozinha. Esta aba pode ser fechada.
        </Text>
        <Text variant="footnote" tone="secondary" align="center">
          Abriu o link em outro aparelho?{" "}
          <TextLink href={next as Route} tone="inherit" underline="always" className={styles.emphasis}>
            Continuar por aqui
          </TextLink>
        </Text>
      </Stack>
    );
  }

  if (!tokenHash) {
    return (
      <Stack gap={4} align="center" className={styles.confirmation}>
        <Image src="/3d-icons/error.png" alt="" width={61} height={178} className={styles.confirmationImage} />
        <Text as="h1" variant="title3" weight="medium" align="center">
          Este link não está completo
        </Text>
        <Text variant="subheadline" tone="secondary" align="center">
          Abra de novo pelo botão do e-mail ou copie o endereço inteiro. Se preferir, peça um e-mail novo.
        </Text>
        <Text variant="footnote" tone="secondary" align="center">
          <TextLink href="/login" tone="inherit" underline="always" className={styles.emphasis}>
            Voltar para o login
          </TextLink>
        </Text>
      </Stack>
    );
  }

  const { title, description, cta } = copy[type];

  return (
    <Stack gap={4} align="center" className={styles.confirmation}>
      <Image src="/3d-icons/check.png" alt="" width={174} height={178} className={styles.confirmationImage} />
      <Text as="h1" variant="title3" weight="medium" align="center">
        {title}
      </Text>
      <Text variant="subheadline" tone="secondary" align="center">
        {description}
      </Text>
      <form action={formAction} className={styles.confirmAction}>
        <input type="hidden" name="token_hash" value={tokenHash} />
        <input type="hidden" name="type" value={type} />
        <input type="hidden" name="next" value={next} />
        {state.error && (
          <AuthNotice message={state.error} />
        )}
        <Button type="submit" size="lg" fullWidth loading={pending}>
          {pending ? "Confirmando" : cta}
        </Button>
      </form>
      <Text variant="footnote" tone="secondary" align="center">
        Chegou aqui sem querer?{" "}
        <TextLink href="/login" tone="inherit" underline="always" className={styles.emphasis}>
          Ir para o login
        </TextLink>
      </Text>
    </Stack>
  );
}
