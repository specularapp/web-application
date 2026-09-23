"use client";

import {
  BuildingsIcon,
  CheckCircleIcon,
  CheckIcon,
  IdentificationCardIcon,
  NotePencilIcon,
  PhoneIcon,
  StarIcon,
  UploadSimpleIcon,
  XIcon,
  type Icon,
} from "@phosphor-icons/react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { StoredImage } from "@/components/ui/stored-image";
import { useFloatingActionsRegistration } from "@/components/layout/floating-actions";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { Field } from "@/components/ui/field";
import { FieldAffix } from "@/components/ui/field-shell";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { TagPicker } from "@/components/ui/tag-picker";
import { Text } from "@/components/ui/text";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/providers/toast-provider";
import { SOURCE_MAX_BYTES } from "@/lib/images/compress";
import { MOBILE_QUERY, useMediaQuery } from "@/hooks/use-media-query";
import { callAction } from "@/lib/action";
import { rounded } from "@/lib/corners";
import { onlyDigits } from "@/lib/masks";
import { removeImage, uploadImage } from "@/features/uploads/upload";
import { saveClientAction } from "../actions";
import { ClientLoadFailure, useFullClient } from "../load-client";
import { clientTagCatalog } from "../tags";
import type { ClientListItem } from "../list-options";
import { clientLimits, MAX_TAGS, type ClientFormInput } from "../schemas";
import type { Client, ClientKind } from "../summary";
import styles from "./client-form-dialog.module.css";
import { siteUrl, siteValue } from "@/lib/utils/site";

/** O que a janela edita: a ficha completa, o item da lista (a ficha vem em seguida) ou `"new"` para criar. Nulo fecha. */
export type ClientEditor = Client | ClientListItem | "new" | null;

/* A ficha completa tem etiquetas; o item da lista, não. */
function isFull(editor: Client | ClientListItem): editor is Client {
  return "tags" in editor;
}

export type ClientFormDialogProps = {
  editor: ClientEditor;
  defaultKind?: ClientKind;
  onClose: () => void;
  /** Depois de salvar com sucesso, além de fechar. */
  onSaved: () => void;
};

/* O formulário guarda texto cru; a ficha guarda tipos. A conversão mora aqui, num lugar só. */
function valuesOf(client?: Client, defaultKind: ClientKind = "customer") {
  return {
    kind: client?.kind ?? defaultKind,
    name: client?.name ?? "",
    company: client?.company ?? "",
    role: client?.role ?? "",
    email: client?.email ?? "",
    phone: client?.phone ?? "",
    website: siteValue(client?.website ?? ""),
    city: client?.city ?? "",
    about: client?.about ?? "",
    tags: client?.tags ?? [],
    active: client?.active ?? true,
    favorite: client?.favorite ?? false,
  };
}

type Values = ReturnType<typeof valuesOf>;

/**
 * O `https://` que o campo mostra à esquerda e que `siteUrl` soma ao salvar.
 *
 * O teto do campo desconta estes oito caracteres (2026-09-22, na varredura): o `clientLimits.website` vale
 * para o endereço já normalizado, que é o que o zod mede e o banco guarda, e o campo guarda o endereço nu.
 * Sem o desconto, o campo aceitava 120 caracteres e o salvamento devolvia "Endereço longo demais" num campo
 * que aparentava ainda ter folga.
 */
