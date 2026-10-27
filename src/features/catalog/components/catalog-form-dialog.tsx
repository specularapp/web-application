"use client";

import { ArrowsClockwiseIcon, CheckCircleIcon, CheckIcon, CoinsIcon, PackageIcon, PercentIcon, ShieldCheckIcon, TagIcon, TimerIcon, TrendUpIcon, UploadSimpleIcon, XIcon, type Icon } from "@phosphor-icons/react";
import { useEffect, useId, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { useFloatingActionsRegistration } from "@/components/layout/floating-actions";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { Field } from "@/components/ui/field";
import { FieldAffix } from "@/components/ui/field-shell";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { TagInput } from "@/components/ui/tag-input";
import { TagPicker } from "@/components/ui/tag-picker";
import { Text } from "@/components/ui/text";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/providers/toast-provider";
import { SOURCE_MAX_BYTES } from "@/lib/images/compress";
import { callAction } from "@/lib/action";
import { onlyDigits } from "@/lib/masks";
import { formatMoney } from "@/lib/utils/format";
import { removeImage, uploadImage } from "@/features/uploads/upload";
import { saveCatalogItemAction } from "../actions";
import { catalogTagCatalog } from "../tags";
import { catalogHueFor, kindLabels, kindTones, unitLabels } from "../list-options";
import { catalogKinds, catalogLimits, catalogUnits, MAX_LIST_ITEMS, MAX_TAGS, type CatalogFormInput } from "../schemas";
import type { CatalogItem, CatalogKind, CatalogUnit } from "../summary";
import { CatalogArtwork } from "./catalog-artwork";
import { formWindow as styles, FormWindowBlock, FormWindowPart as Part, FormWindowRows, FormWindowTabs } from "@/components/ui/form-window";

/** O que a janela edita: um item da lista (que já é a ficha inteira) ou `"new"` para criar. Nulo fecha. */
export type CatalogEditor = CatalogItem | "new" | null;

export type CatalogFormDialogProps = {
  editor: CatalogEditor;
  /** As categorias que já existem na base, para sugerir enquanto a pessoa digita. */
  categories: string[];
  onClose: () => void;
  /** Depois de salvar com sucesso, além de fechar. */
  onSaved: () => void;
};

const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

const kindOptions = catalogKinds.map((value) => ({ value, label: kindLabels[value] }));
const unitOptions = catalogUnits.map((value) => ({ value, label: capitalize(unitLabels[value]) }));

/* O formulário guarda texto cru (dinheiro e contagens em dígitos, como a máscara do campo pede); a ficha
   guarda tipos. A conversão mora aqui, num lugar só. */
function valuesOf(item?: CatalogItem) {
  const digits = (value: number | null | undefined) => (value === null || value === undefined ? "" : String(value));
  return {
    kind: item?.kind ?? ("service" as CatalogKind),
    name: item?.name ?? "",
    description: item?.description ?? "",
    category: item?.category ?? "",
    price: digits(item?.price),
    unit: item?.unit ?? ("project" as CatalogUnit),
    cost: digits(item?.cost),
    maxDiscount: digits(item?.maxDiscount ?? 10),
    supportDays: digits(item?.supportDays),
    durationMin: digits(item?.duration?.min),
    durationMax: digits(item?.duration?.max),
    revisions: digits(item?.revisions),
    stockQuantity: digits(item?.stock?.quantity),
    stockCapacity: digits(item?.stock?.capacity),
    stockMinimum: digits(item?.stock?.minimum),
    deliverables: item?.deliverables ?? [],
    requirements: item?.requirements ?? [],
    tags: item?.tags ?? [],
    notes: item?.notes ?? "",
    active: item?.active ?? true,
  };
}

type Values = ReturnType<typeof valuesOf>;

const intOrNull = (value: string) => (value === "" ? null : Number(value));

/* Só o que foi criado aqui é desfeito: o endereço que veio da ficha é de fora. */
function revokeLocal(url: string | null) {
  if (url?.startsWith("blob:")) URL.revokeObjectURL(url);
}

/* As duas abas do formulário, na pasta da Le Ange (2026-10-26, a pedido: "coloque em 2 abas igual tem na le
   ange"): o item, com a imagem, quem é e a descrição; e o preço e o escopo, com o que o orçamento leva. */
type Step = "item" | "terms";
const steps: { value: Step; label: string; icon: Icon }[] = [
  { value: "item", label: "Item", icon: TagIcon },
  { value: "terms", label: "Preço e escopo", icon: CoinsIcon },
];

/* Os campos da primeira aba: um erro do servidor num deles leva a pessoa para lá; o resto mora na segunda. */
const itemFields = new Set(["kind", "name", "category", "description", "tags"]);

/** Quantas entregas a prévia lista antes de resumir o resto em "e mais N". */
const PREVIEW_DELIVERABLES = 4;

const durationText = (min: string, max: string) => (min === "" ? "A combinar" : max === "" || max === min ? `${min} dias` : `${min} a ${max} dias`);

type PreviewDraft = {
  name: string;
  description: string;
  category: string;
  kind: CatalogKind;
  unit: CatalogUnit;
  price: number;
  cost: number | null;
  /** O desconto máximo sem aprovação, em pontos percentuais: dá o menor preço que o orçamento pode sair. */
  maxDiscount: number;
  active: boolean;
  art: { id: string; name: string; imageUrl: string | null; hue: CatalogItem["hue"] };
  facts: { icon: Icon; label: string; value: string }[];
  deliverables: string[];
};

/**
 * A prévia do item ao lado do formulário (2026-10-26, a pedido: "deixe a prévia melhor, não precisa ser
 * literalmente o card", e depois "um container só, sem coisa em cima de outra"): a ficha de uma olhada, como
 * a pessoa vai ler o item ao montar o orçamento, direto no cartão da direita, em blocos separados por fio e no
 * mesmo recuo. A capa; o item com o preço e a margem; os números; as condições nas mesmas linhas de rótulo e
 * valor; o que a entrega inclui; e a linha que o item vira no orçamento. Tudo sai do rascunho.
 */
function CatalogPreview({ draft }: { draft: PreviewDraft }) {
  const margin = draft.cost !== null && draft.price > 0 ? Math.round(((draft.price - draft.cost) / draft.price) * 100) : null;
  const extra = draft.deliverables.length - PREVIEW_DELIVERABLES;
  /* Os números de venda, o que a ficha agrega ao preço: o custo, quanto sobra por venda e o menor preço que
     sai sem aprovação, com a margem que ainda fica; a margem cheia vai ao lado do preço, na cor da saúde. */
  const floor = Math.round(draft.price * (1 - draft.maxDiscount / 100));
  const profit = draft.cost === null ? null : draft.price - draft.cost;
  const floorMargin = draft.cost !== null && floor > 0 ? Math.round(((floor - draft.cost) / floor) * 100) : null;
  const marginTone: BadgeTone = margin === null ? "neutral" : margin >= 40 ? "success" : margin >= 20 ? "warning" : "danger";
  const numbers = [
    { label: "Custo", value: draft.cost === null ? "Não medido" : formatMoney(draft.cost) },
    { label: "Lucro por venda", value: profit === null ? "Sem custo" : formatMoney(profit) },
    { label: "Preço mínimo", value: `${formatMoney(floor)}${floorMargin !== null ? ` (${floorMargin}%)` : ""}`, title: `Com o desconto máximo de ${draft.maxDiscount}%` },
  ];
  const unitOne = draft.unit === "hour" ? "1 hora" : draft.unit === "month" ? "1 mês" : draft.unit === "unit" ? "1 unidade" : "1 projeto";

  return (
    <>
      <div className={styles.cover} style={{ "--cover-hue": `var(--sys-${draft.art.hue})` } as CSSProperties}>
        {draft.art.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- a imagem escolhida ainda é local (blob:)
          <img src={draft.art.imageUrl} alt="" className={styles.coverPhoto} />
        ) : (
          <CatalogArtwork item={draft.art} size="lg" />
        )}
      </div>

      {/* Quem é e quanto custa: as etiquetas, o nome, a categoria e a descrição, e o preço com a margem. */}
      <section className={styles.block} aria-label="O item">
        <span className={styles.sheetBadges}>
          <Badge tone={kindTones[draft.kind]} size="sm">
            {kindLabels[draft.kind]}
          </Badge>
          <Badge tone={draft.active ? "success" : "neutral"} size="sm">
            {draft.active ? "Ativo" : "Inativo"}
          </Badge>
        </span>
        <div className={styles.sheetNaming}>
          <Text as="h3" variant="headline" weight="semibold" className={styles.sheetName}>
            {draft.name}
          </Text>
          <Text as="span" variant="caption1" tone="secondary" truncate>
            {draft.category}
          </Text>
        </div>
        <Text as="p" variant="footnote" tone="secondary" className={styles.sheetDescription}>
          {draft.description}
        </Text>
        <div className={styles.amountRow}>
          <span className={styles.amount}>
            <Text as="span" variant="title3" weight="semibold">
              {formatMoney(draft.price)}
            </Text>
            <Text as="span" variant="caption1" tone="secondary">
              {unitLabels[draft.unit]}
            </Text>
          </span>
          {margin !== null && (
            <Badge tone={marginTone} size="sm" title="Margem sobre o preço">
              {margin}% de margem
            </Badge>
          )}
        </div>
      </section>

      <FormWindowBlock title="Números">
        <FormWindowRows rows={numbers} />
      </FormWindowBlock>

      <FormWindowBlock title="Condições">
        <FormWindowRows rows={draft.facts} />
      </FormWindowBlock>

      {draft.deliverables.length > 0 && (
        <FormWindowBlock title="A entrega inclui">
          <ul className={styles.sheetList}>
            {draft.deliverables.slice(0, PREVIEW_DELIVERABLES).map((entry) => (
              <li key={entry}>
                <CheckIcon aria-hidden="true" weight="bold" />
                <span>{entry}</span>
              </li>
            ))}
            {extra > 0 && <li className={styles.sheetMore}>e mais {extra}</li>}
          </ul>
        </FormWindowBlock>
      )}

      {/* A linha que o item vira no orçamento: é onde ele mais aparece, então a prévia fecha com ela. */}
      <FormWindowBlock title="No orçamento">
        <div className={styles.previewLine}>
          <CatalogArtwork item={draft.art} size="xs" />
          <span className={styles.previewLineName}>
            <Text as="span" variant="footnote" weight="medium" truncate>
              {draft.name}
            </Text>
            <Text as="span" variant="caption2" tone="tertiary" truncate>
              {unitOne}
            </Text>
          </span>
          <Text as="span" variant="footnote" weight="semibold">
            {formatMoney(draft.price)}
          </Text>
        </div>
      </FormWindowBlock>
    </>
  );
}


