"use client";

import { BuildingsIcon, CheckIcon, IdentificationCardIcon, NotePencilIcon, PhoneIcon, TagIcon, UploadSimpleIcon } from "@phosphor-icons/react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { FieldAffix } from "@/components/ui/field-shell";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Text } from "@/components/ui/text";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/providers/toast-provider";
import { squircle } from "@/lib/corners";
import { onlyDigits } from "@/lib/masks";
import { saveClientAction } from "../actions";
import type { ClientFormInput } from "../schemas";
import type { Client } from "../summary";
import styles from "./client-form.module.css";

export type ClientFormProps = {
  /** A ficha em edição; sem ela o formulário cria um cliente novo. */
  client?: Client;
};

/** Tamanho máximo da foto e da logo, em bytes: 2 MB, o mesmo teto da logo da equipe. */
const IMAGE_MAX_BYTES = 2 * 1024 * 1024;

/* O formulário guarda texto cru; a ficha guarda tipos. A conversão mora aqui, num lugar só. */
function valuesOf(client?: Client) {
  return {
    name: client?.name ?? "",
    company: client?.company ?? "",
    role: client?.role ?? "",
    email: client?.email ?? "",
    phone: client?.phone ?? "",
    website: client?.website?.replace(/^https?:\/\//i, "") ?? "",
    city: client?.city ?? "",
    about: client?.about ?? "",
    tags: client?.tags.join(", ") ?? "",
    active: client?.active ?? true,
    favorite: client?.favorite ?? false,
  };
}

type Values = ReturnType<typeof valuesOf>;

/* Só o que foi criado aqui é desfeito: o endereço que veio da ficha é de fora. */
function revokeLocal(url: string | null) {
  if (url?.startsWith("blob:")) URL.revokeObjectURL(url);
}

/* Um bloco do formulário, na moldura da referência: à esquerda o que a seção é e para que serve, à
   direita o painel com os campos. No celular os dois empilham. */
function Section({ icon: Glyph, title, description, children }: { icon: typeof BuildingsIcon; title: string; description: string; children: ReactNode }) {
  const id = useId();
  return (
    <section className={styles.section} aria-labelledby={id}>
      <div className={styles.intro}>
        <div className={styles.introTitle}>
          <Glyph aria-hidden="true" />
          <Text as="h2" id={id} variant="subheadline" weight="semibold">
            {title}
          </Text>
        </div>
        <Text variant="footnote" tone="secondary">
          {description}
        </Text>
      </div>
      <div className={styles.panel} {...squircle("xl")}>
        {children}
      </div>
    </section>
  );
}

/* A foto ou a logo com o botão de trocar ao lado, como na referência: a imagem escolhida entra na hora,
   por endereço local, e sobe junto com a ficha ao salvar. Sem imagem, a foto mostra o rosto gerado e a
   logo mostra a inicial da empresa. */
function ImageField({
  label,
  hint,
  preview,
  fallback,
  onSelect,
}: {
  label: string;
  hint: string;
  preview: string | null;
  fallback: ReactNode;
  onSelect: (file: File | null, message?: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);

  return (
    <div className={styles.image}>
      <span className={styles.imageFrame} {...squircle("lg", { clip: true })}>
        {preview ? <Image src={preview} alt="" fill sizes="5rem" unoptimized className={styles.imagePreview} /> : fallback}
      </span>
      <div className={styles.imageCopy}>
        <Text variant="subheadline" weight="medium">
          {label}
        </Text>
        <Text variant="caption1" tone="secondary">
          {hint}
        </Text>
        <div className={styles.imageActions}>
          <Button variant="outline" size="sm" radius="md" iconStart={<UploadSimpleIcon />} onClick={() => input.current?.click()}>
            {preview ? "Trocar" : "Enviar"}
          </Button>
          {preview && (
            <Button variant="ghost" size="sm" radius="md" onClick={() => onSelect(null)}>
              Remover
            </Button>
          )}
        </div>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className={styles.fileInput}
        aria-label={`Enviar ${label.toLowerCase()}`}
        onChange={(event) => {
          const file = event.target.files?.[0] ?? null;
          event.target.value = "";
          if (file && file.size > IMAGE_MAX_BYTES) {
            onSelect(null, "A imagem passa de 2 MB. Escolha uma menor.");
            return;
          }
          onSelect(file);
        }}
      />
    </div>
  );
}

// A ficha do cliente para criar e para editar, no mesmo formulário: identidade, contato, anotações,
// etiquetas e situação, cada um num bloco com a explicação à esquerda e os campos à direita. O estado é
// local e o envio é a action, que valida com zod de novo no servidor; erro de campo volta para o campo, e
// sucesso leva de volta à base com um aviso. A foto e a logo entram na prévia na hora; o envio do arquivo
// chega com o storage.
export function ClientForm({ client }: ClientFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [values, setValues] = useState<Values>(() => valuesOf(client));
  const [error, setError] = useState<{ field?: string; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const editing = Boolean(client);

  // O endereço local da imagem escolhida entra na hora, e é desfeito quando outro o substitui ou o
  // formulário sai: o efeito só limpa, sem escrever estado. O envio do arquivo em si entra com o storage.
  const [photoUrl, setPhotoUrl] = useState<string | null>(client?.avatarUrl ?? null);
  const [logoUrl, setLogoUrl] = useState<string | null>(client?.companyLogoUrl ?? null);
  useEffect(() => () => revokeLocal(photoUrl), [photoUrl]);
  useEffect(() => () => revokeLocal(logoUrl), [logoUrl]);

  const pickImage = (setUrl: (url: string | null) => void) => (file: File | null, message?: string) => {
    if (message) {
      toast({ title: "Imagem grande demais", description: message, tone: "warning" });
      return;
    }
    setUrl(file ? URL.createObjectURL(file) : null);
  };

  const set = <K extends keyof Values>(key: K, value: Values[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    if (error?.field === key) setError(null);
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const input: ClientFormInput = {
      id: client?.id,
      name: values.name,
      company: values.company,
      role: values.role,
      email: values.email.trim(),
      phone: values.phone,
      website: values.website.trim() ? `https://${values.website.trim()}` : "",
      city: values.city,
      about: values.about,
      tags: values.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      active: values.active,
      favorite: values.favorite,
    };

    const result = await saveClientAction(input);
    setSaving(false);

    if (!result.ok) {
      setError({ field: result.field, message: result.error });
      return;
    }

    toast({
      title: editing ? "Cliente atualizado" : "Cliente criado",
      description: `${values.name.trim()} já está na base.`,
      tone: "success",
    });
    router.push("/clientes");
  };

  const errorOf = (field: keyof Values) => (error?.field === field ? error.message : undefined);
  const seed = values.email || values.name || "cliente";
  const companyInitial = values.company.trim().charAt(0).toUpperCase();

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <Section icon={IdentificationCardIcon} title="Identidade" description="Quem é a pessoa, onde trabalha e as imagens que aparecem na ficha e na listagem.">
        <div className={styles.images}>
          <ImageField
            label="Foto"
            hint="PNG, JPG ou WebP até 2 MB. Sem foto, entra o rosto gerado."
            preview={photoUrl}
            fallback={<Avatar name={values.name || "Cliente"} seed={seed} size="lg" shape="squircle" className={styles.avatar} />}
            onSelect={pickImage(setPhotoUrl)}
          />
          <ImageField
            label="Logo da empresa"
            hint="Entra pequena na quina da foto. Sem logo, vale a inicial."
            preview={logoUrl}
            fallback={
              <span className={styles.initial} aria-hidden="true">
                {companyInitial || <BuildingsIcon />}
              </span>
            }
            onSelect={pickImage(setLogoUrl)}
          />
        </div>

        <Field label="Nome" required error={errorOf("name")}>
          <Input type="text" name="name" value={values.name} placeholder="Nome completo" autoComplete="name" required disabled={saving} onChange={(event) => set("name", event.target.value)} />
        </Field>

        <div className={styles.pair}>
          <Field label="Empresa" error={errorOf("company")}>
            <Input type="text" name="company" value={values.company} placeholder="Onde a pessoa trabalha" autoComplete="organization" disabled={saving} onChange={(event) => set("company", event.target.value)} />
          </Field>
          <Field label="Área" hint="O que a empresa faz, em poucas palavras" error={errorOf("role")}>
            <Input type="text" name="role" value={values.role} placeholder="Design de interiores" disabled={saving} onChange={(event) => set("role", event.target.value)} />
          </Field>
        </div>
      </Section>

      <Section icon={PhoneIcon} title="Contato" description="Por onde falar com a pessoa. É o que os botões de WhatsApp, e-mail e ligar usam.">
        <div className={styles.pair}>
          <Field label="E-mail" error={errorOf("email")}>
            <Input type="email" name="email" value={values.email} placeholder="pessoa@empresa.com.br" autoComplete="email" inputMode="email" disabled={saving} onChange={(event) => set("email", event.target.value)} />
          </Field>
          <Field label="Telefone" hint="Com DDD" error={errorOf("phone")}>
            <Input type="tel" name="phone" mask="phone" value={values.phone} placeholder="(11) 99999-9999" autoComplete="tel-national" disabled={saving} onChange={(event) => set("phone", onlyDigits(event.target.value))} />
          </Field>
        </div>
        <div className={styles.pair}>
          <Field label="Site" error={errorOf("website")}>
            <Input
              type="text"
              name="website"
              value={values.website}
              placeholder="empresa.com.br"
              autoComplete="url"
              inputMode="url"
              spellCheck={false}
              disabled={saving}
              iconStart={<FieldAffix data-tone="muted">https://</FieldAffix>}
              onChange={(event) => set("website", event.target.value.replace(/^https?:\/\//i, ""))}
            />
          </Field>
          <Field label="Cidade" error={errorOf("city")}>
            <Input type="text" name="city" value={values.city} placeholder="São Paulo, SP" autoComplete="address-level2" disabled={saving} onChange={(event) => set("city", event.target.value)} />
          </Field>
        </div>
      </Section>

      <Section icon={NotePencilIcon} title="Sobre" description="Anotações da equipe: como chegou, o que pediu, como prefere ser atendido.">
        <Field label="Anotações" error={errorOf("about")}>
          <Textarea name="about" value={values.about} rows={5} placeholder="Chegou por indicação e pediu um site institucional para o mês que vem." disabled={saving} onChange={(event) => set("about", event.target.value)} />
        </Field>
      </Section>

      <Section icon={TagIcon} title="Etiquetas" description="Serviços contratados, segmento, origem. Aparecem na ficha e ajudam a achar depois.">
        <Field label="Etiquetas" hint="Separe por vírgula" error={errorOf("tags")}>
          <Input type="text" name="tags" value={values.tags} placeholder="Site institucional, Indicação" disabled={saving} onChange={(event) => set("tags", event.target.value)} />
        </Field>
      </Section>

      <Section icon={CheckIcon} title="Situação" description="Cliente inativo continua na base, só sai dos filtros do dia a dia. Favorito sobe na lista.">
        <div className={styles.toggles}>
          <Switch checked={values.active} disabled={saving} onChange={(event) => set("active", event.target.checked)}>
            <span className={styles.toggleCopy}>
              <Text as="span" variant="subheadline" weight="medium">
                Cliente ativo
              </Text>
              <Text as="span" variant="caption1" tone="secondary">
                Aparece nos filtros padrão e nas sugestões
              </Text>
            </span>
          </Switch>
          <Switch checked={values.favorite} disabled={saving} onChange={(event) => set("favorite", event.target.checked)}>
            <span className={styles.toggleCopy}>
              <Text as="span" variant="subheadline" weight="medium">
                Favorito
              </Text>
              <Text as="span" variant="caption1" tone="secondary">
                Ganha a estrela na ficha e o filtro próprio
              </Text>
            </span>
          </Switch>
        </div>
      </Section>

      {error && !error.field && (
        <Text variant="footnote" tone="danger" role="alert">
          {error.message}
        </Text>
      )}

      <div className={styles.foot}>
        <Button variant="outline" radius="md" href="/clientes" disabled={saving}>
          Cancelar
        </Button>
        <Button type="submit" radius="md" iconStart={<CheckIcon />} loading={saving}>
          {saving ? "Salvando" : editing ? "Salvar alterações" : "Criar cliente"}
        </Button>
      </div>
    </form>
  );
}
