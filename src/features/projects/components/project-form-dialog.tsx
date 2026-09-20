"use client";

import { CalendarBlankIcon, CheckIcon, FolderSimpleIcon, GlobeSimpleIcon, PlusIcon, StackIcon, UploadSimpleIcon, XIcon, type Icon } from "@phosphor-icons/react";
import { format, parseISO } from "date-fns";
import Image from "next/image";
import { useEffect, useId, useRef, useState, type CSSProperties, type FormEvent, type ReactNode, type RefObject } from "react";
import { FloatingLayer, useFloatingActionsRegistration } from "@/components/layout/floating-actions";
import { useToast } from "@/components/providers/toast-provider";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Dialog } from "@/components/ui/dialog";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { Field } from "@/components/ui/field";
import { FieldAffix } from "@/components/ui/field-shell";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { TagPicker } from "@/components/ui/tag-picker";
import { Text } from "@/components/ui/text";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip } from "@/components/ui/tooltip";
import { VisuallyHidden } from "@/components/ui/visually-hidden";
import { MOBILE_QUERY, useMediaQuery } from "@/hooks/use-media-query";
import { callAction } from "@/lib/action";
import { squircle } from "@/lib/corners";
import { onlyDigits } from "@/lib/masks";
import { removeImage, uploadImage } from "@/features/uploads/upload";
import { ProjectMark } from "./project-mark";
import { saveProjectAction } from "../actions";
import { projectStatuses, projectTools } from "../labels";
import { projectArtworkUrl, projectHueFor } from "../list-options";
import { MAX_TAGS, projectLimits, projectStatusValues, projectToolValues, type ProjectFormInput } from "../schemas";
import type { Project, ProjectClient, ProjectOwnerOption, ProjectStatus, ProjectTool } from "../summary";
import { projectTagCatalog } from "../tags";
import { ToolTile } from "./tool-tile";
import styles from "./project-form-dialog.module.css";
import { siteUrl, siteValue } from "@/lib/utils/site";

/** O que a gaveta edita: um projeto da lista (que já é a ficha inteira) ou `"new"` para criar. Nulo fecha. */
export type ProjectEditor = Project | "new" | null;

export type ProjectFormDialogProps = {
  editor: ProjectEditor;
  /** Os clientes da casa, para o seletor de quem contratou. */
  clients: ProjectClient[];
  /** A equipe, para o seletor de quem responde. */
  owners: ProjectOwnerOption[];
  onClose: () => void;
  /** Depois de salvar com sucesso, com o id do projeto, além de fechar. */
  onSaved: (id: string) => void;
};

/** Teto da imagem escolhida, em bytes: 8 MB, folgado, porque ela é redimensionada aqui antes de subir. */
const IMAGE_MAX_BYTES = 8 * 1024 * 1024;

/** A capa sobe em 1440 por 810, o dobro do que a janela desenha: nítida em tela densa e leve no envio. */
const COVER_WIDTH = 1440;
const COVER_HEIGHT = 810;

const today = () => format(new Date(), "yyyy-MM-dd");
const toDate = (iso: string) => (iso ? parseISO(iso) : undefined);
const toIso = (date: Date | undefined) => (date ? format(date, "yyyy-MM-dd") : "");
const intOrNull = (value: string) => (value === "" ? null : Number(value));

const statusOptions = projectStatusValues.map((value) => ({ value, label: projectStatuses[value].label }));

/* As ferramentas em ordem de nome no seletor, e não na ordem do modelo, que agrupa por tipo: quem procura
   uma marca procura pelo nome, e o seletor tem busca. */
const toolValues = [...projectToolValues].sort((a, b) => projectTools[a].localeCompare(projectTools[b], "pt-BR"));

/* O formulário guarda texto cru (dinheiro e contagens em dígitos, como a máscara do campo pede, datas em ISO);
   a ficha guarda tipos. A conversão mora aqui, num lugar só. */
