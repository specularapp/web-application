"use client";

import {
  BuildingsIcon,
  CheckCircleIcon,
  CheckIcon,
  DotsThreeVerticalIcon,
  IdentificationCardIcon,
  NotePencilIcon,
  PhoneIcon,
  StarIcon,
  UploadSimpleIcon,
  XIcon,
  type Icon,
} from "@phosphor-icons/react";
import Image from "next/image";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useFloatingActionsRegistration } from "@/components/layout/floating-actions";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { Field } from "@/components/ui/field";
import { FieldAffix } from "@/components/ui/field-shell";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { TagInput } from "@/components/ui/tag-input";
import { Text } from "@/components/ui/text";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/providers/toast-provider";
import { MOBILE_QUERY, useMediaQuery } from "@/hooks/use-media-query";
import { squircle } from "@/lib/corners";
import { onlyDigits } from "@/lib/masks";
import { loadClientAction, saveClientAction } from "../actions";
import type { ClientListItem } from "../list-options";
import type { ClientFormInput } from "../schemas";
import type { Client } from "../summary";
import styles from "./client-form-dialog.module.css";

/** O que a janela edita: a ficha completa, o item da lista (a ficha vem em seguida) ou `"new"` para criar. Nulo fecha. */
export type ClientEditor = Client | ClientListItem | "new" | null;

/* A ficha completa tem etiquetas; o item da lista, não. */
function isFull(editor: Client | ClientListItem): editor is Client {
  return "tags" in editor;
}

export type ClientFormDialogProps = {
  editor: ClientEditor;
  onClose: () => void;
  /** Depois de salvar com sucesso, além de fechar. */
  onSaved: () => void;
};

/** Tamanho máximo da foto e da logo, em bytes: 2 MB, o mesmo teto da logo da equipe. */
const IMAGE_MAX_BYTES = 2 * 1024 * 1024;
/** Quantas etiquetas uma ficha aceita, o mesmo teto do zod. */
const MAX_TAGS = 12;

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
    tags: client?.tags ?? [],
    active: client?.active ?? true,
    favorite: client?.favorite ?? false,
  };
}

type Values = ReturnType<typeof valuesOf>;

/* Só o que foi criado aqui é desfeito: o endereço que veio da ficha é de fora. */
function revokeLocal(url: string | null) {
  if (url?.startsWith("blob:")) URL.revokeObjectURL(url);
}

/* Um bloco do formulário: o glifo e o título numa linha, e os campos embaixo. Quem separa um bloco do
   outro é o fio, de ponta a ponta, como na gaveta de criar equipe. */
function Section({ icon: Glyph, title, children }: { icon: Icon; title: string; children: ReactNode }) {
  const id = useId();
  return (
    <section className={styles.section} aria-labelledby={id}>
      <div className={styles.heading}>
        <Glyph aria-hidden="true" />
        <Text as="h3" id={id} variant="subheadline" weight="semibold">
          {title}
        </Text>
      </div>
      {children}
    </section>
  );
}

/* A foto ou a logo com os botões ao lado: a imagem escolhida entra na hora, por endereço local. Sem
   imagem, a foto mostra o rosto gerado e a logo mostra a inicial da empresa. */
