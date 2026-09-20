"use client";

import { ArrowSquareOutIcon, CheckCircleIcon, ClockIcon, CopySimpleIcon, GlobeIcon, TrashIcon } from "@phosphor-icons/react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import { useState, type FormEvent } from "react";
import { useToast } from "@/components/providers/toast-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { TextLink } from "@/components/ui/link";
import { Text } from "@/components/ui/text";
import { usePlanGate } from "@/features/billing/components/plan-gate";
import { planBadges } from "@/features/billing/plans";
import { setCustomDomainAction, verifyCustomDomainAction } from "../actions";
import type { CustomDomain } from "../service";
import { SettingsPage, SettingsSection } from "./settings-page";
import styles from "./settings.module.css";

/**
 * O domínio próprio do portfólio (2026-09-17). A vitrine sempre vive em `/p/<slug>`; no plano Pro a equipe
 * aponta um domínio dela por CNAME e a casa passa a servir a vitrine nele também. Três passos: guardar o
 * domínio, apontar o CNAME no provedor, conferir aqui. A conferência é do servidor, porque é ela que libera.
 */
export function DomainSettings({ domain: initial }: { domain: CustomDomain }) {
  const { toast } = useToast();
  const gate = usePlanGate();
  const [domain, setDomain] = useState(initial);
  const [value, setValue] = useState(initial.domain ?? "");
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const changed = value.trim().toLowerCase() !== (domain.domain ?? "");
  const verified = Boolean(domain.verifiedAt);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (saving || !changed) return;
    setSaving(true);
    setError(null);
    const result = await setCustomDomainAction({ domain: value });
    setSaving(false);
    if (!result.ok) {
      if ("plan" in result) {
        gate.require("pro");
        return;
      }
      setError(result.error);
      return;
    }
    setDomain(result.domain);
    setValue(result.domain.domain ?? "");
    toast({ title: result.domain.domain ? "Domínio guardado" : "Domínio removido", description: result.domain.domain ? "Agora aponte o CNAME e confira." : "A vitrine segue no endereço da casa.", tone: "success" });
  };

  const remove = async () => {
    setSaving(true);
    const result = await setCustomDomainAction({ domain: "" });
    setSaving(false);
    if (!result.ok) {
      toast({ title: "Não deu para remover", description: result.error, tone: "danger" });
      return;
    }
    setDomain(result.domain);
    setValue("");
    toast({ title: "Domínio removido", description: "A vitrine segue no endereço da casa.", tone: "success" });
  };

  const verify = async () => {
    setChecking(true);
    const result = await verifyCustomDomainAction();
    setChecking(false);
    if (!result.ok) {
      toast({ title: "Ainda não confere", description: result.error, tone: "warning" });
      return;
    }
    setDomain(result.domain);
    toast({ title: "Domínio conferido", description: `${result.domain.domain} já serve o seu portfólio.`, tone: "success" });
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Copiado", description: text, tone: "success" });
    } catch {
      toast({ title: "Não deu para copiar", description: text, tone: "warning" });
    }
  };

  return (
    <SettingsPage
      title="Domínio"
      description="Por onde o cliente chega ao seu portfólio."
      aside={
        <Badge tone="neutral" variant="soft" size="sm">
          {planBadges.pro}
        </Badge>
      }
    >
      <SettingsSection title="Endereço da casa" description="Sempre funciona, com ou sem domínio próprio.">
        <div className={styles.code}>
          <code>{domain.fallbackUrl}</code>
          <Button variant="ghost" size="sm" radius="md" iconStart={<CopySimpleIcon />} onClick={() => void copy(domain.fallbackUrl)}>
            Copiar
          </Button>
          <Button variant="ghost" size="sm" radius="md" iconStart={<ArrowSquareOutIcon />} href={domain.fallbackUrl} target="_blank" rel="noreferrer">
            Abrir
          </Button>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Domínio próprio"
        description="Um endereço seu, como portfolio.seuestudio.com.br, apontando para a casa."
        aside={
          domain.domain ? (
            verified ? (
              <Badge tone="success" size="sm" icon={<CheckCircleIcon />}>
                Conferido em {format(parseISO(domain.verifiedAt!), "d 'de' MMM.", { locale: ptBR })}
              </Badge>
            ) : (
              <Badge tone="warning" size="sm" icon={<ClockIcon />}>
                Aguardando CNAME
              </Badge>
            )
          ) : undefined
        }
      >
        <form className={styles.form} onSubmit={(event) => void save(event)} noValidate>
          <Field label="Domínio" error={error ?? undefined}>
            <Input type="text" value={value} placeholder="portfolio.seuestudio.com.br" autoComplete="off" spellCheck={false} inputMode="url" disabled={saving} invalid={Boolean(error)} iconStart={<GlobeIcon />} onChange={(event) => setValue(event.target.value.toLowerCase())} />
          </Field>
          <div className={styles.actions}>
            {domain.domain && (
              <Button type="button" variant="ghost" size="sm" radius="md" iconStart={<TrashIcon />} disabled={saving} onClick={() => void remove()}>
                Remover domínio
              </Button>
            )}
            <Button type="submit" size="sm" radius="md" loading={saving} disabled={!changed || !value.trim()}>
              Guardar domínio
            </Button>
          </div>
        </form>

        {domain.domain && (
          <>
            <Text variant="footnote" tone="secondary">
              No painel do seu provedor de DNS, crie um registro <strong>CNAME</strong> com o nome do domínio apontando para o endereço abaixo.
              A propagação leva de minutos a 24 horas.
            </Text>
            <div className={styles.code}>
              <code>
                {domain.domain} → {domain.target}
              </code>
              <Button variant="ghost" size="sm" radius="md" iconStart={<CopySimpleIcon />} onClick={() => void copy(domain.target)}>
                Copiar destino
              </Button>
            </div>
            <div className={styles.actions}>
              {verified && (
                <Button variant="outline" size="sm" radius="md" iconStart={<ArrowSquareOutIcon />} href={`https://${domain.domain}`} target="_blank" rel="noreferrer">
                  Abrir no domínio
                </Button>
              )}
              <Button size="sm" radius="md" variant={verified ? "outline" : "primary"} loading={checking} onClick={() => void verify()}>
                {verified ? "Conferir de novo" : "Conferir CNAME"}
              </Button>
            </div>
          </>
        )}

        {!domain.domain && !gate.allows("pro") && (
          <Text variant="footnote" tone="secondary">
            Domínio próprio é do plano Pro. <TextLink href="/configuracoes/plano">Ver planos</TextLink>.
          </Text>
        )}
      </SettingsSection>
    </SettingsPage>
  );
}
