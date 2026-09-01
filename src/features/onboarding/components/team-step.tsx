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
import {
  normalizeWebsite,
  slugFromName,
  type ImageKind,
  type OrganizationIndustry,
} from "@/features/organizations/schemas";
import type { Team } from "@/features/organizations/service";
import { uploadTeamImage } from "@/features/organizations/upload";
import { industryOptions } from "../labels";
import { ImagePicker } from "./image-picker";
import styles from "./onboarding.module.css";

type TeamStepProps = {
  team: Team | null;
  demo?: boolean;
  onDone: (team: Team) => void;
};

type Picked = { file: File | null; preview: string | null };

const empty: Picked = { file: null, preview: null };

export function TeamStep({ team, demo = false, onDone }: TeamStepProps) {
  const { toast } = useToast();
  const [name, setName] = useState(team?.name ?? "");
  // O prefixo https:// é afixo fixo do campo, então o valor guardado entra aqui sem ele.
  const [website, setWebsite] = useState((team?.website ?? "").replace(/^https?:\/\//i, ""));
  const [industry, setIndustry] = useState<OrganizationIndustry | undefined>(team?.industry ?? undefined);
  const [logo, setLogo] = useState<Picked>({ ...empty, preview: team?.logoUrl ?? null });
  const [banner, setBanner] = useState<Picked>({ ...empty, preview: team?.bannerUrl ?? null });
  const [saving, setSaving] = useState(false);

  // Revogar em limpeza de efeito quebraria no modo estrito, que desmonta e remonta: o endereço
  // seria descartado com a imagem ainda na tela. Aqui o anterior sai no momento em que deixa de ser usado.
  const choose = (current: Picked, apply: (next: Picked) => void) => (file: File) => {
    if (current.preview?.startsWith("blob:")) URL.revokeObjectURL(current.preview);
    apply({ file, preview: URL.createObjectURL(file) });
  };

  const reject = (message: string) => toast({ title: "Arquivo recusado", description: message, tone: "danger" });

  const filled = name.trim().length >= 2 && Boolean(industry);

  const sendImage = async (organizationId: string, picked: Picked, kind: ImageKind) => {
    if (!picked.file) return null;
    const result = await uploadTeamImage(organizationId, picked.file, kind);
    if (result.ok) return result.data;
    toast({ title: "A imagem não subiu", description: result.error, tone: "warning" });
    return null;
  };

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
        logoUrl: logo.preview,
        bannerUrl: banner.preview,
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

    const saved = result.data;
    const [logoUrl, bannerUrl] = [
      await sendImage(saved.id, logo, "logo"),
      await sendImage(saved.id, banner, "banner"),
    ];

    setSaving(false);
    onDone({ ...saved, logoUrl: logoUrl ?? saved.logoUrl, bannerUrl: bannerUrl ?? saved.bannerUrl });
  };

  return (
    <form className={styles.step} onSubmit={submit} noValidate>
      <div className={styles.identity}>
        <ImagePicker
          variant="banner"
          label="o banner do time"
          hint="1200 × 300"
          preview={banner.preview}
          disabled={saving}
          onSelect={choose(banner, setBanner)}
          onReject={reject}
        />
        <ImagePicker
          variant="logo"
          label="a logo do time"
          hint="512 × 512"
          preview={logo.preview}
          disabled={saving}
          onSelect={choose(logo, setLogo)}
          onReject={reject}
        />
      </div>

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
              iconStart={<FieldAffix data-tone="muted">https://</FieldAffix>}
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