function valuesOf(project?: Project) {
  const digits = (value: number | null | undefined) => (value === null || value === undefined ? "" : String(value));
  return {
    name: project?.name ?? "",
    url: siteValue(project?.url ?? ""),
    description: project?.description ?? "",
    clientId: project?.client?.id ?? "",
    ownerId: project?.ownerId ?? "",
    status: project?.status ?? ("active" as ProjectStatus),
    isPublic: project?.isPublic ?? false,
    tags: project?.tags ?? [],
    tools: project?.tools ?? [],
    budgetMin: digits(project?.budget?.min),
    budgetMax: digits(project?.budget?.max),
    startedAt: project?.startedAt ?? today(),
    dueAt: project?.dueAt ?? "",
    progress: digits(project?.progress ?? 0),
    coverUrl: project?.coverUrl ?? "",
  };
}

export type ProjectFormValues = ReturnType<typeof valuesOf>;
type Values = ProjectFormValues;

/**
 * O que a prévia ao lado do editor recebe a cada tecla (2026-09-17): os valores como estão, as imagens que a
 * tela mostra (a escolhida agora ou a que já estava) e o cliente e o matiz resolvidos. É o bastante para
 * desenhar o cartão do projeto como ele vai aparecer na lista, sem a prévia saber de arquivo nenhum.
 */
export type ProjectPreviewSnapshot = {
  values: ProjectFormValues;
  cover: string | null;
  logo: string | null;
  client: ProjectClient | null;
  hue: Project["hue"];
};

export type ProjectFormProps = {
  project?: Project;
  clients: ProjectClient[];
  owners: ProjectOwnerOption[];
  onClose: () => void;
  onSaved: (id: string) => void;
  /**
   * Onde o formulário mora: na gaveta, com título, X e rodapé próprios; ou na tela do editor, que já tem a
   * barra de cima com salvar e sair, e aí o formulário entra só com os campos.
   */
  frame?: "drawer" | "screen";
  /** Na tela, quem dispara o envio é a barra de cima: ela pede `requestSubmit()` por aqui. */
  formRef?: RefObject<HTMLFormElement | null>;
  /** A prévia ao lado, avisada a cada mudança. */
  onPreview?: (snapshot: ProjectPreviewSnapshot) => void;
};

/* O valor do "sem cliente" na lista: o campo guarda texto vazio, e o seletor da casa não aceita vazio como
   escolha, porque vazio para ele é "nada escolhido". */
const NO_CLIENT = "sem-cliente";

/* A imagem decodificada já na orientação certa, pelo `createImageBitmap`, que lê a orientação do arquivo;
   onde ele não existe, o `<img>` cru resolve. */
