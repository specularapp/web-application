"use client";

import {
  FloppyDiskIcon,
  LinkIcon,
  PaperPlaneTiltIcon,
  PencilSimpleIcon,
  InfoIcon,
  PlusIcon,
  ShoppingBagIcon,
  TrashIcon,
  UserIcon,
  WalletIcon,
  XIcon,
  type Icon,
} from "@phosphor-icons/react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useFloatingActionsRegistration } from "@/components/layout/floating-actions";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { FieldAffix } from "@/components/ui/field-shell";
import { HoverCard } from "@/components/ui/hover-card";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Text } from "@/components/ui/text";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/providers/toast-provider";
import { CatalogArtwork } from "@/features/catalog/components/catalog-artwork";
import { catalogHueFor, kindLabels, unitLabels } from "@/features/catalog/list-options";
import { catalogUnits } from "@/features/catalog/schemas";
import type { CatalogItem, CatalogUnit } from "@/features/catalog/summary";
import type { ClientListItem } from "@/features/clients/list-options";
import { MOBILE_QUERY, useMediaQuery } from "@/hooks/use-media-query";
import { onlyDigits } from "@/lib/masks";
import { formatMoney } from "@/lib/utils/format";
import { saveQuoteAction } from "../actions";
import { paymentMethods } from "../labels";
import { MAX_LINES, paymentMethodValues, quoteLimits, type QuoteFormInput } from "../schemas";
import { quoteShareUrl } from "../share";
import type { Quote, QuoteCourtesy, QuoteIssuer, QuotePaymentMethod, QuotePerson } from "../summary";
import { isCourtesy, lineTotal, quoteTotals } from "../totals";
import { QuoteDiscardDialog } from "./quote-discard-dialog";
import { QuoteDocument } from "./quote-document";
import { QuoteLineFacts, QuoteLineInfo } from "./quote-line-info";
import { QuotePaper } from "./quote-paper";
import styles from "./quote-editor-dialog.module.css";

/** O que a janela edita: um orçamento da lista ou `"new"` para criar. Nulo fecha. */
export type QuoteEditor = Quote | "new" | null;

/** O que a URL pode pedir já preenchido num orçamento novo: o cliente e o item do catálogo. */
export type QuotePrefill = { clientId?: string; itemId?: string };

export type QuoteEditorDialogProps = {
  editor: QuoteEditor;
  clients: ClientListItem[];
  catalog: CatalogItem[];
  /** Quem emite e quem responde, para o documento em prévia ser o que o cliente vai receber. */
  issuer: QuoteIssuer;
  owner: QuotePerson;
  /** O número que um orçamento novo vai receber. */
  nextNumber: string;
  prefill?: QuotePrefill;
  onClose: () => void;
  onSaved: () => void;
};

const DEFAULT_VALIDITY_DAYS = 15;
const FREE_ITEM = "__avulso";

/** Quantos clientes e itens a lista mostra antes de alguém buscar: os mais recentes. */
const SHOWN_OPTIONS = 10;

const unitOptions = catalogUnits.map((value) => ({ value, label: unitLabels[value].replace(/^por /, "Por ") }));

/* Cortesia em três respostas (pedido de 2026-09-09): a do meio é o brinde de sempre, a última é a isca de
   fechar hoje. */
const courtesyOptions: { value: QuoteCourtesy; label: string }[] = [
  { value: "no", label: "Não" },
  { value: "yes", label: "Sim" },
  { value: "today", label: "Apenas hoje" },
];

/* O item avulso ganha a arte da casa, como os do catálogo, para nenhuma linha ficar sem imagem. */
const FREE_ITEM_ART = { id: FREE_ITEM, name: "Item avulso", imageUrl: null, hue: catalogHueFor("Item avulso") };
const discountOptions = [
  { value: "percent" as const, label: "Em porcentagem" },
  { value: "amount" as const, label: "Em reais" },
];

const isoOf = (date: Date) => format(date, "yyyy-MM-dd");
const shortDate = (date: Date) => format(date, "d MMM. yyyy", { locale: ptBR });
const addDays = (date: Date, days: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
const newId = () => `l-${Math.random().toString(36).slice(2, 9)}`;

type LineValues = {
  id: string;
  catalogItemId: string | null;
  name: string;
  description: string;
  /** Dígitos, como a máscara do campo pede. */
  quantity: string;
  unitPrice: string;
  unit: CatalogUnit;
  courtesy: QuoteCourtesy;
};

const emptyLine = (): LineValues => ({
  id: newId(),
  catalogItemId: null,
  name: "",
  description: "",
  quantity: "1",
  unitPrice: "",
  unit: "project",
  courtesy: "no",
});

const lineFromCatalog = (item: CatalogItem): LineValues => ({
  id: newId(),
  catalogItemId: item.id,
  name: item.name,
  description: item.description,
  quantity: "1",
  unitPrice: String(item.price),
  unit: item.unit,
  courtesy: "no",
});

/* O formulário guarda texto cru; o orçamento guarda tipos. A conversão mora aqui, num lugar só. */
function valuesOf(quote: Quote | undefined, catalog: CatalogItem[], prefill?: QuotePrefill) {
  const today = new Date();
  const prefilled = prefill?.itemId ? catalog.find((item) => item.id === prefill.itemId) : undefined;
  return {
    title: quote?.title ?? (prefilled ? prefilled.name : ""),
    clientId: quote?.clientId ?? prefill?.clientId ?? "",
    issuedAt: quote ? parseISO(quote.issuedAt) : today,
    validUntil: quote ? (quote.validUntil ? parseISO(quote.validUntil) : undefined) : addDays(today, DEFAULT_VALIDITY_DAYS),
    lines: quote
      ? quote.lines.map((line) => ({ ...line, quantity: String(line.quantity), unitPrice: String(line.unitPrice) }))
      : [prefilled ? lineFromCatalog(prefilled) : emptyLine()],
    discountOn: Boolean(quote?.discount),
    discountKind: quote?.discount?.kind ?? ("percent" as "percent" | "amount"),
    discountValue: quote?.discount ? String(quote.discount.value) : "",
    installments: String(quote?.installments ?? 1),
    paymentMethods: quote?.paymentMethods ?? (["pix"] as QuotePaymentMethod[]),
    cashDiscount: quote?.cashDiscount ? String(quote.cashDiscount) : "",
    notes: quote?.notes ?? "",
  };
}

type Values = ReturnType<typeof valuesOf>;

/** As três partes do formulário, na ordem em que se preenchem. */
type Step = "info" | "items" | "terms";

/* Uma parte do formulário. Aberta, mostra os campos; fechada, encolhe para o resumo do que já foi respondido,
   com o lápis que a reabre (pedido de 2026-09-09): uma parte por vez, para o formulário não ser uma parede
   de campos, e nada sai de vista, porque o resumo diz tudo. */
function Section({
  icon: Glyph,
  title,
  open,
  onOpen,
  aside,
  summary,
  children,
}: {
  icon: Icon;
  title: string;
  open: boolean;
  onOpen: () => void;
  aside?: ReactNode;
  summary: ReactNode;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section className={styles.section} data-open={open || undefined} aria-labelledby={id}>
      <div className={styles.sectionHead}>
        <Glyph aria-hidden="true" />
        <Text as="h3" id={id} variant="subheadline" weight="semibold">
          {title}
        </Text>
        <span className={styles.aside}>
          {open
            ? aside
            : (
                <IconButton label={`Editar ${title.toLowerCase()}`} variant="ghost" size="sm" radius="md" onClick={onOpen}>
                  <PencilSimpleIcon />
                </IconButton>
              )}
        </span>
      </div>
      {open ? children : <div className={styles.summary}>{summary}</div>}
    </section>
  );
}

/* Um campo do resumo: o rótulo em cima e o valor embaixo, no mesmo lugar onde estava o campo de verdade
   (pedido de 2026-09-09), então fechar uma parte não embaralha o que a pessoa acabou de preencher. */
function Read({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.read}>
      <Text as="span" variant="caption1" tone="secondary">
        {label}
      </Text>
      <span className={styles.readValue}>
        {typeof children === "string" ? (
          <Text as="span" variant="footnote" weight="medium" truncate>
            {children}
          </Text>
        ) : (
          children
        )}
      </span>
    </div>
  );
}

