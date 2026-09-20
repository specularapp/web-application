"use client";

import { ArrowSquareOutIcon, CopySimpleIcon, PlusIcon, XIcon } from "@phosphor-icons/react";
import { useState, type FormEvent, type KeyboardEvent } from "react";
import { useToast } from "@/components/providers/toast-provider";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { FieldAffix } from "@/components/ui/field-shell";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { TextLink } from "@/components/ui/link";
import { Switch } from "@/components/ui/switch";
import { Text } from "@/components/ui/text";
import { Textarea } from "@/components/ui/textarea";
import { saveResumeAction } from "@/features/settings/actions";
import type { AiUsage } from "@/features/ai/summary";
import { SettingsPage, SettingsSection } from "@/features/settings/components/settings-page";
import styles from "@/features/settings/components/settings.module.css";
import { resumeLimits, type ResumeLink } from "@/features/settings/schemas";
import type { Resume } from "@/features/settings/service";
import { siteConfig } from "@/lib/metadata";
import { slugify } from "@/lib/utils/slug";

/**
 * O currículo (2026-09-17): a apresentação da pessoa, as habilidades, os links e o endereço público. É da
 * pessoa, e não da equipe: quem muda de estúdio leva o dele. A página pública (`/cv/<slug>`) só existe com
 * o endereço preenchido e a chave ligada; a foto e o nome vêm da conta, para não haver dois nomes da mesma
 * pessoa na casa. Os projetos públicos das equipes de que a pessoa faz parte entram sozinhos.
 */
