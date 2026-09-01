"use client";

import { ArrowRightIcon } from "@phosphor-icons/react";
import { useState, type FormEvent } from "react";
import { useToast } from "@/components/providers/toast-provider";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Text } from "@/components/ui/text";
import { saveTeamAction } from "@/features/organizations/actions";
import { slugify, type OrganizationIndustry } from "@/features/organizations/schemas";
import type { Team } from "@/features/organizations/service";
import { uploadLogo } from "@/features/organizations/upload";
import { siteConfig } from "@/lib/metadata";
import { industryOptions } from "../labels";
import { LogoPicker } from "./logo-picker";
import styles from "./onboarding.module.css";

type TeamStepProps = {
  team: Team | null;
  demo?: boolean;
  onDone: (team: Team) => void;
};

export function TeamStep({ team, demo = false, onDone }: TeamStepProps) {
  const { toast } = useToast();
  const [name, setName] = useState(team?.name ?? "");
  const [slug, setSlug] = useState(team?.slug ?? "");
  const [slugEdited, setSlugEdited] = useState(Boolean(team?.slug));
  const [industry, setIndustry] = useState<OrganizationIndustry | undefined>(team?.industry ?? undefined);
  const [file, setFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(team?.logoUrl ?? null);
  const [saving, setSaving] = useState(false);

  // Revogar em limpeza de efeito quebraria no modo estrito, que desmonta e remonta: o endereço
  // seria descartado com a imagem ainda na tela. Aqui o anterior sai no momento em que deixa de ser usado.
  const chooseFile = (next: File) => {
    if (logoPreview?.startsWith("blob:")) URL.revokeObjectURL(logoPreview);
    setFile(next);
    setLogoPreview(URL.createObjectURL(next));
  };

  const filled = name.trim().length >= 2 && slug.trim().length >= 3 && Boolean(industry);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving || !industry) return;
    setSaving(true);

    if (demo) {
      setSaving(false);
      onDone({ id: "demo", name, slug, industry, logoUrl: logoPreview, completed: false });
      return;
    }

    const result = await saveTeamAction({ organizationId: team?.id, name, slug, industry });
    if (!result.ok) {
      toast({ title: "Não foi possível salvar", description: result.error, tone: "danger" });
      setSaving(false);
      return;
    }

    let saved = result.data;
    if (file) {
      const logo = await uploadLogo(saved.id, file);
      if (logo.ok) saved = { ...saved, logoUrl: logo.data };
      else toast({ title: "A logo não subiu", description: logo.error, tone: "warning" });
    }

    setSaving(false);
    onDone(saved);
  };

  return (
    <form className={styles.step} onSubmit={submit} noValidate>
      <div className={styles.identity}>
        <LogoPicker
          preview={logoPreview}
          disabled={saving}
          onSelect={chooseFile}
          onReject={(message) => toast({ title: "Arquivo recusado", description: message, tone: "danger" })}
        />
        <div className={styles.identityText}>
          <Text variant="subheadline" weight="medium">
            Logo do time
          </Text>
          <Text variant="footnote" tone="secondary">
            PNG, JPG ou WEBP quadrado, até 2 MB
          </Text>
        </div>
      </div>

      <div className={styles.form}>
        <Field label="Nome do time">
          <Input
            type="text"
            name="name"
            value={name}
            placeholder="Como seu time se chama"
            autoComplete="organization"
            required
            onChange={(event) => {
              setName(event.target.value);
              if (!slugEdited) setSlug(slugify(event.target.value));
            }}
          />
        </Field>

        <Field
          label="Domínio"
          hint={
            <span className={styles.address}>
              Endereço público do time: {siteConfig.hosts.app}/p/{slug || "seu-time"}
            </span>
          }
        >
          <Input
            type="text"
            name="slug"
            value={slug}
            placeholder="seu-time"
            autoComplete="off"
            spellCheck={false}
            required
            onChange={(event) => {
              setSlugEdited(true);
              setSlug(slugify(event.target.value));
            }}
          />
        </Field>

        <Field label="Área de atuação">
          <Select
            label="Área de atuação"
            options={industryOptions}
            value={industry}
            placeholder="Escolha a área do time"
            onChange={setIndustry}
          />
        </Field>
      </div>

      <div className={styles.actions}>
        <Button type="submit" size="lg" loading={saving} disabled={!filled} iconEnd={<ArrowRightIcon />}>
          {saving ? "Salvando" : "Avançar"}
        </Button>
      </div>
    </form>
  );
}
