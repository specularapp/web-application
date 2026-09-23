"use client";

import { CheckIcon, ImageSquareIcon, UploadSimpleIcon, XIcon } from "@phosphor-icons/react";
import { addDays, addMonths, format, parseISO } from "date-fns";
import { useEffect, useId, useRef, useState, type RefObject } from "react";
import { useFloatingActionsRegistration } from "@/components/layout/floating-actions";
import { useToast } from "@/components/providers/toast-provider";
import { SOURCE_MAX_BYTES } from "@/lib/images/compress";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Dialog, DialogFooter } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Text } from "@/components/ui/text";
import { Textarea } from "@/components/ui/textarea";
import { MOBILE_QUERY, useMediaQuery } from "@/hooks/use-media-query";
import { uploadImage } from "@/features/uploads/upload";
import { onlyDigits } from "@/lib/masks";
import { formatMoney } from "@/lib/utils/format";
import { createChargeAction } from "../actions";
import { chargeMethods, recurrenceLabels, shortDate } from "../labels";
import { chargeLimits, chargeMethodValues, chargeRecurrenceValues } from "../schemas";
import type { ChargeLookups } from "../service";
import { type Charge, type ChargeDirection, type ChargeMethod, type ChargeRecurrence } from "../summary";
import { callAction } from "@/lib/action";
import styles from "./new-charge-dialog.module.css";

export type NewChargeDialogProps = {
  open: boolean;
  lookups: ChargeLookups;
  /** De quem é a cobrança, quando ela nasce da ficha de um cliente: o campo já vem escolhido. */
  clientId?: string;
  /** Em que lado ela abre: o da lista que está à vista, para o "+" de "A pagar" não abrir uma cobrança. */
  direction?: ChargeDirection;
  onClose: () => void;
  onCreated: (charge: Charge) => void;
};

type Values = { direction: ChargeDirection; partyName: string; quoteId: string | null; clientId: string | null; title: string; description: string; amount: string; installments: number; firstDueDate: string; method: ChargeMethod; paymentInfo: string; notes: string; recurrence: ChargeRecurrence };

const blank = (clientId: string | null = null, direction: ChargeDirection = "incoming"): Values => ({ direction, partyName: "", quoteId: null, clientId, title: "", description: "", amount: "", installments: 1, firstDueDate: format(addDays(new Date(), 7), "yyyy-MM-dd"), method: "pix", paymentInfo: "", notes: "", recurrence: "none" });

const installmentOptions = Array.from({ length: chargeLimits.installments }, (_, index) => ({ value: index + 1, label: index === 0 ? "À vista" : `${index + 1} parcelas` }));

const methodOptions = chargeMethodValues.map((value) => ({ value, label: chargeMethods[value].label }));

const NO_QUOTE = "__none__";

/* A cobrança avulsa: não é de ninguém da base. Entra como a primeira opção do seletor de quem paga, e não
   como um interruptor à parte, porque é a mesma pergunta ("de quem é esta cobrança?") com uma resposta a
   mais, e não uma segunda decisão. */
const NO_CLIENT = "__avulsa__";

const recurrenceOptions = chargeRecurrenceValues.map((value) => ({ value, label: recurrenceLabels[value] }));

// A gaveta de nova cobrança (2026-09-15): nasce de um orçamento aprovado, que já traz o cliente, o título, o
// valor e as parcelas, ou do zero. Cliente com busca e rosto, título, descrição, valor, quantas parcelas e o
// primeiro vencimento (as outras caem mês a mês), a forma de pagar com as instruções que o cliente vê, e as
// observações. Embaixo, as parcelas como vão ficar. Salva no servidor e abre a ficha.
export function NewChargeDialog({ open, lookups, clientId, direction = "incoming", onClose, onCreated }: NewChargeDialogProps) {
  const mobile = useMediaQuery(MOBILE_QUERY);
  const savingRef = useRef(false);
  const close = () => {
    if (!savingRef.current) onClose();
  };
  return (
    <Dialog open={open} onClose={close} label={direction === "outgoing" ? "Nova despesa" : "Nova cobrança"} size="md" placement="end" surface="page" scrim={mobile} focusOnOpen={false}>
      <ChargeForm lookups={lookups} clientId={clientId} direction={direction} onClose={onClose} onCreated={onCreated} savingRef={savingRef} />
    </Dialog>
  );
}

