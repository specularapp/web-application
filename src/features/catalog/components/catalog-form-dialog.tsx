"use client";

import { CheckCircleIcon, CheckIcon, CoinsIcon, ListChecksIcon, TagIcon, UploadSimpleIcon, XIcon, type Icon } from "@phosphor-icons/react";
import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useFloatingActionsRegistration } from "@/components/layout/floating-actions";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { Field } from "@/components/ui/field";
import { FieldAffix } from "@/components/ui/field-shell";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { TagInput } from "@/components/ui/tag-input";
import { Text } from "@/components/ui/text";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/providers/toast-provider";
import { MOBILE_QUERY, useMediaQuery } from "@/hooks/use-media-query";
import { onlyDigits } from "@/lib/masks";
import { saveCatalogItemAction } from "../actions";
import { catalogHueFor, kindLabels, unitLabels } from "../list-options";
import { catalogKinds, catalogLimits, catalogUnits, MAX_LIST_ITEMS, type CatalogFormInput } from "../schemas";
import type { CatalogItem, CatalogKind, CatalogUnit } from "../summary";
import { CatalogArtwork } from "./catalog-artwork";
import styles from "./catalog-form-dialog.module.css";

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

/** Tamanho máximo da imagem, em bytes: 2 MB, o mesmo teto da foto do cliente. */
const IMAGE_MAX_BYTES = 2 * 1024 * 1024;

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

/* Um bloco do formulário: o glifo e o título numa linha, e os campos embaixo. Quem separa um bloco do
   outro é o fio, de ponta a ponta, como na gaveta do cliente. */
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

