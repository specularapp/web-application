"use client";

import { callAction } from "@/lib/action";

import { DeviceMobileIcon, KeyIcon, ShieldCheckIcon, TrashIcon } from "@phosphor-icons/react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useToast } from "@/components/providers/toast-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import { Text } from "@/components/ui/text";
import { changePasswordAction, removeAuthenticatorAction } from "../actions";
import type { Authenticator, SecuritySettings as SecurityData } from "../queries";
import type { AiUsage } from "@/features/ai/summary";
import { SettingsPage, SettingsSection } from "./settings-page";
import styles from "./settings.module.css";

const providerLabels: Record<string, string> = { google: "Google", github: "GitHub", apple: "Apple" };

const MFA_RETURN = "/mfa?next=/configuracoes/seguranca" as Route;

/**
 * A segurança da conta (2026-09-17): como a pessoa entra, a troca de senha (só para quem entra por senha) e
 * o autenticador de duas etapas. Cadastrar um autenticador leva ao fluxo que já existe em `/mfa`, com volta
 * para cá; remover pede confirmação, porque a conta fica menos protegida.
 */
export function SecuritySettings({ email, hasPassword, providers, authenticators, ai }: SecurityData & { ai: AiUsage }) {
  const router = useRouter();
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<Authenticator | null>(null);
  const [busy, setBusy] = useState(false);

  const mismatch = confirm.length > 0 && confirm !== password;
  const canSave = password.length >= 8 && password === confirm && !saving;
  const verified = authenticators.filter((factor) => factor.verified);

  const changePassword = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSave) return;
    setSaving(true);
    setError(null);
    const result = await callAction(changePasswordAction({ password }));
    setSaving(false);
    if (!result.ok) {
      if ("mfa" in result) {
        toast({ title: "Confirme o autenticador", description: result.error, tone: "info" });
        router.push(MFA_RETURN);
        return;
      }
      setError(result.error);
      return;
    }
    setPassword("");
    setConfirm("");
    toast({ title: "Senha trocada", description: "Use a nova na próxima entrada.", tone: "success" });
  };

  const remove = async () => {
    if (!removing) return;
    setBusy(true);
    const result = await callAction(removeAuthenticatorAction(removing.id));
    setBusy(false);
    setRemoving(null);
    if (!result.ok) {
      toast({ title: "Não deu para remover", description: result.error, tone: "danger" });
      return;
    }
    toast({ title: "Autenticador removido", description: "A entrada volta a pedir só a senha.", tone: "success" });
    router.refresh();
  };

  return (
    <SettingsPage ai={ai}>
      <SettingsSection title="Entrada">
        <div className={styles.rowLine}>
          <Text variant="callout">{email ?? "Sem e-mail"}</Text>
          {hasPassword && (
            <Badge tone="neutral" size="sm" icon={<KeyIcon />}>
              Senha
            </Badge>
          )}
          {providers.map((provider) => (
            <Badge key={provider} tone="neutral" size="sm">
              {providerLabels[provider] ?? provider}
            </Badge>
          ))}
        </div>
      </SettingsSection>

      {hasPassword ? (
        <SettingsSection title="Senha">
          <form className={styles.form} onSubmit={(event) => void changePassword(event)} noValidate>
            <div className={styles.pair}>
              <Field label="Nova senha" required error={error ?? undefined}>
                <PasswordInput value={password} autoComplete="new-password" disabled={saving} invalid={Boolean(error)} onChange={(event) => setPassword(event.target.value)} />
              </Field>
              <Field label="Repita a nova senha" required error={mismatch ? "As senhas não batem" : undefined}>
                <PasswordInput value={confirm} autoComplete="new-password" disabled={saving} invalid={mismatch} onChange={(event) => setConfirm(event.target.value)} />
              </Field>
            </div>
            <div className={styles.actions}>
              <Button type="submit" size="sm" radius="md" loading={saving} disabled={!canSave}>
                Trocar senha
              </Button>
            </div>
          </form>
        </SettingsSection>
      ) : (
        <SettingsSection title="Senha">
          <Text variant="footnote" tone="secondary">
            Entrando por {providers.map((provider) => providerLabels[provider] ?? provider).join(", ") || "provedor externo"}.
          </Text>
        </SettingsSection>
      )}

      <SettingsSection
        title="Verificação em duas etapas"
        aside={
          <Button size="sm" radius="md" variant={verified.length > 0 ? "outline" : "primary"} iconStart={<DeviceMobileIcon />} href={MFA_RETURN}>
            {verified.length > 0 ? "Cadastrar outro" : "Cadastrar autenticador"}
          </Button>
        }
      >
        {verified.length === 0 ? (
          <Text variant="footnote" tone="secondary">
            Nenhum autenticador cadastrado. A conta entra só com a senha.
          </Text>
        ) : (
          <div className={styles.list}>
            {verified.map((factor) => (
              <div key={factor.id} className={styles.row}>
                <span className={styles.glyph} style={{ "--item-hue": "var(--sys-green)" } as React.CSSProperties} aria-hidden="true">
                  <ShieldCheckIcon weight="duotone" />
                </span>
                <div className={styles.rowCopy}>
                  <Text as="span" variant="subheadline" weight="medium" truncate>
                    {factor.name}
                  </Text>
                  <Text as="span" variant="footnote" tone="secondary">
                    Cadastrado em {format(parseISO(factor.createdAt), "d 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  </Text>
                </div>
                <span className={styles.rowEnd}>
                  <Button variant="danger" size="sm" radius="md" iconStart={<TrashIcon />} onClick={() => setRemoving(factor)}>
                    Remover
                  </Button>
                </span>
              </div>
            ))}
          </div>
        )}
      </SettingsSection>

      <ConfirmDialog
        open={removing !== null}
        pending={busy}
        title={`Remover ${removing?.name ?? "o autenticador"}?`}
        description="A conta volta a entrar só com a senha. Se a senha vazar, não há segunda barreira."
        confirmLabel="Remover"
        pendingLabel="Removendo"
        onClose={() => setRemoving(null)}
        onConfirm={() => void remove()}
      />
    </SettingsPage>
  );
}