async function loadSource(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if ("createImageBitmap" in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      /* cai para o <img> */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const image = document.createElement("img");
    image.src = url;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * A capa é redimensionada no navegador antes de subir: cabe em 1440 por 810 e sai em WebP (JPEG onde o
 * navegador não grava WebP), embutida em `data:`. É o que deixa uma foto de câmera caber no envio da action
 * e o que faz a imagem que a tela mostra ser a que fica guardada. Quando o armazenamento de arquivos nascer,
 * o mesmo redimensionar alimenta o envio para lá.
 */
async function readCover(file: File): Promise<File> {
  const source = await loadSource(file);
  const width = "naturalWidth" in source ? source.naturalWidth : source.width;
  const height = "naturalHeight" in source ? source.naturalHeight : source.height;
  const scale = Math.min(1, COVER_WIDTH / width, COVER_HEIGHT / height);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Sem canvas");
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  if ("close" in source) source.close();
  /* Um arquivo, e não mais um `data:` embutido (2026-09-16, correção): a capa embutida ia dentro da action
     e era gravada na coluna, que o banco limita a 500 caracteres, então uma capa de verdade nunca chegava a
     salvar. Agora ela sobe para o Storage e o que vai para a coluna é o endereço. O redimensionamento para
     1440 por 810 continua, e agora ele serve para o arquivo subir leve. */
  const blob = await new Promise<Blob | null>((done) => canvas.toBlob(done, "image/webp", 0.82));
  const ready = blob?.type === "image/webp" ? blob : await new Promise<Blob | null>((done) => canvas.toBlob(done, "image/jpeg", 0.85));
  if (!ready) throw new Error("Sem imagem");

  const extension = ready.type === "image/webp" ? "webp" : "jpg";
  return new File([ready], `capa.${extension}`, { type: ready.type });
}

/* Um bloco do formulário: o glifo e o título numa linha, e os campos embaixo. Quem separa um bloco do
   outro é o fio, de ponta a ponta, como na gaveta do cliente e do catálogo. */
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

// A ficha de projeto para criar e para editar (2026-09-13, a pedido de deixar o editar e o novo projeto
// funcionando), na gaveta lateral da casa, a mesma do cliente e do catálogo: 30rem na direita no desktop e
// bandeja no celular, com o título e o X grudados no topo, o formulário rolando no meio e Cancelar e Salvar
// fixos no rodapé. No celular o rodapé some e salvar e sair vão para a barra flutuante do menu. Três blocos
// separados por fio: o projeto (a capa anexada, nome, endereço, a descrição de até cem caracteres, cliente,
// quem responde, a situação e o interruptor de público), prazo e valor (começo, entrega, a faixa de valor e o
// andamento) e ferramentas e etiquetas (as marcas escolhidas num seletor com busca, cada uma com o azulejo da
// cor dela, e as etiquetas). O estado é local e o envio é a action, que valida com zod de novo no servidor;
// erro de campo volta para o campo, e sucesso avisa e devolve o id.
export function ProjectFormDialog({ editor, clients, owners, onClose, onSaved }: ProjectFormDialogProps) {
  const mobile = useMediaQuery(MOBILE_QUERY);
  // O que está desenhado dentro da gaveta: segue o editor enquanto ele existe e fica quando ele zera, para
  // o conteúdo não sumir antes de a gaveta terminar de sair. Ajustado durante o render, como o React pede.
  const [shown, setShown] = useState<ProjectEditor>(editor);
  if (editor !== null && editor !== shown) setShown(editor);

  return (
    <Dialog open={editor !== null} onClose={onClose} label={editor === "new" ? "Novo projeto" : "Editar projeto"} size="md" placement="end" surface="glass" scrim={mobile} focusOnOpen={false}>
      {/* A gaveta abre também por cima da janela do projeto, e as duas pendem ações na barra flutuante do
          celular: declarada uma camada acima, é ela que manda na barra enquanto estiver aberta, seja qual for
          a ordem em que as duas registram. */}
      <FloatingLayer>
        {shown === "new" && <ProjectForm clients={clients} owners={owners} onClose={onClose} onSaved={onSaved} />}
        {shown !== null && shown !== "new" && <ProjectForm project={shown} clients={clients} owners={owners} onClose={onClose} onSaved={onSaved} />}
      </FloatingLayer>
    </Dialog>
  );
}

/* O formulário nasce de novo a cada abertura, porque a janela só monta o conteúdo aberta: o estado começa
   limpo sem precisar zerar nada. */
export function ProjectForm({ project, clients, owners, onClose, onSaved, frame = "drawer", formRef, onPreview }: ProjectFormProps) {
  const { toast } = useToast();
  const [values, setValues] = useState<Values>(() => valuesOf(project));
  const [error, setError] = useState<{ field?: string; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [reading, setReading] = useState(false);
  /* A capa escolhida antes de subir: o arquivo, que vai para o Storage depois do salvamento, e a prévia
     local, que só existe nesta janela e é desfeita ao trocar ou ao fechar. */
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  /* A logo do projeto, pelo mesmo caminho da capa: o arquivo sobe depois de salvar, e a prévia é local. */
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoDropped, setLogoDropped] = useState(false);
  const logoInput = useRef<HTMLInputElement>(null);
  useEffect(() => () => {
    if (coverPreview) URL.revokeObjectURL(coverPreview);
  }, [coverPreview]);
  useEffect(() => () => {
    if (logoPreview) URL.revokeObjectURL(logoPreview);
  }, [logoPreview]);
  const editing = Boolean(project);
  const titleId = useId();
  const publicId = useId();
  const ownForm = useRef<HTMLFormElement>(null);
  const form = formRef ?? ownForm;
  const fileInput = useRef<HTMLInputElement>(null);

  // No celular salvar e sair moram na barra flutuante do menu, acima da bandeja, e o rodapé some. O disparo
  // é o mesmo envio do formulário, então a validação e a action valem igual.
  useFloatingActionsRegistration({
    primary: { label: saving ? "Salvando" : editing ? "Salvar" : "Criar", loading: saving, onClick: () => form.current?.requestSubmit() },
    cancel: { label: "Cancelar", onClick: onClose },
  });

  const set = <K extends keyof Values>(key: K, value: Values[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    if (error) setError(null);
  };

  const digitsOf = (key: keyof Values) => (event: { target: { value: string } }) => set(key, onlyDigits(event.target.value) as never);

  const pickCover = async (file: File) => {
    if (file.size > IMAGE_MAX_BYTES) {
      toast({ title: "Imagem grande demais", description: "A imagem passa de 8 MB. Escolha uma menor.", tone: "warning" });
      return;
    }
    setReading(true);
    try {
      const prepared = await readCover(file);
      setCoverFile(prepared);
      setCoverPreview(URL.createObjectURL(prepared));
      /* O valor do formulário guarda o endereço **salvo**, e não a prévia: é ele que vai para a action, e um
         `blob:` ali seria gravado como endereço morto. A prévia vive à parte, só nesta janela. */
      set("coverUrl", project?.coverUrl ?? "");
    } catch {
      toast({ title: "Não deu para ler a imagem", description: "Tente outra em PNG, JPG ou WebP.", tone: "warning" });
    } finally {
      setReading(false);
    }
  };

  const dropCover = () => {
    setCoverFile(null);
    setCoverPreview(null);
    set("coverUrl", "");
  };

  const pickLogo = (file: File) => {
    if (file.size > IMAGE_MAX_BYTES) {
      toast({ title: "Imagem grande demais", description: "A logo passa de 8 MB. Escolha uma menor.", tone: "warning" });
      return;
    }
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
    setLogoDropped(false);
  };

  const dropLogo = () => {
    setLogoFile(null);
    setLogoPreview(null);
    setLogoDropped(true);
  };

  /* Sobe a capa escolhida, ou tira a que havia. Devolve a mensagem de erro, ou nada quando deu certo. */
  const saveCover = async (id: string) => {
    if (coverFile) {
      const sent = await uploadImage("project-cover", id, coverFile);
      return sent.ok ? undefined : sent.error;
    }
    if (project?.coverUrl && !values.coverUrl) {
      const cleared = await removeImage("project-cover", id);
      return cleared.ok ? undefined : cleared.error;
    }
    return undefined;
  };

  /* Mesma regra da capa: sobe a escolhida, ou tira a que havia. */
  const saveLogo = async (id: string) => {
    if (logoFile) {
      const sent = await uploadImage("project-logo", id, logoFile);
      return sent.ok ? undefined : sent.error;
    }
    if (project?.logoUrl && logoDropped) {
      const cleared = await removeImage("project-logo", id);
      return cleared.ok ? undefined : cleared.error;
    }
    return undefined;
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const input: ProjectFormInput = {
      id: project?.id,
      name: values.name,
      url: siteUrl(values.url),
      description: values.description,
      clientId: values.clientId,
      ownerId: values.ownerId,
      status: values.status,
      isPublic: values.isPublic,
      tags: values.tags,
      tools: values.tools,
      budgetMin: intOrNull(values.budgetMin),
      budgetMax: intOrNull(values.budgetMax),
      startedAt: values.startedAt,
      dueAt: values.dueAt,
      progress: Number(values.progress || 0),
      coverUrl: values.coverUrl,
    };

    const result = await callAction(saveProjectAction(input));

    if (!result.ok) {
      setSaving(false);
      setError({ field: result.field, message: result.error });
      return;
    }

    /* A capa vai depois do salvamento, e não junto: o arquivo mora numa pasta com o id do projeto, e na
       criação esse id só existe agora. Falha de capa não desfaz o projeto, que já está gravado. */
    const [cover, logo] = await Promise.all([saveCover(result.id), saveLogo(result.id)]);
    setSaving(false);

    if (logo && !cover) {
      toast({ title: "Projeto salvo, logo não", description: logo, tone: "warning" });
      onSaved(result.id);
      return;
    }

    if (cover) {
      toast({ title: "Projeto salvo, capa não", description: cover, tone: "warning" });
      onSaved(result.id);
      return;
    }

    toast({
      title: editing ? "Projeto atualizado" : "Projeto criado",
      description: `${values.name.trim()} já está na lista.`,
      tone: "success",
    });
    onSaved(result.id);
  };

  const errorOf = (field: keyof Values) => (error?.field === field ? error.message : undefined);
  const known = error?.field !== undefined && error.field in values;
  /* O que a janela mostra: a prévia da escolha de agora, ou a capa que já estava guardada. */
  const shownCover = coverPreview ?? (values.coverUrl || null);
  const shownLogo = logoPreview ?? (logoDropped ? null : (project?.logoUrl ?? null));
  /* O cliente escolhido agora, para a prévia da marca já mostrar de quem ela vai ser emprestada. */
  const shownClient = clients.find((entry) => entry.id === values.clientId) ?? null;

  // A cor da arte sai do nome, e não de uma escolha: a prévia deriva pelo mesmo caminho do servidor, então o
  // que aparece enquanto se digita é o que fica gravado. Projeto que já tem matiz mantém o dele.
  const preview = { id: project?.id ?? "novo", name: values.name || "Projeto", hue: project?.hue ?? projectHueFor(values.name) };
  const hue = { "--project-hue": `var(--sys-${preview.hue})` } as CSSProperties;
  const busy = saving || reading;

  /* A prévia ao lado recebe o retrato a cada mudança. Efeito, e não chamada no render, porque avisar o pai
     durante o render dispararia o aviso de estado em cascata do React. */
  useEffect(() => {
    onPreview?.({ values, cover: shownCover, logo: shownLogo, client: shownClient, hue: preview.hue });
  }, [onPreview, values, shownCover, shownLogo, shownClient, preview.hue]);

  /* "Sem cliente" no topo da lista, e não um campo que se deixa em branco (2026-09-16, a pedido): projeto de
     estudo e projeto próprio existem, e escolher explicitamente é o que diz que o branco foi de propósito. */
  const clientOptions = [
    { value: NO_CLIENT, label: "Sem cliente", caption: "Projeto independente, de estudo ou próprio" },
    ...clients.map((client) => ({
      value: client.id,
      label: client.company ?? client.name,
      caption: client.company ? client.name : undefined,
      media: <Avatar name={client.name} src={client.avatarUrl ?? undefined} size="xs" shape="squircle" />,
    })),
  ];

  const ownerOptions = owners.map((owner) => ({
    value: owner.id,
    label: owner.name,
    caption: owner.role,
    media: <Avatar name={owner.name} src={owner.avatarUrl ?? undefined} size="xs" />,
  }));

  return (
    <form ref={form} className={styles.dialog} data-frame={frame} onSubmit={submit} noValidate aria-labelledby={titleId}>
      {/* Na tela do editor o título e o sair moram na barra de cima; o formulário entra só com os campos. */}
      {frame === "drawer" ? (
        <header className={styles.head}>
          <Text as="h2" id={titleId} variant="headline" weight="semibold" truncate>
            {editing ? "Editar projeto" : "Novo projeto"}
          </Text>
          <IconButton label="Fechar" variant="ghost" size="sm" disabled={saving} onClick={onClose}>
            <XIcon />
          </IconButton>
        </header>
      ) : (
        <VisuallyHidden>
          <h2 id={titleId}>{editing ? "Editar projeto" : "Novo projeto"}</h2>
        </VisuallyHidden>
      )}

      <div className={styles.body}>
        <Section icon={FolderSimpleIcon} title="O projeto">
          {/* A capa como vai aparecer no cartão, já no matiz do nome, com os botões só em glifo ao lado: sem
              imagem vale a arte gerada. A imagem é redimensionada aqui antes de subir. */}
          <div className={styles.artwork}>
            <div className={styles.cover} style={hue} {...squircle("md", { clip: true })}>
              {shownCover ? (
                <Image src={shownCover} alt="" fill sizes="9rem" unoptimized className={styles.photo} />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={projectArtworkUrl(preview)} alt="" width={64} height={64} decoding="async" className={styles.art} />
              )}
            </div>
            <div className={styles.artworkCopy}>
              <Text as="span" variant="footnote" weight="medium" truncate>
                Capa
              </Text>
              <Text as="span" variant="caption1" tone="secondary">
                PNG, JPG ou WebP. Sem imagem, entra a arte no matiz do projeto.
              </Text>
              <div className={styles.artworkActions}>
                <Tooltip content={shownCover ? "Trocar imagem" : "Enviar imagem"}>
                  <IconButton label={shownCover ? "Trocar imagem" : "Enviar imagem"} variant="outline" size="sm" radius="md" loading={reading} disabled={busy} onClick={() => fileInput.current?.click()}>
                    <UploadSimpleIcon />
                  </IconButton>
                </Tooltip>
                {shownCover && (
                  <Tooltip content="Remover imagem">
                    <IconButton label="Remover imagem" variant="ghost" size="sm" radius="md" disabled={busy} onClick={dropCover}>
                      <XIcon />
                    </IconButton>
                  </Tooltip>
                )}
              </div>
            </div>
            <input
              ref={fileInput}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className={styles.fileInput}
              aria-label="Enviar imagem da capa"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                event.target.value = "";
                if (file) void pickCover(file);
              }}
            />
          </div>

          {/* A logo do projeto, ao lado da capa: a capa é a faixa do cartão, e a logo é a marca quadrada que
              aparece toda vez que o projeto vira uma linha de lista. Sem ela, a tela usa a do cliente, e por
              isso o campo não é obrigatório nem pede nada de quem tem cliente cadastrado. */}
          <div className={styles.artwork}>
            <ProjectMark size="lg" project={{ id: preview.id, name: preview.name, hue: preview.hue, logoUrl: shownLogo, client: shownClient }} />
            <div className={styles.artworkCopy}>
              <Text as="span" variant="footnote" weight="medium" truncate>
                Logo
              </Text>
              <Text as="span" variant="caption1" tone="secondary">
                Sem logo própria, entra a do cliente; sem cliente, a arte do projeto.
              </Text>
              <div className={styles.artworkActions}>
                <Tooltip content={shownLogo ? "Trocar logo" : "Enviar logo"}>
                  <IconButton label={shownLogo ? "Trocar logo" : "Enviar logo"} variant="outline" size="sm" radius="md" disabled={busy} onClick={() => logoInput.current?.click()}>
                    <UploadSimpleIcon />
                  </IconButton>
                </Tooltip>
                {shownLogo && (
                  <Tooltip content="Remover logo">
                    <IconButton label="Remover logo" variant="ghost" size="sm" radius="md" disabled={busy} onClick={dropLogo}>
                      <XIcon />
                    </IconButton>
                  </Tooltip>
                )}
              </div>
            </div>
            <input
              ref={logoInput}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className={styles.fileInput}
              aria-label="Enviar a logo do projeto"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                event.target.value = "";
                if (file) pickLogo(file);
              }}
            />
          </div>

          <Field label="Nome" required hint="O nome do site ou de para quem o trabalho é feito" error={errorOf("name")}>
            <Input type="text" name="name" value={values.name} maxLength={projectLimits.name} placeholder="Estúdio Aurora" required disabled={saving} onChange={(event) => set("name", event.target.value)} />
          </Field>
          <Field label="Endereço do site" hint="Sem site fica em branco" error={errorOf("url")}>
            <Input type="text" name="url" inputMode="url" autoComplete="off" value={values.url} maxLength={projectLimits.url} placeholder="estudioaurora.com.br" disabled={saving} iconStart={<GlobeSimpleIcon />} onChange={(event) => set("url", siteValue(event.target.value))} />
          </Field>
          <Field label="Descrição" hint={`${values.description.length} de ${projectLimits.description} caracteres, a linha que o cartão mostra sob o nome`} error={errorOf("description")}>
            <Textarea name="description" value={values.description} rows={2} maxLength={projectLimits.description} placeholder="Site institucional com portfólio e formulário de contato" disabled={saving} onChange={(event) => set("description", event.target.value)} />
          </Field>
          <div className={styles.pair}>
            <Field label="Cliente" error={errorOf("clientId")}>
              <Select<string> label="Cliente do projeto" options={clientOptions} value={values.clientId || NO_CLIENT} placeholder="Escolha o cliente" searchable searchPlaceholder="Buscar cliente" emptyLabel="Nenhum cliente com esse nome" disabled={saving} onChange={(clientId) => set("clientId", clientId === NO_CLIENT ? "" : clientId)} />
            </Field>
            <Field label="Responsável" required error={errorOf("ownerId")}>
              <Select<string> label="Quem responde pelo projeto" options={ownerOptions} value={values.ownerId || undefined} placeholder="Escolha quem responde" searchable searchPlaceholder="Buscar na equipe" disabled={saving} onChange={(ownerId) => set("ownerId", ownerId)} />
            </Field>
          </div>
          <Field label="Situação" required error={errorOf("status")}>
            <Select<ProjectStatus> label="Situação do projeto" options={statusOptions} value={values.status} disabled={saving} onChange={(status) => set("status", status)} />
          </Field>

          {/* Público é escolha da pessoa, e não situação: mora no formulário, à vista, como interruptor. */}
          <label htmlFor={publicId} className={styles.toggle}>
            <span className={styles.toggleCopy}>
              <Text as="span" variant="subheadline" weight="medium">
                Projeto público
              </Text>
              <Text as="span" variant="footnote" tone="secondary">
                Aparece no portfólio público da equipe
              </Text>
            </span>
            <Switch id={publicId} size="sm" name="isPublic" checked={values.isPublic} disabled={saving} onChange={(event) => set("isPublic", event.target.checked)} />
          </label>
        </Section>

        <Separator className={styles.divider} />

        <Section icon={CalendarBlankIcon} title="Prazo e valor">
          <div className={styles.pair}>
            <Field label="Começo" required error={errorOf("startedAt")}>
              <DatePicker value={toDate(values.startedAt)} disabled={saving} onChange={(date) => set("startedAt", toIso(date))} />
            </Field>
            <Field label="Entrega" hint="Em branco fica sem prazo" error={errorOf("dueAt")}>
              <DatePicker value={toDate(values.dueAt)} min={toDate(values.startedAt)} disabled={saving} onChange={(date) => set("dueAt", toIso(date))} />
            </Field>
          </div>
          <div className={styles.pair}>
            <Field label="Valor mínimo" hint="Tudo em branco é a combinar" error={errorOf("budgetMin")}>
              <Input type="text" name="budgetMin" mask="currency" value={values.budgetMin} placeholder="0,00" disabled={saving} onChange={digitsOf("budgetMin")} />
            </Field>
            <Field label="Valor máximo" hint="Igual ao mínimo é valor fechado" error={errorOf("budgetMax")}>
              <Input type="text" name="budgetMax" mask="currency" value={values.budgetMax} placeholder="0,00" disabled={saving} onChange={digitsOf("budgetMax")} />
            </Field>
          </div>
          <Field label="Andamento" hint="De 0 a 100" error={errorOf("progress")}>
            <Input type="text" name="progress" mask="integer" value={values.progress} placeholder="0" inputMode="numeric" maxLength={3} disabled={saving} iconEnd={<FieldAffix data-tone="muted">%</FieldAffix>} onChange={digitsOf("progress")} />
          </Field>
        </Section>

        <Separator className={styles.divider} />

        <Section icon={StackIcon} title="Ferramentas e etiquetas">
          <Field label="Ferramentas" hint="As marcas que o cartão mostra, na ordem em que entram" error={errorOf("tools")}>
            <ToolPicker value={values.tools} disabled={saving} onChange={(tools) => set("tools", tools)} />
          </Field>
          <Field label="Etiquetas" hint={`O que foi feito, escolhido na lista. Até ${MAX_TAGS}`} error={errorOf("tags")}>
            <TagPicker catalog={projectTagCatalog} label="Etiquetas do projeto" value={values.tags} max={MAX_TAGS} disabled={saving} onChange={(tags) => set("tags", tags)} />
          </Field>
        </Section>

        {error && !known && (
          <Text variant="footnote" tone="danger" role="alert" className={styles.alert}>
            {error.message}
          </Text>
        )}
      </div>

      {frame === "drawer" && (
        <footer className={styles.foot}>
          <Button variant="outline" size="sm" radius="md" disabled={saving} onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" size="sm" radius="md" iconStart={<CheckIcon />} loading={saving} disabled={reading}>
            {saving ? "Salvando" : editing ? "Salvar" : "Criar projeto"}
          </Button>
        </footer>
      )}
    </form>
  );
}