function ChargeForm({ lookups, clientId, direction = "incoming", onClose, onCreated, savingRef }: Omit<NewChargeDialogProps, "open"> & { savingRef: RefObject<boolean> }) {
  const { toast } = useToast();
  const titleId = useId();
  const [values, setValues] = useState<Values>(() => blank(clientId ?? null, direction));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<{ message: string; field?: string } | null>(null);

  /* A foto sobe **depois** de a cobrança existir: o arquivo mora numa pasta com o id dela, e na criação esse
     id só aparece agora. Até lá o que a tela mostra é um endereço local, que só vale nesta aba. */
  const fileInput = useRef<HTMLInputElement>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);

  useEffect(
    () => () => {
      if (imageUrl?.startsWith("blob:")) URL.revokeObjectURL(imageUrl);
    },
    [imageUrl],
  );

  const pickImage = (file: File | null) => {
    if (file && file.size > SOURCE_MAX_BYTES) {
      toast({ title: "Imagem grande demais", description: "A foto passa de 25 MB. Escolha uma menor.", tone: "warning" });
      return;
    }
    if (imageUrl?.startsWith("blob:")) URL.revokeObjectURL(imageUrl);
    setImageUrl(file ? URL.createObjectURL(file) : null);
    setImageFile(file);
  };

  const set = <K extends keyof Values>(key: K, value: Values[K]) => setValues((current) => ({ ...current, [key]: value }));

  const quoteOptions = [{ value: NO_QUOTE, label: "Sem orçamento", caption: "Cobrança avulsa" }, ...lookups.quotes.map((quote) => ({ value: quote.id, label: quote.number, caption: `${quote.title}, ${formatMoney(quote.amount)}` }))];
  const outgoing = values.direction === "outgoing";
  const availableClients = outgoing ? lookups.suppliers : lookups.customers;
  const selectedClient = availableClients.find((client) => client.id === values.clientId);
  const clientOptions = availableClients.map((client) => ({
    value: client.id,
    label: client.company ?? client.name,
    caption: client.company ? client.name : (client.email ?? undefined),
    media: <Avatar name={client.name} src={client.avatarUrl ?? undefined} size="xs" shape="rounded" />,
  }));

  /* Escolher o orçamento preenche o que ele sabe; trocar para "sem orçamento" só solta o vínculo. */
  const chooseQuote = (value: string) => {
    if (value === NO_QUOTE) {
      set("quoteId", null);
      return;
    }
    const quote = lookups.quotes.find((entry) => entry.id === value);
    if (!quote) return;
    setValues((current) => ({ ...current, quoteId: quote.id, clientId: quote.clientId ?? current.clientId, title: current.title || quote.title, amount: String(quote.amount), installments: quote.installments }));
  };

  const amount = Number(values.amount || 0);
  const perInstallment = values.installments > 0 ? Math.floor(amount / values.installments) : 0;
  const preview = Array.from({ length: values.installments }, (_, index) => ({
    number: index + 1,
    amount: index === values.installments - 1 ? amount - perInstallment * (values.installments - 1) : perInstallment,
    dueDate: format(addMonths(parseISO(values.firstDueDate), index), "yyyy-MM-dd"),
  }));

  const save = async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError(null);
    const result = await callAction(
      createChargeAction({
        direction: values.direction,
        partyName: values.clientId ? "" : values.partyName,
        clientId: values.clientId,
        recurrence: values.recurrence,
        title: values.title,
        description: values.description,
        amount,
        installments: values.installments,
        firstDueDate: values.firstDueDate,
        method: values.method,
        paymentInfo: values.paymentInfo,
        notes: values.notes,
        quoteId: values.quoteId,
      }),
    );
    if (!result.ok) {
      savingRef.current = false;
      setSaving(false);
      setError({ message: result.error, field: result.field });
      return;
    }
    /* A foto vai depois do salvamento, e não junto: falha dela não desfaz a cobrança, que já está gravada. */
    if (imageFile) {
      try {
        const sent = await uploadImage("charge-image", result.charge.id, imageFile);
        if (!sent.ok) toast({ title: `${outgoing ? "Despesa" : "Cobrança"} criada, foto não`, description: sent.error, tone: "warning" });
      } catch {
        /* A cobrança já existe; uma imagem que falhou não pode deixar o botão preso nem induzir uma segunda
           criação. A ficha abre normalmente e a pessoa recebe o aviso específico. */
        toast({ title: `${outgoing ? "Despesa" : "Cobrança"} criada, foto não`, description: "Não foi possível preparar a imagem.", tone: "warning" });
      }
    }

    savingRef.current = false;
    setSaving(false);
    toast({
      title: `${outgoing ? "Despesa" : "Cobrança"} criada`,
      description: outgoing ? `${result.charge.reference} já está no controle de contas a pagar.` : `${result.charge.reference} nasceu em aberto. Envie por e-mail quando quiser.`,
      tone: "success",
      feedback: selectedClient
        ? {
            visual: <Avatar name={selectedClient.name} src={selectedClient.avatarUrl ?? undefined} size="lg" shape="rounded" />,
            confetti: true,
          }
        : undefined,
    });
    onCreated(result.charge);
  };

  const close = () => {
    if (!savingRef.current) onClose();
  };

  useFloatingActionsRegistration({
    primary: { label: saving ? "Criando" : `Criar ${outgoing ? "despesa" : "cobrança"}`, icon: <CheckIcon weight="bold" />, loading: saving, onClick: () => void save() },
    cancel: { label: "Fechar", onClick: close },
  });

  return (
    <div className={styles.drawer} aria-labelledby={titleId}>
      <header className={styles.head}>
        <div className={styles.heading}>
          <Text as="h2" id={titleId} variant="headline" weight="semibold">
            {outgoing ? "Nova despesa" : "Nova cobrança"}
          </Text>
        </div>
        <IconButton label="Fechar" variant="ghost" size="sm" disabled={saving} onClick={close}>
          <XIcon />
        </IconButton>
      </header>

      <div className={styles.body}>
        {/* Despesa não nasce de orçamento: orçamento é o que a equipe cobra. */}
        {!outgoing && (
          <Field label="Orçamento aprovado">
            <Select<string> label="Orçamento de origem" size="sm" options={quoteOptions} value={values.quoteId ?? NO_QUOTE} searchable searchPlaceholder="Buscar orçamento" onChange={chooseQuote} />
          </Field>
        )}

        <Field label={outgoing ? "Fornecedor" : "Quem paga"} error={error?.field === "clientId" ? error.message : undefined}>
          <Select<string>
            label={outgoing ? "Fornecedor" : "Quem paga"}
            size="sm"
            options={[{ value: NO_CLIENT, label: outgoing ? "Despesa avulsa" : "Cobrança avulsa", caption: outgoing ? "Fornecedor ainda não cadastrado" : "Contato fora da base" }, ...clientOptions]}
            value={values.clientId ?? NO_CLIENT}
            searchable
            searchPlaceholder={outgoing ? "Buscar fornecedor" : "Buscar cliente"}
            invalid={error?.field === "clientId"}
            onChange={(value) => setValues((current) => ({ ...current, clientId: value === NO_CLIENT ? null : value, partyName: value === NO_CLIENT ? current.partyName : "" }))}
          />
        </Field>
        {outgoing && !values.clientId && (
          <Field label="Nome do fornecedor" error={error?.field === "partyName" ? error.message : undefined}>
            <Input type="text" size="sm" value={values.partyName} maxLength={80} placeholder="Para quem a equipe paga" invalid={error?.field === "partyName"} onChange={(event) => set("partyName", event.target.value)} />
          </Field>
        )}
        <Field label="Título" required error={error?.field === "title" ? error.message : undefined}>
          <Input type="text" size="sm" value={values.title} maxLength={chargeLimits.title} placeholder={outgoing ? "Do que é a despesa" : "Do que é a cobrança"} invalid={error?.field === "title"} onChange={(event) => set("title", event.target.value)} />
        </Field>
        <Field label="Descrição">
          <Input type="text" size="sm" value={values.description} maxLength={chargeLimits.description} placeholder="Uma frase que aparece para o cliente" onChange={(event) => set("description", event.target.value)} />
        </Field>

        {/* A foto do que está sendo cobrado. Aparece no link de quem paga, e é o que separa "Assinatura do
            sistema" de "Serviço de manutenção" numa lista de avulsas, que sem cliente ficariam iguais. */}
        <Field label="Foto">
          <div className={styles.photo}>
            <span className={styles.photoFrame}>
              {imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- é o arquivo que a pessoa acabou de escolher, num endereço local que o next/image não busca
                <img src={imageUrl} alt="" className={styles.photoImage} />
              ) : (
                <ImageSquareIcon weight="duotone" aria-hidden="true" />
              )}
            </span>
            <div className={styles.photoActions}>
              <Button variant="outline" size="sm" radius="md" iconStart={<UploadSimpleIcon />} disabled={saving} onClick={() => fileInput.current?.click()}>
                {imageUrl ? "Trocar" : "Enviar"}
              </Button>
              {imageUrl && (
                <IconButton label="Remover foto" variant="ghost" size="sm" radius="md" disabled={saving} onClick={() => pickImage(null)}>
                  <XIcon />
                </IconButton>
              )}
            </div>
            <input
              ref={fileInput}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/avif"
              className={styles.fileInput}
              aria-label="Enviar foto da cobrança"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                event.target.value = "";
                pickImage(file);
              }}
            />
          </div>
        </Field>
        <div className={styles.pair}>
          <Field label="Valor total" required error={error?.field === "amount" ? error.message : undefined}>
            <Input type="text" size="sm" mask="currency" inputMode="numeric" value={values.amount} placeholder="0,00" invalid={error?.field === "amount"} onChange={(event) => set("amount", onlyDigits(event.target.value))} />
          </Field>
          <Field label="Parcelas">
            <Select<number> label="Quantas parcelas" size="sm" options={installmentOptions} value={values.installments} onChange={(installments) => set("installments", installments)} />
          </Field>
        </div>
        <div className={styles.pair}>
          <Field label={values.installments > 1 ? "Primeiro vencimento" : "Vencimento"} required>
            <DatePicker size="sm" value={parseISO(values.firstDueDate)} onChange={(date) => set("firstDueDate", format(date ?? new Date(), "yyyy-MM-dd"))} />
          </Field>
          <Field label="Forma">
            <Select<ChargeMethod> label="Forma de pagamento" size="sm" options={methodOptions} value={values.method} onChange={(value) => set("method", value)} />
          </Field>
        </div>
        {/* Repetir: a próxima nasce quando esta fecha, e não por relógio. Assim ninguém acumula doze
            cobranças abertas de uma assinatura que o pagador parou de pagar. */}
        <Field label="Repetir">
          <Select<ChargeRecurrence> label="Com que frequência se repete" size="sm" options={recurrenceOptions} value={values.recurrence} onChange={(value) => set("recurrence", value)} />
        </Field>
        <Field label="Como pagar">
          <Textarea size="sm" rows={2} value={values.paymentInfo} maxLength={chargeLimits.paymentInfo} placeholder={values.method === "pix" ? "Chave Pix: contato@empresa.com" : "O que o cliente precisa para pagar"} onChange={(event) => set("paymentInfo", event.target.value)} />
        </Field>
        <Field label="Observações">
          <Textarea size="sm" rows={2} value={values.notes} maxLength={chargeLimits.notes} onChange={(event) => set("notes", event.target.value)} />
        </Field>

        {amount > 0 && (
          <section className={styles.preview} aria-label="Como as parcelas vão ficar">
            <Text as="h3" variant="caption1" weight="semibold" tone="secondary" className={styles.previewTitle}>
              Como fica
            </Text>
            <ul className={styles.previewList}>
              {preview.map((installment) => (
                <li key={installment.number} className={styles.previewItem}>
                  <Text as="span" variant="footnote" tone="secondary">
                    {values.installments > 1 ? `Parcela ${installment.number}` : "Parcela única"}, {shortDate(installment.dueDate)}
                  </Text>
                  <Text as="span" variant="footnote" weight="semibold" numeric>
                    {formatMoney(installment.amount)}
                  </Text>
                </li>
              ))}
            </ul>
          </section>
        )}

        {error && (
          <Text variant="footnote" tone="danger" role="alert">
            {error.message}
          </Text>
        )}
      </div>

      <DialogFooter>
        <Button variant="outline" size="sm" radius="md" disabled={saving} onClick={close}>
          Cancelar
        </Button>
        <Button size="sm" radius="md" iconStart={<CheckIcon />} loading={saving} onClick={() => void save()}>
          {saving ? "Criando" : `Criar ${outgoing ? "despesa" : "cobrança"}`}
        </Button>
      </DialogFooter>
    </div>
  );
}
