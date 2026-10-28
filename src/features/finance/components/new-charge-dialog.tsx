"use client";

import { CheckIcon } from "@phosphor-icons/react";
import { addDays, addMonths, format, parseISO } from "date-fns";
import { useId, useRef, useState, type RefObject } from "react";
import { useFloatingActionsRegistration } from "@/components/layout/floating-actions";
import { useToast } from "@/components/providers/toast-provider";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Text } from "@/components/ui/text";
import { VisuallyHidden } from "@/components/ui/visually-hidden";
import { formWindow, FormWindowPart as Part } from "@/components/ui/form-window";
import { onlyDigits } from "@/lib/masks";
import { createChargeAction } from "../actions";
import { recurrenceLabels } from "../labels";
import { chargeLimits, chargeMethodValues, chargeRecurrenceValues } from "../schemas";
import type { ChargeLookups } from "../service";
import { type Charge, type ChargeDirection, type ChargeMethod, type ChargeRecurrence } from "../summary";
import { callAction } from "@/lib/action";
import { AccountMark } from "./account-mark";
import { ChargePreview } from "./charge-preview";
import { emptyOptionMedia, installmentsMedia, methodOption, OptionIcon, optionGlyphs, recurrenceMedia } from "./option-icon";
import local from "./settle-dialog.module.css";
import windowStyles from "./transfer-dialog.module.css";

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

type Values = { direction: ChargeDirection; partyName: string; quoteId: string | null; clientId: string | null; title: string; description: string; amount: string; installments: number; firstDueDate: string; method: ChargeMethod; paymentInfo: string; notes: string; recurrence: ChargeRecurrence; categoryId: string; accountId: string };

const blank = (clientId: string | null = null, direction: ChargeDirection = "incoming"): Values => ({ direction, partyName: "", quoteId: null, clientId, title: "", description: "", amount: "", installments: 1, firstDueDate: format(addDays(new Date(), 7), "yyyy-MM-dd"), method: "pix", paymentInfo: "", notes: "", recurrence: "none", categoryId: NO_CATEGORY, accountId: DEFAULT_ACCOUNT });

const NO_CATEGORY = "none";
const DEFAULT_ACCOUNT = "padrao";

const installmentOptions = Array.from({ length: chargeLimits.installments }, (_, index) => ({ value: index + 1, label: index === 0 ? "À vista" : `${index + 1} parcelas`, media: installmentsMedia(index + 1) }));

const methodOptions = chargeMethodValues.map(methodOption);

const NO_QUOTE = "__none__";

/* A cobrança avulsa: não é de ninguém da base. Entra como a primeira opção do seletor de quem paga, e não
   como um interruptor à parte, porque é a mesma pergunta ("de quem é esta cobrança?") com uma resposta a
   mais, e não uma segunda decisão. */
const NO_CLIENT = "__avulsa__";

const recurrenceOptions = chargeRecurrenceValues.map((value) => ({ value, label: recurrenceLabels[value], media: recurrenceMedia(value) }));