function ImageField({
  label,
  preview,
  fallback,
  onSelect,
}: {
  label: string;
  preview: string | null;
  fallback: ReactNode;
  onSelect: (file: File | null, message?: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);

  return (
    <div className={styles.image}>
      <span className={styles.imageFrame} {...squircle("lg", { clip: true })}>
        {preview ? <Image src={preview} alt="" fill sizes="3.5rem" unoptimized className={styles.imagePreview} /> : fallback}
      </span>
      <div className={styles.imageCopy}>
        <Text as="span" variant="footnote" weight="medium" truncate>
          {label}
        </Text>
        <div className={styles.imageActions}>
          <Button variant="outline" size="sm" radius="md" iconStart={<UploadSimpleIcon />} onClick={() => input.current?.click()}>
            {preview ? "Trocar" : "Enviar"}
          </Button>
          {preview && (
            <IconButton label={`Remover ${label.toLowerCase()}`} variant="ghost" size="sm" radius="md" onClick={() => onSelect(null)}>
              <XIcon />
            </IconButton>
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

// A ficha do cliente para criar e para editar, na gaveta lateral da casa, a mesma de criar equipe: 30rem
// na direita no desktop e bandeja no celular, com o título e o X grudados no topo, o formulário rolando no
// meio e Cancelar e Salvar fixos no rodapé. No celular o rodapé some e salvar e sair vão para a barra
// flutuante do menu. Três blocos separados por fio, identidade, contato e detalhes, com os campos no
// padrão da casa e em pares onde cabem. O estado é local e o envio é a action, que valida com zod de novo
// no servidor; erro de campo volta para o campo, e sucesso avisa e fecha. A foto e a logo entram na prévia
// na hora; o envio do arquivo chega com o storage. Ativo e favorito ficam no menu de três pontos do topo.
export function ClientFormDialog({ editor, onClose, onSaved }: ClientFormDialogProps) {
  const mobile = useMediaQuery(MOBILE_QUERY);

  return (
    // Sem escurecimento no desktop, como a gaveta de criar equipe: a página segue viva atrás. No celular
    // o escurecimento entra, senão o toque na barra flutuante, que fica acima da bandeja, fecharia a janela
    // como toque fora.
    <Dialog open={editor !== null} onClose={onClose} label={editor === "new" ? "Novo cliente" : "Editar cliente"} size="md" placement="end" surface="glass" scrim={mobile} focusOnOpen={false}>
      {editor === "new" && <ClientForm onClose={onClose} onSaved={onSaved} />}
      {editor !== null && editor !== "new" && (isFull(editor) ? <ClientForm client={editor} onClose={onClose} onSaved={onSaved} /> : <ClientLoader item={editor} onClose={onClose} onSaved={onSaved} />)}
    </Dialog>
  );
}

/* Aberta a partir do cartão, a gaveta só sabe o que o cartão sabia: mostra o nome no topo e o giro no meio
   enquanto a ficha completa chega, e aí o formulário entra já preenchido. É o mesmo desenho da gaveta de
   ficha, e é o que dá resposta ao clique na hora. */
function ClientLoader({ item, onClose, onSaved }: { item: ClientListItem; onClose: () => void; onSaved: () => void }) {
  const [full, setFull] = useState<Client | null>(null);

  useEffect(() => {
    let current = true;
    void loadClientAction(item.id).then((data) => {
      if (current) setFull(data);
    });
    return () => {
      current = false;
    };
  }, [item.id]);

  if (full) return <ClientForm client={full} onClose={onClose} onSaved={onSaved} />;

  return (
    <div className={styles.dialog}>
      <header className={styles.head}>
        <Text as="h2" variant="headline" weight="semibold" truncate>
          Editar cliente
        </Text>
        <IconButton label="Fechar" variant="ghost" size="sm" onClick={onClose}>
          <XIcon />
        </IconButton>
      </header>
      <div className={styles.loading}>
        <Spinner size="md" label={`Carregando a ficha de ${item.name}`} />
      </div>
    </div>
  );
}

/* O formulário nasce de novo a cada abertura, porque a janela só monta o conteúdo aberta: o estado começa
   limpo sem precisar zerar nada. */
function ClientForm({ client, onClose, onSaved }: { client?: Client; onClose: () => void; onSaved: () => void }) {
  const { toast } = useToast();
  const [values, setValues] = useState<Values>(() => valuesOf(client));
  const [error, setError] = useState<{ field?: string; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const editing = Boolean(client);
  const titleId = useId();
  const form = useRef<HTMLFormElement>(null);

  // No celular salvar e sair moram na barra flutuante do menu, acima da bandeja, e o rodapé some. O disparo
  // é o mesmo envio do formulário, então a validação e a action valem igual.
  useFloatingActionsRegistration({
    primary: { label: saving ? "Salvando" : editing ? "Salvar" : "Criar", loading: saving, onClick: () => form.current?.requestSubmit() },
    cancel: { label: "Cancelar", onClick: onClose },
  });

  // O endereço local da imagem escolhida é desfeito quando outro o substitui ou a janela fecha: o efeito
  // só limpa, sem escrever estado.
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
      tags: values.tags,
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
    onSaved();
  };

  const errorOf = (field: keyof Values) => (error?.field === field ? error.message : undefined);
  const seed = values.email || values.name || "cliente";
  const companyInitial = values.company.trim().charAt(0).toUpperCase();

  return (
    <form ref={form} className={styles.dialog} onSubmit={submit} noValidate aria-labelledby={titleId}>
      <header className={styles.head}>
        <Text as="h2" id={titleId} variant="headline" weight="semibold" truncate>
          {editing ? "Editar cliente" : "Novo cliente"}
        </Text>
        <div className={styles.headActions}>
          {/* Ativo e favorito são situação, e não dado da ficha: moram no menu de opções da própria
              janela, como interruptores, para não tomar linha do formulário. */}
          <DropdownMenu
            label="Situação do cliente"
            triggerLabel="Situação do cliente"
            icon={<DotsThreeVerticalIcon />}
            sections={[
              {
                id: "flags",
                label: "Situação",
                items: [
                  { kind: "toggle", id: "active", label: "Cliente ativo", icon: CheckCircleIcon, checked: values.active, onChange: (active) => set("active", active) },
                  { kind: "toggle", id: "favorite", label: "Favorito", icon: StarIcon, checked: values.favorite, onChange: (favorite) => set("favorite", favorite) },
                ],
              },
            ]}
          />
          <IconButton label="Fechar" variant="ghost" size="sm" disabled={saving} onClick={onClose}>
            <XIcon />
          </IconButton>
        </div>
      </header>

      <div className={styles.body}>
        <Section icon={IdentificationCardIcon} title="Identidade">
          <div className={styles.images}>
            <ImageField
              label="Foto"
              preview={photoUrl}
              fallback={<Avatar name={values.name || "Cliente"} seed={seed} size="lg" shape="squircle" className={styles.avatar} />}
              onSelect={pickImage(setPhotoUrl)}
            />
            <ImageField
              label="Logo"
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
              <Input type="text" name="company" value={values.company} placeholder="Onde trabalha" autoComplete="organization" disabled={saving} onChange={(event) => set("company", event.target.value)} />
            </Field>
            <Field label="Área" error={errorOf("role")}>
              <Input type="text" name="role" value={values.role} placeholder="O que a empresa faz" disabled={saving} onChange={(event) => set("role", event.target.value)} />
            </Field>
          </div>
        </Section>

        <Separator className={styles.divider} />

        <Section icon={PhoneIcon} title="Contato">
          <div className={styles.pair}>
            <Field label="E-mail" error={errorOf("email")}>
              <Input type="email" name="email" value={values.email} placeholder="pessoa@empresa.com.br" autoComplete="email" inputMode="email" disabled={saving} onChange={(event) => set("email", event.target.value)} />
            </Field>
            <Field label="Telefone" error={errorOf("phone")}>
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

        <Separator className={styles.divider} />

        <Section icon={NotePencilIcon} title="Detalhes">
          <Field label="Anotações" error={errorOf("about")}>
            <Textarea name="about" value={values.about} rows={3} placeholder="Como chegou, o que pediu, como prefere ser atendido" disabled={saving} onChange={(event) => set("about", event.target.value)} />
          </Field>
          <Field label="Etiquetas" error={errorOf("tags")}>
            <TagInput value={values.tags} placeholder="Digite e aperte Enter" max={MAX_TAGS} disabled={saving} onChange={(tags) => set("tags", tags)} />
          </Field>
        </Section>

        {error && !error.field && (
          <Text variant="footnote" tone="danger" role="alert" className={styles.alert}>
            {error.message}
          </Text>
        )}
      </div>

      <footer className={styles.foot}>
        <Button variant="outline" size="sm" radius="md" disabled={saving} onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" size="sm" radius="md" iconStart={<CheckIcon />} loading={saving}>
          {saving ? "Salvando" : editing ? "Salvar" : "Criar cliente"}
        </Button>
      </footer>
    </form>
  );
}
