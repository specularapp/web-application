"use client";

import Image from "next/image";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { TextLink } from "@/components/ui/link";
import { PasswordInput } from "@/components/ui/password-input";
import { Stack } from "@/components/ui/stack";
import { Text } from "@/components/ui/text";
import { updatePassword, type UpdatePasswordState } from "../actions";
import { AuthNotice } from "./auth-notice";
import styles from "./auth-form.module.css";

type ResetPasswordFormProps = {
  email?: string;
};

const initialState: UpdatePasswordState = {};

export function ResetPasswordForm({ email }: ResetPasswordFormProps) {
  const [state, formAction, pending] = useActionState(updatePassword, initialState);

  if (!email) {
    return (
      <Stack gap={4} align="center" className={styles.confirmation}>
        <Image src="/3d-icons/error.png" alt="" width={61} height={178} className={styles.confirmationImage} />
        <Text as="h1" variant="title3" weight="medium" align="center">
          O link não está mais ativo
        </Text>
        <Text variant="subheadline" tone="secondary" align="center">
          Peça um link novo para redefinir a senha e abra o e-mail mais recente.
        </Text>
        <Text variant="footnote" tone="secondary" align="center">
          <TextLink href="/recuperar-senha" tone="inherit" underline="always" className={styles.emphasis}>
            Pedir um link novo
          </TextLink>
        </Text>
      </Stack>
    );
  }

  return (
    <div className={styles.root}>
      <Text as="h1" variant="title1" weight="medium" align="center" className={styles.title}>
        Crie uma senha nova para sua conta.
      </Text>

      <form action={formAction} className={styles.form}>
        <Field label="Nova senha" hint={`No mínimo 8 caracteres, para a conta ${email}`}>
          <PasswordInput name="password" placeholder="Crie uma senha nova" autoComplete="new-password" required />
        </Field>

        {state.error && (
          <AuthNotice message={state.error} />
        )}

        <Button type="submit" size="lg" fullWidth loading={pending}>
          {pending ? "Salvando" : "Salvar nova senha"}
        </Button>
      </form>

      <Text variant="footnote" tone="secondary" align="center" className={styles.create}>
        O link não funcionou?{" "}
        <TextLink href="/recuperar-senha" tone="inherit" underline="always" className={styles.emphasis}>
          Pedir outro
        </TextLink>
      </Text>
    </div>
  );
}