/* As ferramentas escolhidas, cada uma numa ficha com o azulejo da marca, o nome e o × para tirar, e no fim o
   botão de somar, só em glifo, que abre o leque com busca: todas as marcas da casa em interruptores, com a
   azulejo da cor de cada uma na frente, para escolher pelo desenho e não só pelo nome. A ordem é a de entrada,
   que é a que o cartão mostra. */
function ToolPicker({ id, value, disabled, onChange }: { id?: string; value: ProjectTool[]; disabled?: boolean; onChange: (tools: ProjectTool[]) => void }) {
  const toggle = (tool: ProjectTool, checked: boolean) => onChange(checked ? [...value, tool] : value.filter((entry) => entry !== tool));

  return (
    <div id={id} className={styles.picker}>
      {value.map((tool) => (
        <span key={tool} className={styles.chip} {...squircle("md")}>
          <ToolTile tool={tool} />
          <Text as="span" variant="footnote" weight="medium" truncate>
            {projectTools[tool]}
          </Text>
          <button type="button" className={styles.chipRemove} aria-label={`Remover ${projectTools[tool]}`} disabled={disabled} onClick={() => toggle(tool, false)}>
            <XIcon weight="bold" />
          </button>
        </span>
      ))}
      <DropdownMenu
        label="Ferramentas do projeto"
        triggerLabel={value.length === 0 ? "Escolher ferramentas" : "Adicionar ferramentas"}
        icon={<PlusIcon />}
        trigger={{ variant: "outline", radius: "md" }}
        sections={[
          {
            id: "tools",
            label: "Ferramentas",
            items: toolValues.map((tool) => ({
              kind: "toggle" as const,
              id: tool,
              label: projectTools[tool],
              media: <ToolTile tool={tool} className={styles.menuTile} />,
              checked: value.includes(tool),
              onChange: (checked: boolean) => toggle(tool, checked),
            })),
          },
        ]}
      />
      {value.length === 0 && (
        <Text as="span" variant="footnote" tone="secondary">
          Nenhuma ainda
        </Text>
      )}
    </div>
  );
}
