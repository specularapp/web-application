"use client";

import { ArrowRightIcon } from "@phosphor-icons/react";
import { useState, type FormEvent } from "react";
import { useToast } from "@/components/providers/toast-provider";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { FieldAffix } from "@/components/ui/field-shell";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { saveTeamAction } from "@/features/organizations/actions";
import { normalizeWebsite, slugFromName, type OrganizationIndustry } from "@/features/organizations/schemas";
import type { Team } from "@/features/organizations/service";
import { uploadLogo } from "@/features/organizations/upload";
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
  // O prefixo https:// é afixo fixo do campo, então o valor guardado entra aqui sem ele.
  const [website, setWebsite] = useState((team?.website ?? "").replace(/^https?:\/\//i, ""));
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

  const filled = name.trim().length >= 2 && Boolean(industry);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving || !industry) return;
    setSaving(true);

    if (demo) {
      setSaving(false);
      onDone({
        id: "demo",
        name,
        slug: slugFromName(name),
        industry,
        website: normalizeWebsite(website),
        logoUrl: logoPreview,
        completed: false,
      });
      return;
    }

    const result = await saveTeamAction({ organizationId: team?.id, name, industry, website });
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
      <LogoPicker
        preview={logoPreview}
        disabled={saving}
        onSelect={chooseFile}
        onReject={(message) => toast({ title: "Arquivo recusado", description: message, tone: "danger" })}
      />

      <div className={styles.form}>
        <div className={styles.pair}>
          <Field label="Nome do time">
            <Input
              type="text"
              name="name"
              value={name}
              placeholder="Como seu time se chama"
              autoComplete="organization"
              required
              onChange={(event) => setName(event.target.value)}
            />
          </Field>

          <Field label="Site">
            <Input
              type="text"
              name="website"
              value={website}
              placeholder="seusite.com.br"
              autoComplete="url"
              inputMode="url"
              spellCheck={false}
              iconStart={<FieldAffix>https://</FieldAffix>}
              onChange={(event) => setWebsite(event.target.value.replace(/^https?:\/\//i, ""))}
            />
          </Field>
        </div>

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
