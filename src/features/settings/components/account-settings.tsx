"use client";

import { CrownIcon, ShieldCheckIcon, StarIcon, UploadSimpleIcon, UserIcon, type Icon } from "@phosphor-icons/react";
import { useRef, useState, type FormEvent } from "react";
import { useToast } from "@/components/providers/toast-provider";
import { Avatar, avatarHue } from "@/components/ui/avatar";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Profile } from "@/components/ui/profile";
import { Text } from "@/components/ui/text";
import { Textarea } from "@/components/ui/textarea";
import type { AiUsage } from "@/features/ai/summary";
import { roleLabels } from "@/features/onboarding/labels";
import type { TeamMember } from "@/features/organizations/service";
import type { TeamMember as MemberSummary } from "@/features/organizations/summary";
import { compactMoney } from "@/lib/utils/format";
import { saveAccountAction, saveResumeAction } from "../actions";
import { accountLimits, resumeLimits } from "../schemas";
import type { Account, Resume } from "../service";
import { uploadAvatar } from "../upload";
import { SettingsPage, SettingsSection } from "./settings-page";
import styles from "./account-settings.module.css";
import shared from "./settings.module.css";

export type AccountSettingsProps = {
  account: Account;
  /** O currículo da pessoa, de onde saem o título, a cidade e o sobre; nulo sem perfil. */
  resume: Resume | null;
  viewer: TeamMember;
  /** A pessoa no resumo da equipe, com o papel, os pontos e os números; nula fora da lista de membros. */
  member: MemberSummary | null;
  ai: AiUsage;
};

/* O papel de acesso em etiqueta, com o mesmo glifo e tom do perfil de membro da equipe. */
const accessMeta: Record<TeamMember["role"], { icon: Icon; tone: BadgeTone }> = {
  owner: { icon: CrownIcon, tone: "yellow" },
  admin: { icon: ShieldCheckIcon, tone: "info" },
  member: { icon: UserIcon, tone: "neutral" },
};

const points = new Intl.NumberFormat("pt-BR");

/** O que a página edita: o nome, da conta, e o título, a cidade e o sobre, do currículo. */
type Values = { fullName: string; headline: string; location: string; bio: string };

const valuesOf = (account: Account, resume: Resume | null): Values => ({
  fullName: account.fullName,
  headline: resume?.headline ?? "",
  location: resume?.location ?? "",
  bio: resume?.bio ?? "",
});

const same = (a: Values, b: Values) => (Object.keys(a) as (keyof Values)[]).every((key) => a[key].trim() === b[key].trim());

/**
 * A conta é a página da pessoa (refeita em 2026-09-20 sobre uma referência de configurações do usuário, só
 * com peças que já existiam). O cabeçalho é o `Profile` da casa, o mesmo do cliente e do membro da equipe: a
 * capa no matiz da pessoa, a foto passando por cima, o nome com o papel e os pontos, o e-mail e o que ela
 * faz, os quatro números que o bloco de equipe do painel já mede e, na ponta do nome, Cancelar e Salvar,
 * que valem para a página inteira, como na referência. Embaixo, em cards, o formulário do currículo e a foto
 * de perfil, na receita de envio da casa.
 *
 * A equipe saiu daqui de vez: ela é outra coisa, e tem a página dela em `/configuracoes/equipe`. O e-mail
 * fica no cabeçalho e não se troca aqui: é o de entrada, e mudar isso é coisa de Segurança.
 */