// A ficha de produto ou serviço para criar e para editar (2026-10-26, refeita a pedido: "uma prévia do lado e
// os campos em 2 abas igual tem na le ange"), na janela dupla da ficha do prato da Le Ange: dois cartões
// soltos na janela grande. À esquerda o formulário, com o título, o X e a situação no topo, as abas de pasta
// (o item; o preço e o escopo), as seções numeradas e Cancelar e Salvar no rodapé; à direita a prévia ao vivo
// do cartão do catálogo, que muda enquanto se digita. Abaixo de 64rem a prévia sai e fica só o formulário, e
// no celular ele é a bandeja da casa. No celular o rodapé some e salvar e sair vão para a
// barra flutuante do menu. Três blocos separados por fio: o item (tipo, nome, categoria, descrição, a arte
// com a cor e a imagem), preço e condições (o que a ficha mostra na grade 2×, com prazo e revisões só em
// serviço e estoque só em produto) e escopo (o que a entrega inclui, o que se pede ao cliente, etiquetas e
// anotações). O estado é local e o envio é a action, que valida com zod de novo no servidor; erro de campo
// volta para o campo, e sucesso avisa e fecha. Ativo fica no menu do chevron duplo do topo, como no cliente.
export function CatalogFormDialog({ editor, categories, onClose, onSaved }: CatalogFormDialogProps) {
  // O que está desenhado dentro da janela: segue o editor enquanto ele existe e fica quando ele zera, para
  // o conteúdo não sumir antes de a janela terminar de sair. Ajustado durante o render, como o React pede.
  const [shown, setShown] = useState<CatalogEditor>(editor);
  if (editor !== null && editor !== shown) setShown(editor);

  return (
    <Dialog open={editor !== null} onClose={onClose} label={editor === "new" ? "Novo item" : "Editar item"} size="xl" surface="solid" focusOnOpen={false} className={styles.window}>
      {shown === "new" && <CatalogForm categories={categories} onClose={onClose} onSaved={onSaved} />}
      {shown !== null && shown !== "new" && <CatalogForm item={shown} categories={categories} onClose={onClose} onSaved={onSaved} />}
    </Dialog>
  );
}