type InstallmentPlanProps = { installments: number; amount: number; issuedAt: Date };

/* A fila de parcelas com data e valor: a primeira vence na emissão e as outras a cada trinta dias. Peça própria
   porque mora em dois lugares, a ficha flutuante do desktop e a bandeja do celular (2026-09-10). */
function InstallmentPlan({ installments, amount, issuedAt }: InstallmentPlanProps) {
  return (
    <>
      <Text as="span" variant="subheadline" weight="semibold">
        {installments} parcelas de {formatMoney(amount)}
      </Text>
      <div className={styles.plan}>
        {Array.from({ length: installments }, (_, position) => (
          <div key={position} className={styles.planRow}>
            <Text as="span" variant="caption1" tone="secondary">
              {position + 1}ª em {shortDate(addDays(issuedAt, position * 30))}
            </Text>
            <Text as="span" variant="footnote" weight="medium">
              {formatMoney(amount)}
            </Text>
          </div>
        ))}
      </div>
    </>
  );
}

/* O informativo das parcelas, dentro do campo: o glifo miúdo e, ao apontar, a fila de parcelas (pedido de
   2026-09-09). No celular não há apontar, então o glifo é um botão e quem monta o formulário abre a fila numa
   bandeja (pedido de 2026-09-10: dava para ver as parcelas só no desktop). Com uma parcela só, ele volta a
   ser o "x" do campo. */
function InstallmentsInfo({ onOpen, ...plan }: InstallmentPlanProps & { onOpen?: () => void }) {
  if (plan.installments < 2) return <FieldAffix data-tone="muted">x</FieldAffix>;

  if (onOpen) {
    return (
      <button type="button" className={styles.planTrigger} aria-label="Ver as parcelas" onClick={onOpen}>
        <InfoIcon aria-hidden="true" />
      </button>
    );
  }

  return (
    <HoverCard width={252} height={220} inline content={<InstallmentPlan {...plan} />}>
      <span className={styles.planTrigger}>
        <InfoIcon aria-hidden="true" />
      </span>
    </HoverCard>
  );
}

// O editor de orçamento, para criar e para editar (2026-09-09, sobre uma referência de criar fatura do
// usuário): a janela grande da casa, centrada, com o formulário à esquerda e o documento em prévia ao vivo à
// direita, exatamente o que o cliente vai receber, porque é o mesmo componente. No desktop a prévia está
// sempre lá, numa folha A4 reduzida para caber inteira e centrada; no celular vira bandeja com duas abas,
// dados e prévia, e salvar e sair vão para a barra flutuante. O formulário é um acordeão de três partes,
// Informações, Itens e Condições, uma aberta por vez, e a que fecha mostra o resumo do que foi respondido com
// um lápis para reabrir. O estado é local e o envio é a action, que valida com zod de novo no servidor.
export function QuoteEditorDialog({ editor, clients, catalog, issuer, owner, nextNumber, prefill, onClose, onSaved }: QuoteEditorDialogProps) {
  const mobile = useMediaQuery(MOBILE_QUERY);
  const [shown, setShown] = useState<QuoteEditor>(editor);
  if (editor !== null && editor !== shown) setShown(editor);

  // Quem fecha é o formulário, que salva o rascunho antes se algo mudou (pedido de 2026-09-10): a janela só
  // repassa o pedido, venha ele do fundo, do Escape, do arrasto da alça ou da barra flutuante. O formulário
  // registra o próprio fechar a cada render; antes de ele existir, fechar é fechar.
  const closeHandler = useRef<() => void>(onClose);

  return (
    <Dialog
      open={editor !== null}
      onClose={() => closeHandler.current()}
      label={editor === "new" ? "Novo orçamento" : "Editar orçamento"}
      size="xl"
      surface="page"
      /* Escurece a página atrás em qualquer largura (pedido de 2026-09-09): a janela toma quase a tela toda,
         e sem o fundo escuro a lista atrás competia com o documento. */
      scrim
      focusOnOpen={false}
    >
      {shown !== null && (
        <QuoteForm
          key={shown === "new" ? "new" : shown.id}
          quote={shown === "new" ? undefined : shown}
          clients={clients}
          catalog={catalog}
          issuer={issuer}
          owner={owner}
          nextNumber={nextNumber}
          prefill={shown === "new" ? prefill : undefined}
          mobile={mobile}
          onClose={onClose}
          onSaved={onSaved}
          registerClose={(close) => {
            closeHandler.current = close;
          }}
        />
      )}
    </Dialog>
  );
}