// A ficha de produto ou serviço para criar e para editar, na gaveta lateral da casa, a mesma do cliente:
// 30rem na direita no desktop e bandeja no celular, com o título e o X grudados no topo, o formulário
// rolando no meio e Cancelar e Salvar fixos no rodapé. No celular o rodapé some e salvar e sair vão para a
// barra flutuante do menu. Três blocos separados por fio: o item (tipo, nome, categoria, descrição, a arte
// com a cor e a imagem), preço e condições (o que a ficha mostra na grade 2×, com prazo e revisões só em
// serviço e estoque só em produto) e escopo (o que a entrega inclui, o que se pede ao cliente, etiquetas e
// anotações). O estado é local e o envio é a action, que valida com zod de novo no servidor; erro de campo
// volta para o campo, e sucesso avisa e fecha. Ativo fica no menu do chevron duplo do topo, como no cliente.
export function CatalogFormDialog({ editor, categories, onClose, onSaved }: CatalogFormDialogProps) {
  const mobile = useMediaQuery(MOBILE_QUERY);
  // O que está desenhado dentro da gaveta: segue o editor enquanto ele existe e fica quando ele zera, para
  // o conteúdo não sumir antes de a gaveta terminar de sair. Ajustado durante o render, como o React pede.
  const [shown, setShown] = useState<CatalogEditor>(editor);
  if (editor !== null && editor !== shown) setShown(editor);

  return (
    <Dialog open={editor !== null} onClose={onClose} label={editor === "new" ? "Novo item" : "Editar item"} size="md" placement="end" surface="glass" scrim={mobile} focusOnOpen={false}>
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
  const [imageUrl, setImageUrl] = useState<string | null>(item?.imageUrl ?? null);
  useEffect(() => () => revokeLocal(imageUrl), [imageUrl]);

  const pickImage = (file: File | null) => {
    if (file && file.size > IMAGE_MAX_BYTES) {
      toast({ title: "Imagem grande demais", description: "A imagem passa de 2 MB. Escolha uma menor.", tone: "warning" });
      return;
    }
    setImageUrl(file ? URL.createObjectURL(file) : null);
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

    const result = await saveCatalogItemAction(input);
    setSaving(false);

    if (!result.ok) {
      setError({ field: result.field, message: result.error });
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

  return (
    <form ref={form} className={styles.dialog} onSubmit={submit} noValidate aria-labelledby={titleId}>
      <header className={styles.head}>
        <Text as="h2" id={titleId} variant="headline" weight="semibold" truncate>
          {editing ? "Editar item" : "Novo item"}
        </Text>
        <div className={styles.headActions}>
          {/* Ativo é situação, e não dado da ficha: mora no menu de opções da própria janela, no chevron
              duplo das listas, como interruptor, para não tomar linha do formulário. */}
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
        </div>
      </header>

      <div className={styles.body}>
        <Section icon={TagIcon} title="O item">
          {/* A arte do item como vai aparecer no cartão, já na cor escolhida, com a imagem opcional ao lado:
              sem imagem vale a arte gerada, tingida no matiz. */}
          <div className={styles.artwork}>
            <CatalogArtwork item={preview} size="lg" />
            <div className={styles.artworkCopy}>
              <Text as="span" variant="footnote" weight="medium" truncate>
                Imagem
              </Text>
              <div className={styles.artworkActions}>
                <Button variant="outline" size="sm" radius="md" iconStart={<UploadSimpleIcon />} disabled={saving} onClick={() => fileInput.current?.click()}>
                  {imageUrl ? "Trocar" : "Enviar"}
                </Button>
                {imageUrl && (
                  <IconButton label="Remover imagem" variant="ghost" size="sm" radius="md" disabled={saving} onClick={() => pickImage(null)}>
                    <XIcon />
                  </IconButton>
                )}
              </div>
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
          <Field label="Descrição" required hint="Uma ou duas frases: o cartão mostra as duas primeiras linhas" error={errorOf("description")}>
            <Textarea name="description" value={values.description} rows={2} maxLength={catalogLimits.description} placeholder="O que é e o que a pessoa leva" disabled={saving} onChange={(event) => set("description", event.target.value)} />
          </Field>
        </Section>

        <Separator className={styles.divider} />

        <Section icon={CoinsIcon} title="Preço e condições">
          <div className={styles.pair}>
            <Field label="Preço" required error={errorOf("price")}>
              <Input type="text" name="price" mask="currency" value={values.price} placeholder="0,00" disabled={saving} onChange={digitsOf("price")} />
            </Field>
            <Field label="Cobrança" required>
              <Select<CatalogUnit> label="Como o preço é cobrado" options={unitOptions} value={values.unit} disabled={saving} onChange={(unit) => set("unit", unit)} />
            </Field>
          </div>
          <div className={styles.pair}>
            <Field label="Custo" hint="Direto e estimado; em branco quando a equipe não mede" error={errorOf("cost")}>
              <Input type="text" name="cost" mask="currency" value={values.cost} placeholder="0,00" disabled={saving} onChange={digitsOf("cost")} />
            </Field>
            <Field label="Desconto máximo" hint="Sem aprovação" error={errorOf("maxDiscount")}>
              <Input type="text" name="maxDiscount" mask="integer" value={values.maxDiscount} placeholder="10" inputMode="numeric" disabled={saving} iconEnd={<FieldAffix data-tone="muted">%</FieldAffix>} onChange={digitsOf("maxDiscount")} />
            </Field>
          </div>
          <div className={styles.pair}>
            <Field label="Garantia" hint="Dias de suporte depois da entrega" error={errorOf("supportDays")}>
              <Input type="text" name="supportDays" mask="integer" value={values.supportDays} placeholder="30" inputMode="numeric" disabled={saving} iconEnd={<FieldAffix data-tone="muted">dias</FieldAffix>} onChange={digitsOf("supportDays")} />
            </Field>
            {service && (
              <Field label="Revisões inclusas" error={errorOf("revisions")}>
                <Input type="text" name="revisions" mask="integer" value={values.revisions} placeholder="2" inputMode="numeric" disabled={saving} iconEnd={<FieldAffix data-tone="muted">rodadas</FieldAffix>} onChange={digitsOf("revisions")} />
              </Field>
            )}
          </div>

          {service ? (
            <div className={styles.pair}>
              <Field label="Prazo mínimo" hint="Em branco fica indeterminado" error={errorOf("durationMin")}>
                <Input type="text" name="durationMin" mask="integer" value={values.durationMin} placeholder="7" inputMode="numeric" disabled={saving} iconEnd={<FieldAffix data-tone="muted">dias</FieldAffix>} onChange={digitsOf("durationMin")} />
              </Field>
              <Field label="Prazo máximo" error={errorOf("durationMax")}>
                <Input type="text" name="durationMax" mask="integer" value={values.durationMax} placeholder="14" inputMode="numeric" disabled={saving} iconEnd={<FieldAffix data-tone="muted">dias</FieldAffix>} onChange={digitsOf("durationMax")} />
              </Field>
            </div>
          ) : (
            <div className={styles.triple}>
              <Field label="Em estoque" hint="Tudo em branco é sob demanda" error={errorOf("stockQuantity")}>
                <Input type="text" name="stockQuantity" mask="integer" value={values.stockQuantity} placeholder="48" inputMode="numeric" disabled={saving} onChange={digitsOf("stockQuantity")} />
              </Field>
              <Field label="Capacidade" hint="Quanto cabe cheio" error={errorOf("stockCapacity")}>
                <Input type="text" name="stockCapacity" mask="integer" value={values.stockCapacity} placeholder="100" inputMode="numeric" disabled={saving} onChange={digitsOf("stockCapacity")} />
              </Field>
              <Field label="Avisar abaixo de" error={errorOf("stockMinimum")}>
                <Input type="text" name="stockMinimum" mask="integer" value={values.stockMinimum} placeholder="10" inputMode="numeric" disabled={saving} onChange={digitsOf("stockMinimum")} />
              </Field>
            </div>
          )}
        </Section>

        <Separator className={styles.divider} />

        <Section icon={ListChecksIcon} title="Escopo e anotações">
          <Field label="A entrega inclui" hint="Um item por vez, Enter para adicionar" error={errorOf("deliverables")}>
            <TagInput value={values.deliverables} placeholder="Layout aprovado em protótipo" max={MAX_LIST_ITEMS} maxLength={catalogLimits.listItem} disabled={saving} onChange={(deliverables) => set("deliverables", deliverables)} />
          </Field>
          <Field label="Pedimos ao cliente" error={errorOf("requirements")}>
            <TagInput value={values.requirements} placeholder="Identidade visual e textos" max={MAX_LIST_ITEMS} maxLength={catalogLimits.listItem} disabled={saving} onChange={(requirements) => set("requirements", requirements)} />
          </Field>
          <Field label="Etiquetas" error={errorOf("tags")}>
            <TagInput value={values.tags} placeholder="Digite e aperte Enter" max={MAX_LIST_ITEMS} maxLength={catalogLimits.tag} disabled={saving} onChange={(tags) => set("tags", tags)} />
          </Field>
          <Field label="Anotações da equipe" error={errorOf("notes")}>
            <Textarea name="notes" value={values.notes} rows={3} maxLength={catalogLimits.notes} placeholder="O que a equipe precisa lembrar ao orçar este item" disabled={saving} onChange={(event) => set("notes", event.target.value)} />
          </Field>
        </Section>

        {error && !known && (
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
          {saving ? "Salvando" : editing ? "Salvar" : "Criar item"}
        </Button>
      </footer>
    </form>
  );
}