/* O formulário nasce de novo a cada abertura, porque a janela só monta o conteúdo aberta: o estado começa
   limpo sem precisar zerar nada. */
function CatalogForm({ item, categories, onClose, onSaved }: { item?: CatalogItem; categories: string[]; onClose: () => void; onSaved: () => void }) {
  const { toast } = useToast();
  const [values, setValues] = useState<Values>(() => valuesOf(item));
  const [error, setError] = useState<{ field?: string; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<Step>("item");
  const editing = Boolean(item);
  const titleId = useId();
  const categoriesId = useId();
  const form = useRef<HTMLFormElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  // No celular salvar e sair moram na barra flutuante do menu, acima da bandeja, e o rodapé some. O disparo
  // é o mesmo envio do formulário, então a validação e a action valem igual.
  useFloatingActionsRegistration({
    primary: { label: saving ? "Salvando" : editing ? "Salvar" : "Criar", loading: saving, onClick: () => form.current?.requestSubmit() },
    cancel: { label: "Cancelar", onClick: onClose },
  });

  // O endereço local da imagem escolhida é desfeito quando outro o substitui ou a janela fecha.
  //
  // O **arquivo** fica guardado ao lado do endereço (2026-09-16, correção): até aqui só o `blob:` existia, e
  // ele vive apenas nesta aba, então salvar gravava o item e a imagem sumia no recarregamento seguinte. Quem
  // sobe é `uploadImage`, depois do salvamento, porque o caminho no Storage é a pasta do registro.
  const [imageUrl, setImageUrl] = useState<string | null>(item?.imageUrl ?? null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  useEffect(() => () => revokeLocal(imageUrl), [imageUrl]);

  const pickImage = (file: File | null) => {
    if (file && file.size > SOURCE_MAX_BYTES) {
      toast({ title: "Imagem grande demais", description: "A imagem passa de 25 MB. Escolha uma menor.", tone: "warning" });
      return;
    }
    setImageUrl(file ? URL.createObjectURL(file) : null);
    setImageFile(file);
  };

  /* Sobe a imagem escolhida, ou tira a que havia. Devolve a mensagem de erro, ou nada quando deu certo. */
  const saveImage = async (id: string) => {
    if (imageFile) {
      const sent = await uploadImage("catalog-image", id, imageFile);
      return sent.ok ? undefined : sent.error;
    }
    if (item?.imageUrl && !imageUrl) {
      const cleared = await removeImage("catalog-image", id);
      return cleared.ok ? undefined : cleared.error;
    }
    return undefined;
  };

  const set = <K extends keyof Values>(key: K, value: Values[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    if (error) setError(null);
  };

  const digitsOf = (key: keyof Values) => (event: { target: { value: string } }) => set(key, onlyDigits(event.target.value) as never);

  const service = values.kind === "service";
  const hasStock = values.stockQuantity !== "" || values.stockCapacity !== "" || values.stockMinimum !== "";

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const input: CatalogFormInput = {
      id: item?.id,
      kind: values.kind,
      name: values.name,
      description: values.description,
      category: values.category,
      price: Number(values.price || 0),
      unit: values.unit,
      cost: intOrNull(values.cost),
      maxDiscount: Number(values.maxDiscount || 0),
      supportDays: intOrNull(values.supportDays),
      duration: service && (values.durationMin !== "" || values.durationMax !== "") ? { min: Number(values.durationMin || 0), max: Number(values.durationMax || values.durationMin || 0) } : null,
      revisions: service ? intOrNull(values.revisions) : null,
      stock: !service && hasStock ? { quantity: Number(values.stockQuantity || 0), capacity: Number(values.stockCapacity || 0), minimum: Number(values.stockMinimum || 0) } : null,
      deliverables: values.deliverables,
      requirements: values.requirements,
      tags: values.tags,
      notes: values.notes,
      active: values.active,
    };

    const result = await callAction(saveCatalogItemAction(input));

    if (!result.ok) {
      setSaving(false);
      setError({ field: result.field, message: result.error });
      /* O erro de campo abre a aba onde o campo mora, para a pessoa ver o que corrigir. */
      if (result.field) setStep(itemFields.has(result.field) ? "item" : "terms");
      return;
    }

    /* A imagem vai depois do salvamento, e não junto: o arquivo mora numa pasta com o id do registro, e na
       criação esse id só existe agora. Falha de imagem não desfaz o item, que já está gravado. */
    const image = await saveImage(result.id);
    setSaving(false);

    if (image) {
      toast({ title: "Item salvo, imagem não", description: image, tone: "warning" });
      onSaved();
      return;
    }

    toast({
      title: editing ? "Item atualizado" : values.kind === "product" ? "Produto criado" : "Serviço criado",
      description: `${values.name.trim()} já está no catálogo.`,
      tone: "success",
    });
    onSaved();
  };

  /* O erro chega pelo caminho do campo na ficha ("stock.quantity"); aqui cada campo tem o próprio nome. */
  const fieldPaths: Record<string, string> = {
    "duration.min": "durationMin",
    "duration.max": "durationMax",
    "stock.quantity": "stockQuantity",
    "stock.capacity": "stockCapacity",
    "stock.minimum": "stockMinimum",
  };
  const errorField = error?.field ? (fieldPaths[error.field] ?? error.field) : undefined;
  const errorOf = (field: keyof Values) => (errorField === field ? error?.message : undefined);
  const known = errorField !== undefined && errorField in values;

  // A cor da arte sai do nome, e não de uma escolha: a prévia deriva pelo mesmo caminho do servidor, então
  // o que aparece enquanto se digita é o que fica gravado. Item que já tem matiz mantém o dele.
  const preview = { id: item?.id ?? "novo", name: values.name || "Item", imageUrl, hue: item?.hue ?? catalogHueFor(values.name) };

  /* A ficha da prévia, vestida com o rascunho: o que a pessoa digita aparece nela na hora. Serviço mostra
     prazo, revisões e garantia; produto mostra o estoque, o aviso e a garantia; os dois mostram o desconto
     máximo, e os números de venda saem do preço, do custo e do desconto. */
  const days = (value: string) => (value === "" ? "Não informada" : `${value} dias`);
  const previewDraft: PreviewDraft = {
    name: values.name.trim() || (service ? "Nome do serviço" : "Nome do produto"),
    description: values.description.trim() || "A descrição aparece aqui, em uma ou duas frases sobre o que é e o que a pessoa leva.",
    category: values.category.trim() || "Categoria",
    kind: values.kind,
    unit: values.unit,
    price: Number(values.price || 0),
    cost: intOrNull(values.cost),
    maxDiscount: Number(values.maxDiscount || 0),
    active: values.active,
    art: preview,
    facts: service
      ? [
          { icon: TimerIcon, label: "Prazo", value: durationText(values.durationMin, values.durationMax) },
          { icon: ArrowsClockwiseIcon, label: "Revisões", value: values.revisions === "" ? "A combinar" : `${values.revisions} rodadas` },
          { icon: ShieldCheckIcon, label: "Garantia", value: days(values.supportDays) },
          { icon: PercentIcon, label: "Desconto", value: `até ${values.maxDiscount || 0}%` },
        ]
      : [
          { icon: PackageIcon, label: "Estoque", value: hasStock ? `${values.stockQuantity || 0} de ${values.stockCapacity || 0}` : "Sob demanda" },
          { icon: TrendUpIcon, label: "Avisar abaixo", value: values.stockMinimum === "" ? "Sem aviso" : `${values.stockMinimum} un.` },
          { icon: ShieldCheckIcon, label: "Garantia", value: days(values.supportDays) },
          { icon: PercentIcon, label: "Desconto", value: `até ${values.maxDiscount || 0}%` },
        ],
    deliverables: values.deliverables,
  };

  return (
    <>
      <form ref={form} className={styles.formCard} onSubmit={submit} noValidate aria-labelledby={titleId}>
        {/* O cabeçalho escuro da ficha da oportunidade (2026-10-26, a pedido: "o bg igual temos quando abre uma
            oportunidade, senão fica preto no preto"): o título, a situação e o X, e as abas de pasta emendando
            no corpo. */}
        <div className={styles.head}>
          <header className={styles.cardHead}>
            <Text as="h2" id={titleId} variant="callout" weight="semibold" truncate className={styles.cardTitle}>
              {editing ? "Editar item" : "Novo item"}
            </Text>
            {/* Ativo é situação, e não dado da ficha: mora no menu de opções da própria janela, no chevron duplo
                das listas, como interruptor, para não tomar linha do formulário. */}
            <DropdownMenu
              label="Situação do item"
              triggerLabel="Situação do item"
              sections={[
                {
                  id: "flags",
                  label: "Situação",
                  items: [{ kind: "toggle", id: "active", label: "Item ativo", icon: CheckCircleIcon, checked: values.active, onChange: (active) => set("active", active) }],
                },
              ]}
            />
            <IconButton label="Fechar" variant="ghost" size="sm" disabled={saving} onClick={onClose}>
              <XIcon />
            </IconButton>
          </header>

          <FormWindowTabs label="Partes do item" steps={steps} value={step} onChange={setStep} />
        </div>

        <div className={styles.body}>
          {step === "item" ? (
            <>
              <Part number={1} title="Imagem" hint="Foto ou capa">
                <div className={styles.media}>
                  <CatalogArtwork item={preview} size="lg" />
                  <div className={styles.mediaActions}>
                    <Button variant="outline" size="sm" radius="md" iconStart={<UploadSimpleIcon />} disabled={saving} onClick={() => fileInput.current?.click()}>
                      {imageUrl ? "Trocar imagem" : "Enviar imagem"}
                    </Button>
                    {imageUrl && (
                      <IconButton label="Remover imagem" variant="ghost" size="sm" radius="md" disabled={saving} onClick={() => pickImage(null)}>
                        <XIcon />
                      </IconButton>
                    )}
                  </div>
                  <input
                    ref={fileInput}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className={styles.fileInput}
                    aria-label="Enviar imagem do item"
                    onChange={(event) => {
                      const file = event.target.files?.[0] ?? null;
                      event.target.value = "";
                      pickImage(file);
                    }}
                  />
                </div>
              </Part>

              <Part number={2} title="Identificação" hint="Tipo, família e nome">
                <div className={styles.pair}>
                  <Field label="Tipo" required>
                    <Select<CatalogKind> label="Tipo do item" options={kindOptions} value={values.kind} disabled={saving} onChange={(kind) => set("kind", kind)} />
                  </Field>
                  <Field label="Categoria" required error={errorOf("category")}>
                    <Input type="text" name="category" list={categoriesId} value={values.category} maxLength={catalogLimits.category} placeholder="Aplicação web, Marketing" autoComplete="off" disabled={saving} onChange={(event) => set("category", event.target.value)} />
                  </Field>
                </div>
                <datalist id={categoriesId}>
                  {categories.map((category) => (
                    <option key={category} value={category} />
                  ))}
                </datalist>
                <Field label="Nome" required error={errorOf("name")}>
                  <Input type="text" name="name" value={values.name} maxLength={catalogLimits.name} placeholder={service ? "Landing page" : "Certificado SSL"} required disabled={saving} onChange={(event) => set("name", event.target.value)} />
                </Field>
              </Part>

              <Part number={3} title="Descrição" hint="Até duas linhas">
                <Field label="Descrição" required error={errorOf("description")}>
                  <Textarea name="description" value={values.description} rows={3} maxLength={catalogLimits.description} placeholder="O que é e o que a pessoa leva" disabled={saving} onChange={(event) => set("description", event.target.value)} />
                </Field>
                <Field label="Etiquetas" error={errorOf("tags")}>
                  <TagPicker catalog={catalogTagCatalog} label="Etiquetas do item" value={values.tags} max={MAX_TAGS} disabled={saving} onChange={(tags) => set("tags", tags)} />
                </Field>
              </Part>
            </>
          ) : (
            <>
              <Part number={1} title="Preço" hint="Valor, custo e desconto">
                <div className={styles.pair}>
                  <Field label="Preço" required error={errorOf("price")}>
                    <Input type="text" name="price" mask="currency" value={values.price} placeholder="0,00" disabled={saving} onChange={digitsOf("price")} />
                  </Field>
                  <Field label="Cobrança" required>
                    <Select<CatalogUnit> label="Como o preço é cobrado" options={unitOptions} value={values.unit} disabled={saving} onChange={(unit) => set("unit", unit)} />
                  </Field>
                </div>
                <div className={styles.pair}>
                  <Field label="Custo" error={errorOf("cost")}>
                    <Input type="text" name="cost" mask="currency" value={values.cost} placeholder="0,00" disabled={saving} onChange={digitsOf("cost")} />
                  </Field>
                  <Field label="Desconto máximo" error={errorOf("maxDiscount")}>
                    <Input type="text" name="maxDiscount" mask="integer" value={values.maxDiscount} placeholder="10" inputMode="numeric" disabled={saving} iconEnd={<FieldAffix data-tone="muted">%</FieldAffix>} onChange={digitsOf("maxDiscount")} />
                  </Field>
                </div>
              </Part>

              {service ? (
                <Part number={2} title="Prazo e garantia" hint="Prazo, revisões e suporte">
                  <div className={styles.pair}>
                    <Field label="Prazo mínimo" error={errorOf("durationMin")}>
                      <Input type="text" name="durationMin" mask="integer" value={values.durationMin} placeholder="7" inputMode="numeric" disabled={saving} iconEnd={<FieldAffix data-tone="muted">dias</FieldAffix>} onChange={digitsOf("durationMin")} />
                    </Field>
                    <Field label="Prazo máximo" error={errorOf("durationMax")}>
                      <Input type="text" name="durationMax" mask="integer" value={values.durationMax} placeholder="14" inputMode="numeric" disabled={saving} iconEnd={<FieldAffix data-tone="muted">dias</FieldAffix>} onChange={digitsOf("durationMax")} />
                    </Field>
                  </div>
                  <div className={styles.pair}>
                    <Field label="Revisões inclusas" error={errorOf("revisions")}>
                      <Input type="text" name="revisions" mask="integer" value={values.revisions} placeholder="2" inputMode="numeric" disabled={saving} iconEnd={<FieldAffix data-tone="muted">rodadas</FieldAffix>} onChange={digitsOf("revisions")} />
                    </Field>
                    <Field label="Garantia" error={errorOf("supportDays")}>
                      <Input type="text" name="supportDays" mask="integer" value={values.supportDays} placeholder="30" inputMode="numeric" disabled={saving} iconEnd={<FieldAffix data-tone="muted">dias</FieldAffix>} onChange={digitsOf("supportDays")} />
                    </Field>
                  </div>
                </Part>
              ) : (
                <Part number={2} title="Estoque e garantia" hint="Quantidade e aviso">
                  <div className={styles.triple}>
                    <Field label="Em estoque" error={errorOf("stockQuantity")}>
                      <Input type="text" name="stockQuantity" mask="integer" value={values.stockQuantity} placeholder="48" inputMode="numeric" disabled={saving} onChange={digitsOf("stockQuantity")} />
                    </Field>
                    <Field label="Capacidade" error={errorOf("stockCapacity")}>
                      <Input type="text" name="stockCapacity" mask="integer" value={values.stockCapacity} placeholder="100" inputMode="numeric" disabled={saving} onChange={digitsOf("stockCapacity")} />
                    </Field>
                    <Field label="Avisar abaixo de" error={errorOf("stockMinimum")}>
                      <Input type="text" name="stockMinimum" mask="integer" value={values.stockMinimum} placeholder="10" inputMode="numeric" disabled={saving} onChange={digitsOf("stockMinimum")} />
                    </Field>
                  </div>
                  <div className={styles.pair}>
                    <Field label="Garantia" error={errorOf("supportDays")}>
                      <Input type="text" name="supportDays" mask="integer" value={values.supportDays} placeholder="30" inputMode="numeric" disabled={saving} iconEnd={<FieldAffix data-tone="muted">dias</FieldAffix>} onChange={digitsOf("supportDays")} />
                    </Field>
                  </div>
                </Part>
              )}

              <Part number={3} title="Escopo" hint="Entrega e pedidos">
                <Field label="A entrega inclui" error={errorOf("deliverables")}>
                  <TagInput value={values.deliverables} placeholder="Layout aprovado em protótipo" max={MAX_LIST_ITEMS} maxLength={catalogLimits.listItem} disabled={saving} onChange={(deliverables) => set("deliverables", deliverables)} />
                </Field>
                <Field label="Pedimos ao cliente" error={errorOf("requirements")}>
                  <TagInput value={values.requirements} placeholder="Identidade visual e textos" max={MAX_LIST_ITEMS} maxLength={catalogLimits.listItem} disabled={saving} onChange={(requirements) => set("requirements", requirements)} />
                </Field>
              </Part>

              <Part number={4} title="Anotações" hint="Só a equipe vê">
                <Field label="Anotações da equipe" error={errorOf("notes")}>
                  <Textarea name="notes" value={values.notes} rows={3} maxLength={catalogLimits.notes} placeholder="O que a equipe precisa lembrar ao orçar este item" disabled={saving} onChange={(event) => set("notes", event.target.value)} />
                </Field>
              </Part>
            </>
          )}

          {error && !known && (
            <Text variant="footnote" tone="danger" role="alert" className={styles.alert}>
              {error.message}
            </Text>
          )}
        </div>

        <footer className={styles.cardFoot}>
          <Button variant="ghost" size="sm" radius="md" disabled={saving} onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" size="sm" radius="md" iconStart={<CheckIcon />} loading={saving}>
            {saving ? "Salvando" : editing ? "Salvar" : "Criar item"}
          </Button>
        </footer>
      </form>

      {/* A prévia: só a ficha do item vestida com o rascunho, sem título por cima (2026-10-26, a pedido). */}
      <aside className={styles.preview} aria-label="Prévia do item">
        <CatalogPreview draft={previewDraft} />
      </aside>
    </>
  );
}