export function AccountSettings({ account, resume: initialResume, viewer, member, ai }: AccountSettingsProps) {
  const { toast } = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const [resume, setResume] = useState(initialResume);
  const [saved, setSaved] = useState(() => valuesOf(account, initialResume));
  const [values, setValues] = useState(saved);
  const [avatarUrl, setAvatarUrl] = useState(account.avatarUrl);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<{ field?: string; message: string } | null>(null);

  const seed = account.email ?? account.id;
  const access = accessMeta[viewer.role];
  const changed = !same(values, saved);

  const set = <K extends keyof Values>(key: K, value: Values[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    if (error) setError(null);
  };

  const reset = () => {
    setValues(saved);
    setError(null);
  };

  /* Nome e currículo moram em tabelas e ações diferentes; a página salva os dois de uma vez, e só o que
     mudou, para um erro de um lado não desfazer o outro. */
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (saving || !changed) return;
    setSaving(true);
    setError(null);

    if (values.fullName.trim() !== saved.fullName.trim()) {
      const result = await saveAccountAction({ fullName: values.fullName });
      if (!result.ok) {
        setSaving(false);
        setError({ field: "fullName", message: result.error });
        return;
      }
    }

    const resumeChanged = values.headline.trim() !== saved.headline.trim() || values.location.trim() !== saved.location.trim() || values.bio.trim() !== saved.bio.trim();
    if (resumeChanged && resume) {
      const result = await saveResumeAction({
        headline: values.headline,
        bio: values.bio,
        location: values.location,
        skills: resume.skills,
        links: resume.links,
        resumeSlug: resume.resumeSlug,
        resumePublic: resume.resumePublic,
      });
      if (!result.ok) {
        setSaving(false);
        setError({ field: result.field, message: result.error });
        return;
      }
      setResume(result.resume);
    }

    setSaving(false);
    setSaved(values);
    toast({ title: "Perfil salvo", description: "É assim que a equipe e os clientes passam a ver você.", tone: "success" });
  };

  const pick = async (file: File | null) => {
    if (!file) return;
    setUploading(true);
    const result = await uploadAvatar(file);
    setUploading(false);
    if (!result.ok) {
      toast({ title: "Não deu para enviar a foto", description: result.error, tone: "danger" });
      return;
    }
    setAvatarUrl(result.url);
    toast({ title: "Foto atualizada", description: "Ela já aparece no menu e nos documentos.", tone: "success" });
  };

  const errorOf = (field: string) => (error?.field === field ? error.message : undefined);
  const name = values.fullName.trim() || "Você";

  return (
    <SettingsPage ai={ai}>
      <form className={shared.form} onSubmit={(event) => void save(event)} noValidate>
        <div className={styles.frame}>
          <Profile
            hue={avatarHue(seed)}
            avatar={{ name, src: avatarUrl ?? undefined, seed }}
            title={name}
            badges={
              <>
                <Badge tone={access.tone} size="sm" icon={<access.icon />}>
                  {roleLabels[viewer.role]}
                </Badge>
                {member && member.points > 0 && (
                  <Badge tone="neutral" size="sm" icon={<StarIcon weight="fill" />}>
                    {points.format(member.points)} pontos
                  </Badge>
                )}
              </>
            }
            menu={
              <span className={styles.menu}>
                <Button type="button" variant="ghost" size="sm" radius="md" disabled={!changed || saving} onClick={reset}>
                  Cancelar
                </Button>
                <Button type="submit" size="sm" radius="md" loading={saving} disabled={!changed}>
                  Salvar
                </Button>
              </span>
            }
            handle={account.email ?? undefined}
            subtitle={values.headline.trim() || undefined}
            stats={
              member
                ? [
                    { label: "Entregues", value: String(member.metrics.deliveredProjects) },
                    { label: "Faturamento", value: compactMoney(member.metrics.revenue) },
                    { label: "Em andamento", value: String(member.metrics.activeProjects) },
                    { label: "Tarefas abertas", value: String(member.metrics.openTasks) },
                  ]
                : []
            }
          >
            {null}
          </Profile>
        </div>

        <SettingsSection title="Perfil público">
          <Field label="Nome" required error={errorOf("fullName")}>
            <Input type="text" value={values.fullName} maxLength={accountLimits.fullName} autoComplete="name" disabled={saving} invalid={Boolean(errorOf("fullName"))} onChange={(event) => set("fullName", event.target.value)} />
          </Field>
          <div className={shared.pair}>
            <Field label="Título" error={errorOf("headline")}>
              <Input type="text" value={values.headline} maxLength={resumeLimits.headline} placeholder="Designer de produto" disabled={saving} invalid={Boolean(errorOf("headline"))} onChange={(event) => set("headline", event.target.value)} />
            </Field>
            <Field label="Cidade" error={errorOf("location")}>
              <Input type="text" value={values.location} maxLength={resumeLimits.location} placeholder="São Paulo, SP" disabled={saving} invalid={Boolean(errorOf("location"))} onChange={(event) => set("location", event.target.value)} />
            </Field>
          </div>
          <Field label="Sobre você" error={errorOf("bio")}>
            <Textarea rows={5} value={values.bio} maxLength={resumeLimits.bio} placeholder="Como você trabalha, com quem já trabalhou, o que gosta de fazer." disabled={saving} invalid={Boolean(errorOf("bio"))} onChange={(event) => set("bio", event.target.value)} />
          </Field>
          {error && !error.field && (
            <Text variant="footnote" tone="danger" role="alert">
              {error.message}
            </Text>
          )}
        </SettingsSection>

        {/* A foto sobe na hora, fora do Salvar da página: é arquivo, e não campo, e a receita é a mesma da
            capa de projeto e da foto de cobrança. */}
        <SettingsSection title="Foto de perfil">
          <div className={shared.rowLine}>
            <Avatar name={name} src={avatarUrl ?? undefined} seed={seed} size="lg" />
            <Button type="button" variant="outline" size="sm" radius="md" iconStart={<UploadSimpleIcon />} loading={uploading} onClick={() => fileInput.current?.click()}>
              {avatarUrl ? "Trocar foto" : "Enviar foto"}
            </Button>
            <input
              ref={fileInput}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className={shared.fileInput}
              aria-label="Enviar a sua foto"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                event.target.value = "";
                void pick(file);
              }}
            />
          </div>
        </SettingsSection>
      </form>
    </SettingsPage>
  );
}