const SITE_PREFIX = "https://";

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
      <span className={styles.imageFrame} {...rounded("lg", { clip: true })}>
        {preview ? <StoredImage src={preview} alt="" fill sizes="3.5rem" className={styles.imagePreview} /> : fallback}
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
          if (file && file.size > SOURCE_MAX_BYTES) {
            onSelect(null, "A imagem passa de 25 MB. Escolha uma menor.");
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
// na hora; o envio do arquivo chega com o storage. Ativo e favorito ficam no menu do chevron duplo do topo.
export function ClientFormDialog({ editor, defaultKind = "customer", onClose, onSaved }: ClientFormDialogProps) {
  const mobile = useMediaQuery(MOBILE_QUERY);
  // O que está desenhado dentro da gaveta e em que abertura. `shown` segue o editor enquanto ele existe e
  // fica quando ele zera, para o conteúdo não sumir antes de a gaveta terminar de sair (a `Dialog` só
  // desmonta os filhos no fim da animação). `round` conta as aberturas e entra na chave do formulário, e
  // `last` é o editor do render anterior, que é como se sabe que a gaveta abriu de novo. Ajustado durante o
  // render, que é como o React pede para reagir a prop nova.
  //
  // A chave é o que faz o formulário nascer limpo (2026-09-22, na varredura): sem ela o React reaproveitava
  // a instância, porque o tipo e a posição na árvore são os mesmos, e o estado inicial não rodava de novo.
  // Fechar e, dentro da animação de saída, abrir a edição de outro contato trazia os valores do anterior e
  // salvava os dados de um na ficha do outro; reabrir "Novo cliente" trazia o texto já digitado.
  const [drawn, setDrawn] = useState<{ shown: ClientEditor; last: ClientEditor; round: number }>(() => ({ shown: editor, last: editor, round: 0 }));
  if (editor !== drawn.last) {
    setDrawn((previous) => ({
      shown: editor ?? previous.shown,
      last: editor,
      round: editor !== null && previous.last === null ? previous.round + 1 : previous.round,
    }));
  }
  const { shown, round } = drawn;

  return (
    // Sem escurecimento no desktop, como a gaveta de criar equipe: a página segue viva atrás. No celular
    // o escurecimento entra, senão o toque na barra flutuante, que fica acima da bandeja, fecharia a janela
    // como toque fora.
    <Dialog open={editor !== null} onClose={onClose} label={editor === "new" ? (defaultKind === "supplier" ? "Novo fornecedor" : "Novo cliente") : "Editar contato"} size="md" placement="end" surface="glass" scrim={mobile} focusOnOpen={false}>
      {shown === "new" && <ClientForm key={`${round}:novo`} defaultKind={defaultKind} onClose={onClose} onSaved={onSaved} />}
      {shown !== null && shown !== "new" && (isFull(shown) ? <ClientForm key={`${round}:${shown.id}`} client={shown} onClose={onClose} onSaved={onSaved} /> : <ClientLoader key={`${round}:${shown.id}`} item={shown} onClose={onClose} onSaved={onSaved} />)}
    </Dialog>
  );
}

/* Aberta a partir do cartão, a gaveta só sabe o que o cartão sabia: mostra o nome no topo e o giro no meio
   enquanto a ficha completa chega, e aí o formulário entra já preenchido. É o mesmo desenho da gaveta de
   ficha, e é o que dá resposta ao clique na hora. */
function ClientLoader({ item, onClose, onSaved }: { item: ClientListItem; onClose: () => void; onSaved: () => void }) {
  const { client, error: failed, retry } = useFullClient(item.id);

  if (client) return <ClientForm client={client} onClose={onClose} onSaved={onSaved} />;

  return (
    <div className={styles.dialog}>
      <DialogHeader title="Editar cliente" onClose={onClose} />
      <div className={styles.loading}>
        {/* A ficha que não vem tem recado e saída, e não um giro sem fim numa gaveta sem campo nenhum. */}
        {failed ? <ClientLoadFailure error={failed} onRetry={retry} /> : <Spinner size="md" label={`Carregando a ficha de ${item.name}`} />}
      </div>
    </div>
  );
}

/* O formulário nasce de novo a cada abertura e a cada troca de contato, porque a chave que a janela lhe dá
   muda nas duas: o estado começa limpo sem precisar zerar nada. */
function ClientForm({ client, defaultKind = "customer", onClose, onSaved }: { client?: Client; defaultKind?: ClientKind; onClose: () => void; onSaved: () => void }) {
  const { toast } = useToast();
  const [values, setValues] = useState<Values>(() => valuesOf(client, defaultKind));
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
  //
  // O **arquivo** fica guardado ao lado do endereço (2026-09-16, correção): até aqui só o `blob:` existia, e
  // ele vive apenas nesta aba, então salvar gravava o cliente e a imagem sumia no recarregamento seguinte.
  // Quem sobe é `uploadImage`, depois do salvamento, porque o caminho no Storage é a pasta do registro e o
  // registro só ganha id ali.
  const [photoUrl, setPhotoUrl] = useState<string | null>(client?.avatarUrl ?? null);
  const [logoUrl, setLogoUrl] = useState<string | null>(client?.companyLogoUrl ?? null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  useEffect(() => () => revokeLocal(photoUrl), [photoUrl]);
  useEffect(() => () => revokeLocal(logoUrl), [logoUrl]);

  const pickImage =
    (setUrl: (url: string | null) => void, setFile: (file: File | null) => void) =>
    (file: File | null, message?: string) => {
      if (message) {
        toast({ title: "Imagem grande demais", description: message, tone: "warning" });
        return;
      }
      setUrl(file ? URL.createObjectURL(file) : null);
      setFile(file);
    };

  const set = <K extends keyof Values>(key: K, value: Values[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    if (error?.field === key) setError(null);
  };

  /* Sobe o que foi escolhido e tira o que foi removido. Devolve a primeira mensagem de erro, ou nada quando
     tudo deu certo. */
  const saveImages = async (id: string) => {
    const jobs: Promise<{ ok: boolean; error?: string }>[] = [];

    if (photoFile) jobs.push(uploadImage("client-avatar", id, photoFile));
    else if (client?.avatarUrl && !photoUrl) jobs.push(removeImage("client-avatar", id));

    if (logoFile) jobs.push(uploadImage("client-logo", id, logoFile));
    else if (client?.companyLogoUrl && !logoUrl) jobs.push(removeImage("client-logo", id));

    const done = await Promise.all(jobs);
    return done.find((entry) => !entry.ok)?.error;
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const input: ClientFormInput = {
      id: client?.id,
      kind: values.kind,
      name: values.name,
      company: values.company,
      role: values.role,
      email: values.email.trim(),
      phone: values.phone,
      website: siteUrl(values.website),
      city: values.city,
      about: values.about,
      tags: values.tags,
      active: values.active,
      favorite: values.favorite,
    };

    const result = await callAction(saveClientAction(input));

    if (!result.ok) {
      setSaving(false);
      setError({ field: result.field, message: result.error });
      return;
    }

    /* As imagens vão depois do salvamento, e não junto: o arquivo mora numa pasta com o id do registro, e na
       criação esse id só existe agora. Falha de imagem não desfaz o cliente, que já está gravado; ela vira
       um aviso, porque o resto do trabalho não se perde por causa de uma foto.

       A guarda é o que tira o botão do "Salvando" (2026-09-22, na varredura): `removeImage` e o
       `attachUploadAction` de `uploadImage` não passam pelo teto de tempo da casa e rejeitam quando o
       transporte cai, e sem tratamento a rejeição deixava o giro para sempre, a gaveta aberta e a lista sem
       atualizar, com o contato já gravado no banco. */
    let images: string | undefined;
    try {
      images = await saveImages(result.id);
    } catch {
      images = "A imagem não foi enviada. Abra a ficha e tente de novo.";
    }
    setSaving(false);

    if (images) {
      toast({ title: `${values.kind === "supplier" ? "Fornecedor" : "Contato"} salvo, imagem não`, description: images, tone: "warning" });
      onSaved();
      return;
    }

    toast({
      title: editing ? "Contato atualizado" : values.kind === "supplier" ? "Fornecedor criado" : "Cliente criado",
      description: `${values.name.trim()} já está na base.`,
      tone: "success",
      feedback: {
        visual: (
          <Avatar
            name={values.name.trim()}
            src={photoUrl ?? logoUrl ?? undefined}
            seed={seed}
            size="lg"
            shape="rounded"
          />
        ),
        confetti: !editing,
      },
    });
    onSaved();
  };

  const errorOf = (field: keyof Values) => (error?.field === field ? error.message : undefined);
  const seed = values.email || values.name || "cliente";
  const companyInitial = values.company.trim().charAt(0).toUpperCase();

  return (
    <form ref={form} className={styles.dialog} onSubmit={submit} noValidate aria-labelledby={titleId}>
      <DialogHeader
        id={titleId}
        title={editing ? "Editar contato" : values.kind === "supplier" ? "Novo fornecedor" : "Novo cliente"}
        onClose={onClose}
        closeDisabled={saving}
        actions={
          /* Ativo e favorito são situação, e não dado da ficha: moram no menu de opções da própria
             janela, no chevron duplo das listas, como interruptores, para não tomar linha do formulário. */
          <DropdownMenu
            label="Situação do contato"
            triggerLabel="Situação do contato"
            sections={[
              {
                id: "flags",
                label: "Situação",
                items: [
                  { kind: "toggle", id: "active", label: "Contato ativo", icon: CheckCircleIcon, checked: values.active, onChange: (active) => set("active", active) },
                  { kind: "toggle", id: "favorite", label: "Favorito", icon: StarIcon, checked: values.favorite, onChange: (favorite) => set("favorite", favorite) },
                ],
              },
            ]}
          />
        }
      />

      <div className={styles.body}>
        <Section icon={IdentificationCardIcon} title="Identidade">
          <Field label="Relação com a empresa" required error={errorOf("kind")}>
            <Select<ClientKind>
              label="Tipo de contato"
              size="sm"
              value={values.kind}
              options={[
                { value: "customer", label: "Cliente", caption: "Compra produtos ou serviços" },
                { value: "supplier", label: "Fornecedor", caption: "Origina despesas e pagamentos" },
                { value: "both", label: "Cliente e fornecedor", caption: "Atua nos dois lados" },
              ]}
              disabled={saving}
              onChange={(kind) => set("kind", kind)}
            />
          </Field>
          <div className={styles.images}>
            <ImageField
              label="Foto"
              preview={photoUrl}
              fallback={<Avatar name={values.name || "Cliente"} seed={seed} size="lg" shape="rounded" className={styles.avatar} />}
              onSelect={pickImage(setPhotoUrl, setPhotoFile)}
            />
            <ImageField
              label="Logo"
              preview={logoUrl}
              fallback={
                <span className={styles.initial} aria-hidden="true">
                  {companyInitial || <BuildingsIcon />}
                </span>
              }
              onSelect={pickImage(setLogoUrl, setLogoFile)}
            />
          </div>
          <Field label="Nome" required error={errorOf("name")}>
            <Input type="text" name="name" value={values.name} maxLength={clientLimits.name} placeholder="Nome completo" autoComplete="name" required disabled={saving} onChange={(event) => set("name", event.target.value)} />
          </Field>
          <div className={styles.pair}>
            <Field label="Empresa" error={errorOf("company")}>
              <Input type="text" name="company" value={values.company} maxLength={clientLimits.company} placeholder="Onde trabalha" autoComplete="organization" disabled={saving} onChange={(event) => set("company", event.target.value)} />
            </Field>
            <Field label="Área" error={errorOf("role")}>
              <Input type="text" name="role" value={values.role} maxLength={clientLimits.role} placeholder="O que a empresa faz" disabled={saving} onChange={(event) => set("role", event.target.value)} />
            </Field>
          </div>
        </Section>

        <Separator className={styles.divider} />

        <Section icon={PhoneIcon} title="Contato">
          <div className={styles.pair}>
            <Field label="E-mail" error={errorOf("email")}>
              <Input type="email" name="email" value={values.email} maxLength={clientLimits.email} placeholder="pessoa@empresa.com.br" autoComplete="email" inputMode="email" disabled={saving} onChange={(event) => set("email", event.target.value)} />
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
                maxLength={clientLimits.website - SITE_PREFIX.length}
                placeholder="empresa.com.br"
                autoComplete="url"
                inputMode="url"
                spellCheck={false}
                disabled={saving}
                iconStart={<FieldAffix data-tone="muted">{SITE_PREFIX}</FieldAffix>}
                onChange={(event) => set("website", siteValue(event.target.value))}
              />
            </Field>
            <Field label="Cidade" error={errorOf("city")}>
              <Input type="text" name="city" value={values.city} maxLength={clientLimits.city} placeholder="São Paulo, SP" autoComplete="address-level2" disabled={saving} onChange={(event) => set("city", event.target.value)} />
            </Field>
          </div>
        </Section>

        <Separator className={styles.divider} />

        <Section icon={NotePencilIcon} title="Detalhes">
          <Field label="Anotações" error={errorOf("about")}>
            <Textarea name="about" value={values.about} rows={3} maxLength={clientLimits.about} placeholder="Como chegou, o que pediu, como prefere ser atendido" disabled={saving} onChange={(event) => set("about", event.target.value)} />
          </Field>
          <Field label="Etiquetas" error={errorOf("tags")}>
            <TagPicker catalog={clientTagCatalog} label="Etiquetas do cliente" value={values.tags} max={MAX_TAGS} disabled={saving} onChange={(tags) => set("tags", tags)} />
          </Field>
        </Section>

        {error && !error.field && (
          <Text variant="footnote" tone="danger" role="alert" className={styles.alert}>
            {error.message}
          </Text>
        )}
      </div>

      <DialogFooter>
        <Button variant="outline" size="sm" radius="md" disabled={saving} onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" size="sm" radius="md" iconStart={<CheckIcon />} loading={saving}>
          {saving ? "Salvando" : editing ? "Salvar" : "Criar cliente"}
        </Button>
      </DialogFooter>
    </form>
  );
}