export function ResumeEditor({ resume: initial, publicUrl: initialUrl, ai }: { resume: Resume; publicUrl: string | null; ai: AiUsage }) {
  const { toast } = useToast();
  const [values, setValues] = useState(initial);
  const [skill, setSkill] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<{ field?: string; message: string } | null>(null);
  const [publicUrl, setPublicUrl] = useState(initialUrl);

  const set = <K extends keyof Resume>(key: K, value: Resume[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    if (error) setError(null);
  };

  const addSkill = () => {
    const next = skill.trim();
    if (!next || values.skills.includes(next) || values.skills.length >= resumeLimits.skills) return;
    set("skills", [...values.skills, next]);
    setSkill("");
  };

  const onSkillKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addSkill();
    }
    if (event.key === "Backspace" && skill === "" && values.skills.length > 0) {
      set("skills", values.skills.slice(0, -1));
    }
  };

  const setLink = (index: number, patch: Partial<ResumeLink>) => set("links", values.links.map((link, position) => (position === index ? { ...link, ...patch } : link)));

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);
    const result = await saveResumeAction({
      headline: values.headline,
      bio: values.bio,
      location: values.location,
      skills: values.skills,
      links: values.links.filter((link) => link.label.trim() || link.url.trim()),
      resumeSlug: values.resumeSlug,
      resumePublic: values.resumePublic,
    });
    setSaving(false);
    if (!result.ok) {
      setError({ field: result.field, message: result.error });
      return;
    }
    setValues(result.resume);
    setPublicUrl(result.resume.resumeSlug ? `${siteConfig.url}/cv/${result.resume.resumeSlug}` : null);
    toast({ title: "Currículo salvo", description: result.resume.resumePublic ? "Já está no ar no seu endereço." : "Guardado; ligue a chave para publicar.", tone: "success" });
  };

  const errorOf = (field: string) => (error?.field === field ? error.message : undefined);

  const copy = async () => {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
      toast({ title: "Link copiado", description: publicUrl, tone: "success" });
    } catch {
      toast({ title: "Não deu para copiar", description: publicUrl, tone: "warning" });
    }
  };

  return (
    <SettingsPage ai={ai}
      aside={
        values.resumePublic && publicUrl ? (
          <Badge tone="success" size="sm">
            Público
          </Badge>
        ) : (
          <Badge tone="neutral" size="sm">
            Só você vê
          </Badge>
        )
      }
    >
      <form className={styles.form} onSubmit={(event) => void save(event)} noValidate>
        <SettingsSection title="Apresentação">
          <div className={styles.identity}>
            <Avatar name={values.fullName || "Você"} src={values.avatarUrl ?? undefined} size="lg" />
            <div className={`${styles.form} ${styles.identityForm}`}>
              <Field label="Título" error={errorOf("headline")}>
                <Input type="text" value={values.headline} maxLength={resumeLimits.headline} placeholder="Designer de produto" disabled={saving} onChange={(event) => set("headline", event.target.value)} />
              </Field>
              <Field label="Cidade" error={errorOf("location")}>
                <Input type="text" value={values.location} maxLength={resumeLimits.location} placeholder="São Paulo, SP" disabled={saving} onChange={(event) => set("location", event.target.value)} />
              </Field>
            </div>
          </div>
          <Field label="Sobre você" error={errorOf("bio")}>
            <Textarea rows={5} value={values.bio} maxLength={resumeLimits.bio} placeholder="Como você trabalha, com quem já trabalhou, o que gosta de fazer." disabled={saving} onChange={(event) => set("bio", event.target.value)} />
          </Field>
        </SettingsSection>

        <SettingsSection title="Habilidades">
          <div className={styles.chips}>
            {values.skills.map((entry) => (
              <span key={entry} className={styles.chip}>
                {entry}
                <IconButton label={`Tirar ${entry}`} variant="ghost" size="sm" disabled={saving} onClick={() => set("skills", values.skills.filter((item) => item !== entry))}>
                  <XIcon />
                </IconButton>
              </span>
            ))}
          </div>
          <Field label="Nova habilidade" error={errorOf("skills")}>
            <Input
              type="text"
              value={skill}
              maxLength={resumeLimits.skill}
              placeholder="Figma, Next.js, direção de arte"
              disabled={saving || values.skills.length >= resumeLimits.skills}
              iconEnd={
                <IconButton label="Adicionar habilidade" variant="ghost" size="sm" disabled={!skill.trim()} onClick={addSkill}>
                  <PlusIcon />
                </IconButton>
              }
              onChange={(event) => setSkill(event.target.value)}
              onKeyDown={onSkillKey}
            />
          </Field>
        </SettingsSection>

        <SettingsSection
          title="Links"
          aside={
            values.links.length < resumeLimits.links ? (
              <Button type="button" variant="outline" size="sm" radius="md" iconStart={<PlusIcon />} disabled={saving} onClick={() => set("links", [...values.links, { label: "", url: "" }])}>
                Adicionar link
              </Button>
            ) : undefined
          }
        >
          {values.links.length === 0 ? (
            <Text variant="footnote" tone="secondary">
              Nenhum link ainda.
            </Text>
          ) : (
            <div className={styles.list}>
              {values.links.map((link, index) => (
                <div key={index} className={styles.pair}>
                  <Field label="Nome" error={error?.field === `links.${index}.label` ? error.message : undefined}>
                    <Input type="text" value={link.label} maxLength={resumeLimits.linkLabel} placeholder="LinkedIn" disabled={saving} onChange={(event) => setLink(index, { label: event.target.value })} />
                  </Field>
                  <Field label="Endereço" error={error?.field === `links.${index}.url` ? error.message : undefined}>
                    <Input
                      type="url"
                      value={link.url}
                      placeholder="https://"
                      inputMode="url"
                      spellCheck={false}
                      disabled={saving}
                      iconEnd={
                        <IconButton label="Tirar link" variant="ghost" size="sm" disabled={saving} onClick={() => set("links", values.links.filter((_, position) => position !== index))}>
                          <XIcon />
                        </IconButton>
                      }
                      onChange={(event) => setLink(index, { url: event.target.value })}
                    />
                  </Field>
                </div>
              ))}
            </div>
          )}
        </SettingsSection>

        <SettingsSection title="Endereço público">
          <Field label="Endereço" error={errorOf("resumeSlug")}>
            <Input
              type="text"
              value={values.resumeSlug}
              maxLength={40}
              placeholder={slugify(values.fullName || "seu-nome", 40)}
              autoComplete="off"
              spellCheck={false}
              disabled={saving}
              invalid={Boolean(errorOf("resumeSlug"))}
              iconStart={<FieldAffix data-tone="muted">{siteConfig.url.replace(/^https?:\/\//, "")}/cv/</FieldAffix>}
              onChange={(event) => set("resumeSlug", slugify(event.target.value, 40))}
            />
          </Field>
          <div className={styles.rowLine} style={{ justifyContent: "space-between" }}>
            <span className={styles.rowCopy}>
              <Text as="span" variant="subheadline" weight="medium">
                Currículo público
              </Text>
              <Text as="span" variant="footnote" tone="secondary">
                {values.resumeSlug ? "Quem tiver o link abre, sem conta." : "Preencha o endereço para poder ligar."}
              </Text>
            </span>
            <Switch size="sm" aria-label="Currículo público" checked={values.resumePublic} disabled={saving || !values.resumeSlug} onChange={(event) => set("resumePublic", event.target.checked)} />
          </div>
          {publicUrl && (
            <div className={styles.code}>
              <code>{publicUrl}</code>
              <Button type="button" variant="ghost" size="sm" radius="md" iconStart={<CopySimpleIcon />} onClick={() => void copy()}>
                Copiar
              </Button>
              <Button type="button" variant="ghost" size="sm" radius="md" iconStart={<ArrowSquareOutIcon />} href={publicUrl} target="_blank" rel="noreferrer">
                Abrir
              </Button>
            </div>
          )}
          {error && !error.field && (
            <Text variant="footnote" tone="danger" role="alert">
              {error.message}
            </Text>
          )}
          <div className={styles.actions}>
            <Text variant="caption1" tone="secondary" style={{ marginInlineEnd: "auto" }}>
              O portfólio da equipe fica em <TextLink href="/portfolio">Portfólio</TextLink>.
            </Text>
            <Button type="submit" size="sm" radius="md" loading={saving}>
              Salvar currículo
            </Button>
          </div>
        </SettingsSection>
      </form>
    </SettingsPage>
  );
}
