"use client";

import { CheckIcon, XIcon } from "@phosphor-icons/react";
import { addDays, addMonths, format, parseISO } from "date-fns";
import { useId, useState } from "react";
import { useFloatingActionsRegistration } from "@/components/layout/floating-actions";
import { useToast } from "@/components/providers/toast-provider";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Text } from "@/components/ui/text";
import { Textarea } from "@/components/ui/textarea";
import { MOBILE_QUERY, useMediaQuery } from "@/hooks/use-media-query";
import { onlyDigits } from "@/lib/masks";
import { formatMoney } from "@/lib/utils/format";
import { createChargeAction } from "../actions";
import { chargeMethods, shortDate } from "../labels";
import { chargeLimits, chargeMethodValues } from "../schemas";
import type { ChargeLookups } from "../service";
import type { Charge, ChargeMethod } from "../summary";
import styles from "./new-charge-dialog.module.css";

export type NewChargeDialogProps = {
  open: boolean;
  lookups: ChargeLookups;
  onClose: () => void;
  onCreated: (charge: Charge) => void;
};

type Values = { quoteId: string | null; clientId: string | null; title: string; description: string; amount: string; installments: number; firstDueDate: string; method: ChargeMethod; paymentInfo: string; notes: string };

const blank = (): Values => ({ quoteId: null, clientId: null, title: "", description: "", amount: "", installments: 1, firstDueDate: format(addDays(new Date(), 7), "yyyy-MM-dd"), method: "pix", paymentInfo: "", notes: "" });

const installmentOptions = Array.from({ length: 12 }, (_, index) => ({ value: index + 1, label: index === 0 ? "À vista" : `${index + 1} parcelas` }));

const methodOptions = chargeMethodValues.map((value) => ({ value, label: chargeMethods[value].label }));

const NO_QUOTE = "__none__";

// A gaveta de nova cobrança (2026-09-15): nasce de um orçamento aprovado, que já traz o cliente, o título, o
// valor e as parcelas, ou do zero. Cliente com busca e rosto, título, descrição, valor, quantas parcelas e o
// primeiro vencimento (as outras caem mês a mês), a forma de pagar com as instruções que o cliente vê, e as
// observações. Embaixo, as parcelas como vão ficar. Salva no servidor e abre a ficha.
export function NewChargeDialog({ open, lookups, onClose, onCreated }: NewChargeDialogProps) {
  const mobile = useMediaQuery(MOBILE_QUERY);
  return (
    <Dialog open={open} onClose={onClose} label="Nova cobrança" size="md" placement="end" surface="page" scrim={mobile} focusOnOpen={false}>
      <ChargeForm lookups={lookups} onClose={onClose} onCreated={onCreated} />
    </Dialog>
  );
}

function ChargeForm({ lookups, onClose, onCreated }: Omit<NewChargeDialogProps, "open">) {
  const { toast } = useToast();
  const titleId = useId();
  const [values, setValues] = useState<Values>(blank);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<{ message: string; field?: string } | null>(null);

  const set = <K extends keyof Values>(key: K, value: Values[K]) => setValues((current) => ({ ...current, [key]: value }));

  const quoteOptions = [{ value: NO_QUOTE, label: "Sem orçamento", caption: "Cobrança avulsa" }, ...lookups.quotes.map((quote) => ({ value: quote.id, label: quote.number, caption: `${quote.title}, ${formatMoney(quote.amount)}` }))];
  const clientOptions = lookups.clients.map((client) => ({
    value: client.id,
    label: client.company ?? client.name,
    caption: client.company ? client.name : (client.email ?? undefined),
    media: <Avatar name={client.name} src={client.avatarUrl ?? undefined} size="xs" shape="squircle" />,
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
    setSaving(true);
    setError(null);
    const result = await createChargeAction({
      clientId: values.clientId,
      title: values.title,
      description: values.description,
      amount,
      installments: values.installments,
      firstDueDate: values.firstDueDate,
      method: values.method,
      paymentInfo: values.paymentInfo,
      notes: values.notes,
      quoteId: values.quoteId,
    });
    setSaving(false);
    if (!result.ok) {
      setError({ message: result.error, field: result.field });
      return;
    }
    toast({ title: "Cobrança criada", description: `${result.charge.reference} nasceu em aberto. Envie por e-mail quando quiser.`, tone: "success" });
    onCreated(result.charge);
  };

  useFloatingActionsRegistration({
    primary: { label: saving ? "Criando" : "Criar cobrança", icon: <CheckIcon weight="bold" />, loading: saving, onClick: () => void save() },
    cancel: { label: "Fechar", onClick: onClose },
  });

  const method = chargeMethods[values.method];

  return (
    <div className={styles.drawer} aria-labelledby={titleId}>
      <header className={styles.head}>
        <div className={styles.heading}>
          <Text as="h2" id={titleId} variant="headline" weight="semibold">
            Nova cobrança
          </Text>
          <Text variant="footnote" tone="secondary">
            De um orçamento aprovado ou do zero, em uma ou mais parcelas.
          </Text>
        </div>
        <IconButton label="Fechar" variant="ghost" size="sm" disabled={saving} onClick={onClose}>
          <XIcon />
        </IconButton>
      </header>

      <div className={styles.body}>
        <Field label="Orçamento aprovado" hint="Traz o cliente, o título, o valor e as parcelas">
          <Select<string> label="Orçamento de origem" size="sm" options={quoteOptions} value={values.quoteId ?? NO_QUOTE} searchable searchPlaceholder="Buscar orçamento" onChange={chooseQuote} />
        </Field>
        <Field label="Cliente" required error={error?.field === "clientId" ? error.message : undefined}>
          <Select<string> label="Quem paga" size="sm" options={clientOptions} value={values.clientId ?? undefined} placeholder="Escolha o cliente" searchable searchPlaceholder="Buscar cliente" invalid={error?.field === "clientId"} onChange={(clientId) => set("clientId", clientId)} />
        </Field>
        <Field label="Título" required error={error?.field === "title" ? error.message : undefined}>
          <Input type="text" size="sm" value={values.title} maxLength={chargeLimits.title} placeholder="Do que é a cobrança" invalid={error?.field === "title"} onChange={(event) => set("title", event.target.value)} />
        </Field>
        <Field label="Descrição">
          <Input type="text" size="sm" value={values.description} maxLength={chargeLimits.description} placeholder="Uma frase que aparece para o cliente" onChange={(event) => set("description", event.target.value)} />
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
        <Field label="Como pagar" hint={method.hint}>
          <Textarea size="sm" rows={2} value={values.paymentInfo} maxLength={chargeLimits.paymentInfo} placeholder={values.method === "pix" ? "Chave Pix: contato@empresa.com" : "O que o cliente precisa para pagar"} onChange={(event) => set("paymentInfo", event.target.value)} />
        </Field>
        <Field label="Observações" hint="Só a equipe vê">
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

        {error && !error.field && (
          <Text variant="footnote" tone="danger" role="alert">
            {error.message}
          </Text>
        )}
      </div>

      <footer className={styles.foot}>
        <Button variant="outline" size="sm" radius="md" disabled={saving} onClick={onClose}>
          Cancelar
        </Button>
        <Button size="sm" radius="md" iconStart={<CheckIcon />} loading={saving} onClick={() => void save()}>
          {saving ? "Criando" : "Criar cobrança"}
        </Button>
      </footer>
    </div>
  );
}