// A nova cobrança (2026-09-15): nasce de um orçamento aprovado, que já traz o cliente, o título, o valor e as
// parcelas, ou do zero. Desde 2026-10-27 (a pedido: "na mesma pegada") é a janela dupla da casa, como a de
// receber: sem cabeçalho, três seções numeradas (a cobrança, valor e vencimento, pagamento) e, à direita, o
// resumo dela em blocos com as parcelas como vão ficar. Era uma gaveta lateral. Salva no servidor e abre a ficha.
export function NewChargeDialog({ open, lookups, clientId, direction = "incoming", onClose, onCreated }: NewChargeDialogProps) {
  const savingRef = useRef(false);
  const close = () => {
    if (!savingRef.current) onClose();
  };
  return (
    <Dialog open={open} onClose={close} label={direction === "outgoing" ? "Nova despesa" : "Nova cobrança"} size="xl" surface="solid" focusOnOpen={false} className={`${formWindow.window} ${windowStyles.window}`}>
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

  const set = <K extends keyof Values>(key: K, value: Values[K]) => setValues((current) => ({ ...current, [key]: value }));

  /* Uma linha por opção, sem a segunda embaixo (2026-10-27, a pedido: "tudo precisa ter o mesmo tamanho"): o
     seletor fechado fica da altura dos outros campos. */
  const quoteOptions = [
    { value: NO_QUOTE, label: "Sem orçamento", media: emptyOptionMedia(optionGlyphs.noQuote) },
    ...lookups.quotes.map((quote) => ({ value: quote.id, label: `${quote.title} (${quote.number})`, media: <OptionIcon icon={optionGlyphs.quote} hue="orange" /> })),
  ];
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
        categoryId: values.categoryId === NO_CATEGORY ? null : values.categoryId,
        accountId: values.accountId === DEFAULT_ACCOUNT ? null : values.accountId,
      }),
    );
    if (!result.ok) {
      savingRef.current = false;
      setSaving(false);
      setError({ message: result.error, field: result.field });
      return;
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
    <>
      <div className={`${formWindow.formCard} ${local.card}`} aria-labelledby={titleId}>
        <VisuallyHidden as="h2" id={titleId}>
          {outgoing ? "Nova despesa" : "Nova cobrança"}
        </VisuallyHidden>

        <div className={formWindow.body}>
          {/* Três seções, uma pergunta cada (2026-10-27, a pedido: "muita coisa inútil e mal segmentado"): a foto, a
              descrição e as observações saíram; o que sobrou é o que a cobrança precisa para existir e ser paga. */}
          <Part number={1} title={outgoing ? "A despesa" : "A cobrança"}>
            {/* Despesa não nasce de orçamento: orçamento é o que a equipe cobra. */}
            {!outgoing && (
              <Field className={local.field} label="Orçamento aprovado">
                <Select<string> label="Orçamento de origem" size="sm" options={quoteOptions} value={values.quoteId ?? NO_QUOTE} searchable searchPlaceholder="Buscar orçamento" onChange={chooseQuote} />
              </Field>
            )}
            <Field className={local.field} label="Título" required error={error?.field === "title" ? error.message : undefined}>
              <Input type="text" size="sm" value={values.title} maxLength={chargeLimits.title} placeholder={outgoing ? "Do que é a despesa" : "Do que é a cobrança"} invalid={error?.field === "title"} onChange={(event) => set("title", event.target.value)} />
            </Field>
            <div className={formWindow.pair}>
              <Field className={local.field} label={outgoing ? "Fornecedor" : "Quem paga"} error={error?.field === "clientId" ? error.message : undefined}>
                <Select<string>
                  label={outgoing ? "Fornecedor" : "Quem paga"}
                  size="sm"
                  options={[{ value: NO_CLIENT, label: outgoing ? "Despesa avulsa" : "Cobrança avulsa", media: emptyOptionMedia(optionGlyphs.standalone) }, ...clientOptions.map(({ caption: _caption, ...option }) => option)]}
                  value={values.clientId ?? NO_CLIENT}
                  searchable
                  searchPlaceholder={outgoing ? "Buscar fornecedor" : "Buscar cliente"}
                  invalid={error?.field === "clientId"}
                  onChange={(value) => setValues((current) => ({ ...current, clientId: value === NO_CLIENT ? null : value, partyName: value === NO_CLIENT ? current.partyName : "" }))}
                />
              </Field>
              <Field className={local.field} label="Categoria">
                <Select<string>
                  label="Categoria"
                  size="sm"
                  options={[
                    { value: NO_CATEGORY, label: "Sem categoria", media: emptyOptionMedia() },
                    ...lookups.categories.filter((category) => category.kind === (outgoing ? "expense" : "income")).map((category) => ({ value: category.id, label: category.name, media: <OptionIcon icon={optionGlyphs.category} hue={category.hue} /> })),
                  ]}
                  value={values.categoryId}
                  onChange={(value) => set("categoryId", value)}
                />
              </Field>
            </div>
            {outgoing && !values.clientId && (
              <Field className={local.field} label="Nome do fornecedor" error={error?.field === "partyName" ? error.message : undefined}>
                <Input type="text" size="sm" value={values.partyName} maxLength={80} placeholder="Para quem a equipe paga" invalid={error?.field === "partyName"} onChange={(event) => set("partyName", event.target.value)} />
              </Field>
            )}
          </Part>

          <Part number={2} title="Valor e vencimento">
            <div className={formWindow.pair}>
              <Field className={local.field} label="Valor total" required error={error?.field === "amount" ? error.message : undefined}>
                <Input type="text" size="sm" mask="currency" inputMode="numeric" value={values.amount} placeholder="0,00" invalid={error?.field === "amount"} onChange={(event) => set("amount", onlyDigits(event.target.value))} />
              </Field>
              <Field className={local.field} label="Parcelas">
                <Select<number> label="Quantas parcelas" size="sm" options={installmentOptions} value={values.installments} onChange={(installments) => set("installments", installments)} />
              </Field>
            </div>
            <div className={formWindow.pair}>
              <Field className={local.field} label={values.installments > 1 ? "Primeiro vencimento" : "Vencimento"} required>
                <DatePicker size="sm" value={parseISO(values.firstDueDate)} onChange={(date) => set("firstDueDate", format(date ?? new Date(), "yyyy-MM-dd"))} />
              </Field>
              {/* Repetir: a próxima nasce quando esta fecha, e não por relógio. Assim ninguém acumula doze
                  cobranças abertas de uma assinatura que o pagador parou de pagar. */}
              <Field className={local.field} label="Repetir">
                <Select<ChargeRecurrence> label="Com que frequência se repete" size="sm" options={recurrenceOptions} value={values.recurrence} onChange={(value) => set("recurrence", value)} />
              </Field>
            </div>
          </Part>

          <Part number={3} title="Pagamento">
            {/* A forma e a conta onde o dinheiro cai ou de onde sai (2026-10-27): a baixa de cada parcela herda a
                conta, e é o que alimenta o extrato. As instruções só na cobrança, que tem o link do cliente. */}
            <div className={formWindow.pair}>
              <Field className={local.field} label="Forma">
                <Select<ChargeMethod> label="Forma de pagamento" size="sm" options={methodOptions} value={values.method} onChange={(value) => set("method", value)} />
              </Field>
              <Field className={local.field} label={outgoing ? "Conta de saída" : "Conta de entrada"}>
                <Select<string>
                  label="Conta"
                  size="sm"
                  options={[
                    { value: DEFAULT_ACCOUNT, label: "A conta padrão", media: <OptionIcon icon={optionGlyphs.account} hue="gray" /> },
                    ...lookups.accounts.filter((account) => account.active).map((account) => ({ value: account.id, label: account.name, media: <AccountMark account={account} /> })),
                  ]}
                  value={values.accountId}
                  onChange={(value) => set("accountId", value)}
                />
              </Field>
            </div>
            {!outgoing && (
              <Field className={local.field} label="Instruções para o cliente">
                <Input type="text" size="sm" value={values.paymentInfo} maxLength={chargeLimits.paymentInfo} placeholder={values.method === "pix" ? "Chave Pix: contato@empresa.com" : "O que o cliente precisa para pagar"} onChange={(event) => set("paymentInfo", event.target.value)} />
              </Field>
            )}
          </Part>

          {error && (
            <Text variant="footnote" tone="danger" role="alert" className={formWindow.alert}>
              {error.message}
            </Text>
          )}
        </div>

        <footer className={formWindow.cardFoot}>
          <Button variant="ghost" size="sm" radius="md" disabled={saving} onClick={close}>
            Cancelar
          </Button>
          <Button size="sm" radius="md" iconStart={<CheckIcon />} loading={saving} onClick={() => void save()}>
            {saving ? "Criando" : `Criar ${outgoing ? "despesa" : "cobrança"}`}
          </Button>
        </footer>
      </div>

      <aside className={formWindow.preview} aria-label={outgoing ? "Prévia da despesa" : "Prévia da cobrança"}>
        <ChargePreview
          draft={{
            direction: values.direction,
            party: selectedClient ? (selectedClient.company ?? selectedClient.name) : values.partyName.trim() || (outgoing ? "Despesa avulsa" : "Cobrança avulsa"),
            avatar: selectedClient ? { name: selectedClient.name, url: selectedClient.avatarUrl } : null,
            title: values.title.trim() || (outgoing ? "Do que é a despesa" : "Do que é a cobrança"),
            amount,
            method: values.method,
            recurrence: values.recurrence,
            account: values.accountId === DEFAULT_ACCOUNT ? "A conta padrão" : (lookups.accounts.find((account) => account.id === values.accountId)?.name ?? "A conta padrão"),
            category: (() => {
              const found = lookups.categories.find((category) => category.id === values.categoryId);
              return found ? { name: found.name, hue: found.hue } : null;
            })(),
            installments: preview,
          }}
        />
      </aside>
    </>
  );
}