type QuoteFormProps = {
  quote?: Quote;
  clients: ClientListItem[];
  catalog: CatalogItem[];
  issuer: QuoteIssuer;
  owner: QuotePerson;
  nextNumber: string;
  prefill?: QuotePrefill;
  mobile: boolean;
  onClose: () => void;
  onSaved: () => void;
  /** Por onde a janela pede para fechar: o formulário entrega o fechar que salva o rascunho antes. */
  registerClose: (close: () => void) => void;
};

function QuoteForm({ quote, clients, catalog, issuer, owner, nextNumber, prefill, mobile, onClose, onSaved, registerClose }: QuoteFormProps) {
  const { toast } = useToast();
  const [values, setValues] = useState<Values>(() => valuesOf(quote, catalog, prefill));
  const [error, setError] = useState<{ field?: string; message: string } | null>(null);
  const [saving, setSaving] = useState<"draft" | "send" | null>(null);
  const [step, setStep] = useState<Step>("info");
  const [tab, setTab] = useState<"form" | "preview">("form");
  const editing = Boolean(quote);
  const titleId = useId();
  const form = useRef<HTMLFormElement>(null);
  const intent = useRef<"draft" | "send">("draft");

  // No celular, editar um item e ver a ficha dele abrem bandejas por cima do formulário (pedido de 2026-09-10),
  // e a barra flutuante segue a situação: com uma bandeja aberta ela fecha a bandeja, e sem nenhuma ela salva.
  // O que está desenhado na bandeja fica guardado à parte, para o conteúdo não sumir antes de ela terminar de
  // descer.
  const [lineSheet, setLineSheet] = useState<string | null>(null);
  const [infoLine, setInfoLine] = useState<string | null>(null);
  const [shownSheetLine, setShownSheetLine] = useState<string | null>(null);
  if (lineSheet !== null && lineSheet !== shownSheetLine) setShownSheetLine(lineSheet);
  const [shownInfoLine, setShownInfoLine] = useState<string | null>(null);
  if (infoLine !== null && infoLine !== shownInfoLine) setShownInfoLine(infoLine);
  const [planOpen, setPlanOpen] = useState(false);
  /** A confirmação de sair com algo mexido, aberta por qualquer caminho de fechar. */
  const [confirmingClose, setConfirmingClose] = useState(false);

  /* As bandejas de conteúdo do editor: o item em edição, a ficha de margem e a fila de parcelas. Com uma
     delas aberta a barra só oferece concluir ou fechar, porque salvar o orçamento inteiro dali seria pular
     etapa. */
  const sheetOpen = mobile && (lineSheet !== null || infoLine !== null || planOpen);
  const closeTopSheet = () => {
    if (planOpen) setPlanOpen(false);
    else if (infoLine !== null) setInfoLine(null);
    else setLineSheet(null);
  };

  /* A confirmação de sair é a bandeja da casa com a pergunta, e as duas respostas moram na barra flutuante,
     que é o contrato de toda janela no celular (a ficha do cliente, o item do catálogo e criar equipe fazem
     igual): o conteúdo na bandeja, salvar e sair na barra. Ela é registrada antes das outras porque, com a
     pergunta à vista, é ela quem manda na barra: as bandejas de item e de parcelas só oferecem Fechar, e
     salvar por trás da pergunta não faria sentido. */
  const confirmActions = confirmingClose
    ? {
        primary: { label: saving === "draft" ? "Salvando" : editing ? "Salvar" : "Salvar rascunho", loading: saving === "draft", onClick: () => void saveAndClose() },
        /* Sair sem salvar é a lixeira ao lado de salvar, e não um botão escrito na bandeja: as três saídas
           moram na barra, que é onde as ações do editor vivem no celular, e a bandeja fica só com a pergunta.
           O nome vai na voz e na dica, como em toda ação de glifo da barra. */
        extras: [
          {
            label: "Sair sem salvar",
            icon: <TrashIcon />,
            disabled: saving !== null,
            onClick: () => {
              setConfirmingClose(false);
              onClose();
            },
          },
        ],
        cancel: { label: "Continuar editando", onClick: () => setConfirmingClose(false) },
      }
    : null;

  useFloatingActionsRegistration(
    confirmActions ??
      (sheetOpen
        ? { primary: { label: lineSheet !== null && infoLine === null && !planOpen ? "Concluir" : "Fechar", onClick: closeTopSheet }, cancel: { label: "Fechar", onClick: closeTopSheet } }
        : {
            /* Salvar, e não "Salvar rascunho" (pedido de 2026-09-10): o botão gera o orçamento ou grava a
               edição, e chamá-lo de rascunho dizia menos do que ele faz. Ao lado vai só enviar, em glifo: o
               copiar link saiu da barra do celular (segundo pedido do dia), porque enviar já leva o link e
               cada peça a mais aperta a barra. Ele fica no leque da lista e no cabeçalho do desktop. */
            primary: { label: saving ? "Salvando" : "Salvar", loading: saving !== null, onClick: () => submitWith("draft") },
            extras: [{ label: "Enviar ao cliente", icon: <PaperPlaneTiltIcon weight="bold" />, loading: saving === "send", disabled: saving !== null, onClick: () => submitWith("send") }],
            cancel: { label: "Fechar", onClick: () => void requestClose() },
          }),
  );

  const set = <K extends keyof Values>(key: K, value: Values[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    if (error) setError(null);
  };

  const setLine = (id: string, patch: Partial<LineValues>) => {
    setValues((current) => ({ ...current, lines: current.lines.map((line) => (line.id === id ? { ...line, ...patch } : line)) }));
    if (error) setError(null);
  };

  const pickCatalog = (id: string, value: string) => {
    const item = catalog.find((entry) => entry.id === value);
    if (!item) {
      setLine(id, { catalogItemId: null });
      return;
    }
    setLine(id, { catalogItemId: item.id, name: item.name, description: item.description, unitPrice: String(item.price), unit: item.unit });
  };

  // Um item aberto por vez (pedido de 2026-09-09): acrescentar um fecha o anterior, e o fechado abre no
  // clique do próprio cartão. Com um item só, ele fica sempre aberto.
  const [openLine, setOpenLine] = useState<string>(() => values.lines[values.lines.length - 1]?.id ?? "");

  const addLine = () => {
    const line = emptyLine();
    set("lines", [...values.lines, line]);
    setOpenLine(line.id);
    if (mobile) setLineSheet(line.id);
  };

  const removeLine = (id: string) => {
    const rest = values.lines.filter((line) => line.id !== id);
    set("lines", rest);
    if (openLine === id) setOpenLine(rest[rest.length - 1]?.id ?? "");
    if (lineSheet === id) setLineSheet(null);
  };

  const toggleMethod = (method: QuotePaymentMethod, on: boolean) =>
    set("paymentMethods", on ? [...values.paymentMethods, method] : values.paymentMethods.filter((entry) => entry !== method));

  const client = clients.find((entry) => entry.id === values.clientId);
  const catalogOf = (id: string | null) => (id ? catalog.find((item) => item.id === id) : undefined);

  // O orçamento como o documento o lê, montado a cada tecla: é o que a prévia desenha e o que a action recebe.
  const draft: Quote = {
    id: quote?.id ?? "novo",
    number: quote?.number ?? nextNumber,
    title: values.title || "Novo orçamento",
    status: quote?.status ?? "draft",
    clientId: values.clientId || null,
    client: client
      ? {
          name: client.name,
          avatarUrl: client.avatarUrl,
          company: client.company,
          email: client.email ?? undefined,
          phone: client.phone ?? undefined,
          city: client.city,
        }
      : { name: "Cliente", avatarUrl: null },
    owner,
    issuer,
    lines: values.lines.map((line) => ({
      id: line.id,
      catalogItemId: line.catalogItemId,
      name: line.name || "Item",
      description: line.description,
      quantity: Number(line.quantity || 0),
      unitPrice: Number(line.unitPrice || 0),
      unit: line.unit,
      courtesy: line.courtesy,
    })),
    discount: values.discountOn && values.discountValue ? { kind: values.discountKind, value: Number(values.discountValue) } : null,
    installments: Math.max(1, Number(values.installments || 1)),
    paymentMethods: values.paymentMethods,
    cashDiscount: Number(values.cashDiscount || 0),
    notes: values.notes,
    issuedAt: isoOf(values.issuedAt),
    validUntil: values.validUntil ? isoOf(values.validUntil) : null,
    sentAt: quote?.sentAt ?? null,
    viewedAt: quote?.viewedAt ?? null,
    respondedAt: quote?.respondedAt ?? null,
    shareToken: quote?.shareToken ?? "",
    createdAt: quote?.createdAt ?? isoOf(new Date()),
    updatedAt: isoOf(new Date()),
  };
  const totals = quoteTotals(draft);

  const submitWith = (next: "draft" | "send") => {
    intent.current = next;
    form.current?.requestSubmit();
  };

  /* O erro vem pelo caminho do campo: a parte dele abre, para a pessoa ver o campo aceso. */
  const stepOf = (field: string): Step => {
    if (field.startsWith("lines")) return "items";
    if (["installments", "paymentMethods", "cashDiscount", "discount", "notes"].some((entry) => field.startsWith(entry))) return "terms";
    return "info";
  };

  /* O que a action recebe, montado do rascunho que a prévia já desenha. */
  const inputFor = (next: "draft" | "send"): QuoteFormInput => ({
    id: quote?.id,
    title: values.title,
    clientId: values.clientId,
    issuedAt: draft.issuedAt,
    validUntil: draft.validUntil,
    lines: draft.lines,
    discount: draft.discount,
    installments: draft.installments,
    paymentMethods: draft.paymentMethods,
    cashDiscount: draft.cashDiscount,
    notes: values.notes,
    intent: next,
  });

  // O que o formulário tinha ao abrir, para saber se algo mudou: em estado, lido uma vez, porque referência
  // não se lê durante o render.
  const [initial] = useState(() => JSON.stringify(values));
  const dirty = JSON.stringify(values) !== initial;

  // Fechar com algo mexido **pergunta** (pedido de 2026-09-10, no lugar do salvar sozinho que valia desde a
  // manhã): a janela de confirmação abre com as três saídas que existem de verdade, salvar e sair, continuar
  // editando ou sair sem salvar. Salvar sozinho resolvia o esquecimento, mas decidia pela pessoa: quem abriu
  // para olhar e mexeu sem querer ficava com um rascunho que não pediu, e quem mexeu de propósito não sabia
  // se tinha sido salvo. Sem mudança nenhuma, fechar continua sendo só fechar, sem pergunta.
  //
  // Vale para todo caminho de saída, porque todos passam por aqui: a barra flutuante, o X do desktop, o
  // toque no fundo, o Escape e o arrasto da alça da bandeja.
  const requestClose = () => {
    if (saving !== null) return;
    if (!dirty) {
      onClose();
      return;
    }
    setConfirmingClose(true);
  };

  /* Salvar e sair, a partir da confirmação. Se o rascunho não passa (falta o cliente, por exemplo), a janela
     fecha mesmo assim e avisa, como antes: um fechar que não fecha prende a pessoa numa tela que ela já quis
     deixar, e a confirmação não é lugar de corrigir campo. */
  const saveAndClose = async () => {
    setSaving("draft");
    const result = await saveQuoteAction(inputFor("draft"));
    setSaving(null);
    setConfirmingClose(false);

    if (!result.ok) {
      toast({ title: "Rascunho não salvo", description: result.error, tone: "warning" });
      onClose();
      return;
    }
    toast({ title: editing ? "Orçamento salvo" : "Rascunho salvo", description: `${draft.number} está na lista.`, tone: "success" });
    onSaved();
  };

  useEffect(() => {
    registerClose(requestClose);
  });

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next = intent.current;
    setSaving(next);
    setError(null);

    const result = await saveQuoteAction(inputFor(next));
    setSaving(null);

    if (!result.ok) {
      setError({ field: result.field, message: result.error });
      setStep(stepOf(result.field ?? ""));
      if (mobile) setTab("form");
      return;
    }

    toast({
      title: result.status === "sent" ? "Orçamento enviado" : editing ? "Orçamento salvo" : "Rascunho salvo",
      description: result.status === "sent" ? `${draft.client.name} já pode abrir o documento pelo link.` : `${draft.number} está na lista.`,
      tone: "success",
    });
    onSaved();
  };

  const copyLink = async () => {
    if (!quote) return;
    try {
      await navigator.clipboard.writeText(quoteShareUrl(quote.shareToken));
      toast({ title: "Link copiado", description: "Cole no WhatsApp ou no e-mail do cliente.", tone: "success" });
    } catch {
      toast({ title: "Não deu para copiar", description: quoteShareUrl(quote.shareToken), tone: "warning" });
    }
  };

  const errorOf = (field: string) => (error?.field === field ? error.message : undefined);
  const lineError = (index: number, field: keyof LineValues) => errorOf(`lines.${index}.${field}`);
  const knownFields = ["title", "clientId", "issuedAt", "validUntil", "installments", "paymentMethods", "cashDiscount", "notes", "discount.value", "lines"];
  const known = error?.field !== undefined && (knownFields.includes(error.field) || error.field.startsWith("lines."));

  const clientOptions = clients.map((entry) => ({
    value: entry.id,
    label: entry.name,
    caption: entry.company ?? entry.email ?? undefined,
    media: <Avatar name={entry.name} src={entry.avatarUrl ?? undefined} size="sm" shape="squircle" />,
  }));
  const catalogOptions = [
    { value: FREE_ITEM, label: "Item avulso", caption: "Escrito à mão, fora do catálogo", media: <CatalogArtwork item={FREE_ITEM_ART} size="sm" /> },
    ...catalog.map((item) => ({
      value: item.id,
      label: item.name,
      caption: `${kindLabels[item.kind]}, ${item.category}`,
      media: <CatalogArtwork item={item} size="sm" />,
    })),
  ];

  /* Os campos de um item, os mesmos no cartão aberto do desktop e na bandeja do celular: o seletor do
     catálogo, nome e descrição quando é avulso, e os quatro números com a cortesia. */
  const lineFields = (line: LineValues, index: number) => {
    const quantity = Number(line.quantity || 0);
    const unitPrice = Number(line.unitPrice || 0);
    const selectId = `${titleId}-${line.id}`;
    return (
      <>
        <Field label="Item do catálogo" id={selectId}>
          <Select
            label="Item do catálogo"
            options={catalogOptions}
            value={line.catalogItemId ?? FREE_ITEM}
            searchable
            searchPlaceholder="Buscar produto ou serviço"
            visibleLimit={SHOWN_OPTIONS}
            emptyLabel="Nenhum item com esse nome"
            disabled={saving !== null}
            onChange={(value) => pickCatalog(line.id, value)}
          />
        </Field>
        {/* Vindo do catálogo, o nome e a descrição são de lá e não se digitam aqui. */}
        {line.catalogItemId === null && (
          <>
            <Field label="Nome" required error={lineError(index, "name")}>
              <Input
                type="text"
                value={line.name}
                maxLength={quoteLimits.lineName}
                placeholder="O que está sendo orçado"
                disabled={saving !== null}
                onChange={(event) => setLine(line.id, { name: event.target.value })}
              />
            </Field>
            <Field label="Descrição" error={lineError(index, "description")}>
              <Input
                type="text"
                value={line.description}
                maxLength={quoteLimits.lineDescription}
                placeholder="O que a linha entrega, em uma frase"
                disabled={saving !== null}
                onChange={(event) => setLine(line.id, { description: event.target.value })}
              />
            </Field>
          </>
        )}
        <div className={styles.lineNumbers}>
          <Field label="Qtd." required error={lineError(index, "quantity")}>
            <Input
              type="text"
              mask="integer"
              value={line.quantity}
              placeholder="1"
              inputMode="numeric"
              disabled={saving !== null}
              onChange={(event) => setLine(line.id, { quantity: onlyDigits(event.target.value) })}
            />
          </Field>
          <Field label="Cobrança" required>
            <Select label="Unidade de cobrança" options={unitOptions} value={line.unit} disabled={saving !== null} onChange={(unit) => setLine(line.id, { unit })} />
          </Field>
          <Field label="Unitário" required error={lineError(index, "unitPrice")}>
            <Input
              type="text"
              mask="currency"
              value={line.unitPrice}
              placeholder="0,00"
              disabled={saving !== null}
              onChange={(event) => setLine(line.id, { unitPrice: onlyDigits(event.target.value) })}
            />
          </Field>
          <Field label="Subtotal">
            <Input type="text" value={formatMoney(lineTotal({ quantity, unitPrice, courtesy: line.courtesy }))} readOnly tabIndex={-1} aria-label="Subtotal da linha" />
          </Field>
          {/* Cortesia em três respostas: sim e "apenas hoje" põem a etiqueta no documento e zeram a cobrança
              daquela linha. */}
          <Field label="Cortesia">
            <Select label="Cortesia deste item" options={courtesyOptions} value={line.courtesy} disabled={saving !== null} onChange={(courtesy) => setLine(line.id, { courtesy })} />
          </Field>
        </div>
      </>
    );
  };

  /* O cabeçalho de um item aberto: a contagem à esquerda e, na ponta, informação e lixeira, os dois miúdos. */
  const lineHead = (line: LineValues, index: number, source: CatalogItem | undefined, extra?: ReactNode) => (
    <div className={styles.lineHead}>
      <Text as="span" variant="caption1" weight="semibold" tone="secondary">
        Item {String(index + 1).padStart(2, "0")}
      </Text>
      <span className={styles.lineHeadActions}>
        {source && (
          <QuoteLineInfo
            item={source}
            unitPrice={Number(line.unitPrice || 0)}
            quantity={Number(line.quantity || 0)}
            className={styles.tiny}
            onOpen={mobile ? () => setInfoLine(line.id) : undefined}
          />
        )}
        <IconButton
          label={`Remover item ${index + 1}`}
          variant="ghost"
          size="sm"
          radius="md"
          className={styles.tiny}
          disabled={saving !== null || values.lines.length === 1}
          onClick={() => removeLine(line.id)}
        >
          <TrashIcon />
        </IconButton>
        {extra}
      </span>
    </div>
  );

  const sheetLine = shownSheetLine === null ? undefined : values.lines.find((line) => line.id === shownSheetLine);
  const sheetIndex = sheetLine ? values.lines.indexOf(sheetLine) : -1;
  const infoTarget = shownInfoLine === null ? undefined : values.lines.find((line) => line.id === shownInfoLine);
  const infoSource = infoTarget ? catalogOf(infoTarget.catalogItemId) : undefined;

  const showForm = !mobile || tab === "form";
  // No desktop a prévia não é opcional (a pedido, 2026-09-09): ver o documento é o trabalho.
  const showPreview = !mobile || tab === "preview";

  const methodNames = values.paymentMethods.map((method) => paymentMethods[method].label).join(", ");

  return (
    <form ref={form} className={styles.editor} onSubmit={submit} noValidate aria-labelledby={titleId}>
      <header className={styles.head}>
        <div className={styles.heading}>
          <Text as="h2" id={titleId} variant="headline" weight="semibold" truncate>
            {editing ? "Editar orçamento" : "Novo orçamento"}
          </Text>
          <Text variant="caption1" tone="secondary" truncate className={styles.subtitle}>
            {draft.number}, {formatMoney(totals.total)}
            {draft.lines.length > 0 ? `, ${draft.lines.length} ${draft.lines.length === 1 ? "item" : "itens"}` : ""}
          </Text>
        </div>
        <div className={styles.headActions}>
          {mobile ? (
            /* No celular o cabeçalho tem só as abas (pedido de 2026-09-10): salvar, enviar, copiar o link e
               sair são todos da barra flutuante, e repeti-los aqui era a mesma ação duas vezes na tela. */
            <div className={styles.tabs} role="tablist" aria-label="Dados ou prévia">
              <button type="button" role="tab" aria-selected={tab === "form"} className={styles.tab} onClick={() => setTab("form")}>
                Dados
              </button>
              <button type="button" role="tab" aria-selected={tab === "preview"} className={styles.tab} onClick={() => setTab("preview")}>
                Prévia
              </button>
            </div>
          ) : (
            <>
              {quote && (
                <Button variant="ghost" size="sm" radius="md" iconStart={<LinkIcon />} onClick={() => void copyLink()}>
                  Copiar link
                </Button>
              )}
              {/* Os dois na mesma medida (pedido de 2026-09-09): mesmo tamanho, mesmo raio, mesma largura
                  mínima e um glifo em cada, para lerem como um par. */}
              <Button
                variant="outline"
                size="sm"
                radius="md"
                iconStart={<FloppyDiskIcon />}
                loading={saving === "draft"}
                disabled={saving !== null}
                onClick={() => submitWith("draft")}
                className={styles.action}
              >
                {editing ? "Salvar" : "Rascunho"}
              </Button>
              <Button
                size="sm"
                radius="md"
                iconStart={<PaperPlaneTiltIcon weight="bold" />}
                loading={saving === "send"}
                disabled={saving !== null}
                onClick={() => submitWith("send")}
                className={styles.action}
              >
                Enviar
              </Button>
            </>
          )}
          {!mobile && (
            <IconButton label="Fechar" variant="ghost" size="sm" disabled={saving !== null} onClick={() => void requestClose()}>
              <XIcon />
            </IconButton>
          )}
        </div>
      </header>

      <div className={styles.body} data-preview={showPreview || undefined} data-form={showForm || undefined}>
        {showForm && (
          <div className={styles.form}>
            <Section
              icon={UserIcon}
              title="Informações"
              open={step === "info"}
              onOpen={() => setStep("info")}
              summary={
                /* O resumo fica no lugar exato dos campos (pedido de 2026-09-09): rótulo em cima, valor
                   embaixo, e o par de datas lado a lado, como estavam os dois seletores. */
                <>
                  <Read label="Cliente">
                    {client ? (
                      /* No desenho do gatilho do seletor (pedido de 2026-09-09): a foto à esquerda e, ao
                         lado, o nome com a empresa embaixo. */
                      <span className={styles.person}>
                        <Avatar name={client.name} src={client.avatarUrl ?? undefined} size="sm" shape="squircle" />
                        <span className={styles.personCopy}>
                          <Text as="span" variant="footnote" weight="medium" truncate>
                            {client.name}
                          </Text>
                          {client.company && (
                            <Text as="span" variant="caption1" tone="secondary" truncate>
                              {client.company}
                            </Text>
                          )}
                        </span>
                      </span>
                    ) : (
                      <Text as="span" variant="footnote" tone="danger">
                        Falta escolher
                      </Text>
                    )}
                  </Read>
                  <Read label="Título">{values.title || "Sem título"}</Read>
                  <div className={styles.pair}>
                    <Read label="Emissão">{shortDate(values.issuedAt)}</Read>
                    <Read label="Válido até">{values.validUntil ? shortDate(values.validUntil) : "Sem prazo"}</Read>
                  </div>
                </>
              }
            >
              <Field label="Cliente" required error={errorOf("clientId")}>
                <Select
                  label="Cliente"
                  options={clientOptions}
                  value={values.clientId || undefined}
                  placeholder="Escolha o cliente"
                  searchable
                  searchPlaceholder="Buscar por nome ou empresa"
                  visibleLimit={SHOWN_OPTIONS}
                  emptyLabel="Nenhum cliente com esse nome"
                  disabled={saving !== null}
                  onChange={(clientId) => set("clientId", clientId)}
                />
              </Field>
              <Field label="Título" required error={errorOf("title")}>
                <Input
                  type="text"
                  name="title"
                  value={values.title}
                  maxLength={quoteLimits.title}
                  placeholder="Site institucional e identidade visual"
                  disabled={saving !== null}
                  onChange={(event) => set("title", event.target.value)}
                />
              </Field>
              <div className={styles.pair}>
                <Field label="Emissão" required error={errorOf("issuedAt")}>
                  <DatePicker value={values.issuedAt} disabled={saving !== null} onChange={(date) => date && set("issuedAt", date)} />
                </Field>
                <Field label="Válido até" error={errorOf("validUntil")}>
                  <DatePicker value={values.validUntil} min={values.issuedAt} placeholder="Sem prazo" disabled={saving !== null} onChange={(date) => set("validUntil", date)} />
                </Field>
              </div>
            </Section>

            <span className={styles.divider} aria-hidden="true" />

            <Section
              icon={ShoppingBagIcon}
              title="Itens"
              /* No celular a parte fica sempre aberta (pedido de 2026-09-10): os cartões já são o resumo, cada
                 um abre a própria bandeja, e um lápis para chegar neles seria um toque a mais. */
              open={step === "items" || mobile}
              onOpen={() => setStep("items")}
              aside={
                <Text as="span" variant="footnote" weight="medium">
                  {formatMoney(totals.subtotal)}
                </Text>
              }
              summary={
                /* Fechada, cada linha vira um cartão: a arte, o nome com o tipo e, na outra ponta, o
                   subtotal com a forma de cobrança (pedido de 2026-09-09). */
                <>
                  {values.lines.map((line) => {
                    const item = catalogOf(line.catalogItemId);
                    const quantity = Number(line.quantity || 0);
                    const unitPrice = Number(line.unitPrice || 0);
                    return (
                      <div key={line.id} className={styles.lineCard}>
                        <CatalogArtwork item={item ?? { ...FREE_ITEM_ART, name: line.name || "Item" }} size="sm" />
                        <span className={styles.lineCardCopy}>
                          <Text as="span" variant="footnote" weight="medium" truncate>
                            {line.name || "Item"}
                          </Text>
                          <Text as="span" variant="caption1" tone="secondary" truncate>
                            {item ? kindLabels[item.kind] : "Item avulso"}
                            {isCourtesy(line) ? (line.courtesy === "today" ? ", cortesia hoje" : ", cortesia") : ""}
                          </Text>
                        </span>
                        <span className={styles.lineCardEnd}>
                          <Text as="span" variant="footnote" weight="semibold">
                            {formatMoney(lineTotal({ quantity, unitPrice, courtesy: line.courtesy }))}
                          </Text>
                          <Text as="span" variant="caption1" tone="secondary">
                            {quantity}× {unitLabels[line.unit]}
                          </Text>
                        </span>
                      </div>
                    );
                  })}
                </>
              }
            >
              {errorOf("lines") && (
                <Text variant="footnote" tone="danger" role="alert">
                  {errorOf("lines")}
                </Text>
              )}
              <div className={styles.lines}>
                {values.lines.map((line, index) => {
                  const source = catalogOf(line.catalogItemId);
                  const quantity = Number(line.quantity || 0);
                  const unitPrice = Number(line.unitPrice || 0);

                  // Fechado, o item é o mesmo cartão do resumo, e clicar nele abre. No celular todo item é um
                  // cartão, e o toque abre a bandeja com os campos (pedido de 2026-09-10).
                  if (mobile || (values.lines.length > 1 && openLine !== line.id)) {
                    return (
                      <button key={line.id} type="button" className={styles.lineCard} data-open-line onClick={() => (mobile ? setLineSheet(line.id) : setOpenLine(line.id))}>
                        <CatalogArtwork item={source ?? { ...FREE_ITEM_ART, name: line.name || "Item" }} size="sm" />
                        <span className={styles.lineCardCopy}>
                          <Text as="span" variant="footnote" weight="medium" truncate>
                            {line.name || `Item ${String(index + 1).padStart(2, "0")}`}
                          </Text>
                          <Text as="span" variant="caption1" tone="secondary" truncate>
                            {source ? kindLabels[source.kind] : "Item avulso"}
                            {isCourtesy(line) ? (line.courtesy === "today" ? ", cortesia hoje" : ", cortesia") : ""}
                          </Text>
                        </span>
                        <span className={styles.lineCardEnd}>
                          <Text as="span" variant="footnote" weight="semibold">
                            {formatMoney(lineTotal({ quantity, unitPrice, courtesy: line.courtesy }))}
                          </Text>
                          <Text as="span" variant="caption1" tone="secondary">
                            {quantity}× {unitLabels[line.unit]}
                          </Text>
                        </span>
                      </button>
                    );
                  }

                  return (
                    <div key={line.id} className={styles.line}>
                      {/* O cabeçalho da linha (pedido de 2026-09-09): a contagem à esquerda e, na ponta, o
                          botão de informação e a lixeira, os dois miúdos, com o fio separando do resto. */}
                      {lineHead(line, index, source)}
                      {lineFields(line, index)}
                    </div>
                  );
                })}
              </div>
              <Button
                variant="outline"
                size="sm"
                radius="md"
                iconStart={<PlusIcon />}
                disabled={saving !== null || values.lines.length >= MAX_LINES}
                onClick={addLine}
                className={styles.addLine}
              >
                Adicionar item
              </Button>
            </Section>

            <span className={styles.divider} aria-hidden="true" />

            <Section
              icon={WalletIcon}
              title="Condições"
              open={step === "terms"}
              onOpen={() => setStep("terms")}
              summary={
                <>
                  <div className={styles.pair}>
                    <Read label="Desconto">
                      {values.discountOn && values.discountValue
                        ? values.discountKind === "percent"
                          ? `${values.discountValue}%`
                          : formatMoney(Number(values.discountValue))
                        : "Sem desconto"}
                    </Read>
                    <Read label="Total">{formatMoney(totals.total)}</Read>
                  </div>
                  <div className={styles.pair}>
                    <Read label="Parcelas">{draft.installments > 1 ? `${draft.installments}x de ${formatMoney(totals.installment)}` : "À vista"}</Read>
                    <Read label="Desconto à vista">{draft.cashDiscount > 0 ? `${draft.cashDiscount}%, ${formatMoney(totals.cash)}` : "Não há"}</Read>
                  </div>
                  <Read label="Formas de pagamento">{methodNames || "Falta escolher"}</Read>
                  {values.notes && <Read label="Observações">{values.notes}</Read>}
                </>
              }
            >
              <div className={styles.discount}>
                <Switch size="sm" checked={values.discountOn} disabled={saving !== null} onChange={(event) => set("discountOn", event.target.checked)}>
                  Aplicar desconto
                </Switch>
                {values.discountOn && (
                  <div className={styles.pair}>
                    <Field label="Tipo">
                      <Select label="Tipo de desconto" options={discountOptions} value={values.discountKind} disabled={saving !== null} onChange={(kind) => set("discountKind", kind)} />
                    </Field>
                    <Field label="Desconto" required error={errorOf("discount.value")}>
                      {values.discountKind === "percent" ? (
                        <Input
                          type="text"
                          mask="integerPercent"
                          value={values.discountValue}
                          placeholder="10"
                          inputMode="numeric"
                          disabled={saving !== null}
                          onChange={(event) => set("discountValue", onlyDigits(event.target.value))}
                        />
                      ) : (
                        <Input
                          type="text"
                          mask="currency"
                          value={values.discountValue}
                          placeholder="0,00"
                          disabled={saving !== null}
                          onChange={(event) => set("discountValue", onlyDigits(event.target.value))}
                        />
                      )}
                    </Field>
                  </div>
                )}
              </div>
              <div className={styles.pair}>
                <Field label="Parcelas" required error={errorOf("installments")}>
                  <Input
                    type="text"
                    mask="integer"
                    value={values.installments}
                    placeholder="1"
                    inputMode="numeric"
                    disabled={saving !== null}
                    iconEnd={
                      <InstallmentsInfo installments={draft.installments} amount={totals.installment} issuedAt={values.issuedAt} onOpen={mobile ? () => setPlanOpen(true) : undefined} />
                    }
                    onChange={(event) => set("installments", onlyDigits(event.target.value))}
                  />
                </Field>
                <Field label="Desconto à vista" error={errorOf("cashDiscount")}>
                  <Input
                    type="text"
                    mask="integerPercent"
                    value={values.cashDiscount}
                    placeholder="5"
                    inputMode="numeric"
                    disabled={saving !== null}
                    onChange={(event) => set("cashDiscount", onlyDigits(event.target.value))}
                  />
                </Field>
              </div>
              {/* Mais de uma forma de pagamento (pedido de 2026-09-09): as quatro em caixas de marcar, porque
                  a escolha é múltipla e o seletor da casa é de uma opção só. */}
              <div className={styles.methodsField} role="group" aria-labelledby={`${titleId}-methods`}>
                <Text as="span" id={`${titleId}-methods`} variant="footnote" weight="medium">
                  Formas de pagamento
                </Text>
                <div className={styles.methods}>
                  {paymentMethodValues.map((method) => (
                    <Checkbox
                      key={method}
                      checked={values.paymentMethods.includes(method)}
                      disabled={saving !== null}
                      onChange={(event) => toggleMethod(method, event.target.checked)}
                    >
                      <Text as="span" variant="footnote">
                        {paymentMethods[method].label}
                      </Text>
                    </Checkbox>
                  ))}
                </div>
                {errorOf("paymentMethods") && (
                  <Text variant="footnote" tone="danger" role="alert">
                    {errorOf("paymentMethods")}
                  </Text>
                )}
              </div>
              <Field label="Observações" hint="Aparecem no documento" error={errorOf("notes")}>
                <Textarea
                  name="notes"
                  value={values.notes}
                  rows={3}
                  maxLength={quoteLimits.notes}
                  placeholder="Prazos, o que precisa chegar do cliente, o que fica de fora"
                  disabled={saving !== null}
                  onChange={(event) => set("notes", event.target.value)}
                />
              </Field>
            </Section>

            {error && !known && (
              <Text variant="footnote" tone="danger" role="alert" className={styles.alert}>
                {error.message}
              </Text>
            )}
          </div>
        )}

        {showPreview && (
          <div className={styles.preview}>
            {/* No celular a folha é reduzida só pela largura e rola na vertical (pedido de 2026-09-10): é a
                mesma A4 do PDF, na escala em que ela cabe na tela, e a pessoa desce por ela como num leitor
                de PDF. Caber inteira na altura de uma tela de celular deixava o documento ilegível. */}
            <QuotePaper fit={mobile ? "width" : "contain"}>
              <QuoteDocument quote={draft} variant="preview" />
            </QuotePaper>
          </div>
        )}
      </div>

      {/* As bandejas do celular (pedido de 2026-09-10): o item em edição, com os mesmos campos do cartão aberto
          do desktop, e a ficha de margem e condições. Escurecem a página por baixo para o toque na barra
          flutuante, que fica acima delas, não fechar a bandeja como toque fora. Concluir e Fechar moram na
          barra, que é o botão de ação do celular. */}
      {mobile && (
        <Dialog open={lineSheet !== null} onClose={() => setLineSheet(null)} label="Item do orçamento" size="md" surface="glass" scrim focusOnOpen={false}>
          {sheetLine && (
            <div className={styles.sheet}>
              {lineHead(
                sheetLine,
                sheetIndex,
                catalogOf(sheetLine.catalogItemId),
                <IconButton label="Concluir" variant="ghost" size="sm" radius="md" className={styles.tiny} onClick={() => setLineSheet(null)}>
                  <XIcon />
                </IconButton>,
              )}
              <div className={styles.sheetBody}>{lineFields(sheetLine, sheetIndex)}</div>
            </div>
          )}
        </Dialog>
      )}
      {mobile && (
        <Dialog open={planOpen} onClose={() => setPlanOpen(false)} label="Parcelas" size="sm" surface="glass" scrim focusOnOpen={false}>
          <div className={styles.sheetBody}>
            <InstallmentPlan installments={draft.installments} amount={totals.installment} issuedAt={values.issuedAt} />
          </div>
        </Dialog>
      )}
      {mobile && (
        <Dialog open={infoLine !== null} onClose={() => setInfoLine(null)} label="Margem e condições" size="sm" surface="glass" scrim focusOnOpen={false}>
          {infoTarget && infoSource && (
            <div className={styles.sheetBody}>
              <QuoteLineFacts item={infoSource} unitPrice={Number(infoTarget.unitPrice || 0)} quantity={Number(infoTarget.quantity || 0)} />
            </div>
          )}
        </Dialog>
      )}

      {/* A confirmação de sair com algo mexido: janela no desktop e bandeja no celular, pelo `Dialog` da casa.
          Ela abre por cima do editor, então entra na fila de camadas e responde ao Escape antes dele. No
          celular salvar e continuar editando estão na barra flutuante, pelo `confirmActions`. */}
      <QuoteDiscardDialog
        open={confirmingClose}
        editing={editing}
        number={draft.number}
        pending={saving === "draft"}
        mobile={mobile}
        onCancel={() => setConfirmingClose(false)}
        onDiscard={() => {
          setConfirmingClose(false);
          onClose();
        }}
        onSave={() => void saveAndClose()}
      />
    </form>
  );
}
