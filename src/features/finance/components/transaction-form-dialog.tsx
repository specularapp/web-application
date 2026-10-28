"use client";

import { CheckIcon } from "@phosphor-icons/react";
import { format, parseISO } from "date-fns";
import { useEffect, useId, useRef, useState, type RefObject } from "react";
import { useFloatingActionsRegistration } from "@/components/layout/floating-actions";
import { useToast } from "@/components/providers/toast-provider";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { formWindow, FormWindowPart as Part } from "@/components/ui/form-window";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Text } from "@/components/ui/text";
import { VisuallyHidden } from "@/components/ui/visually-hidden";
import { callAction } from "@/lib/action";
import { onlyDigits } from "@/lib/masks";
import { houseDay } from "@/lib/utils/day";
import { createTransactionAction } from "../actions";
import { loadFinanceLookupsAction, updateTransactionAction } from "../accounts-actions";
import { chargeMethods } from "../labels";
import type { FinanceLookups, MovementEntry } from "../movements";
import { transactionLimits } from "../schemas";
import type { ChargeMethod } from "../summary";
import { AccountMark } from "./account-mark";
import { emptyOptionMedia, methodOption, OptionIcon, optionGlyphs } from "./option-icon";
import { PaymentSheet } from "./payment-sheet";
import ticket from "./payment-sheet.module.css";
import local from "./settle-dialog.module.css";
import styles from "./transfer-dialog.module.css";

export type TransactionFormDialogProps = {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  /** A movimentação avulsa a editar (2026-10-27); sem ela, a janela lança uma nova. */
  editing?: MovementEntry | null;
};

type Kind = "income" | "expense";

type Values = { kind: Kind; title: string; description: string; amount: string; date: string; method: ChargeMethod | "none"; accountId: string; categoryId: string };

const NONE = "none";

const blank = (): Values => ({ kind: "expense", title: "", description: "", amount: "", date: houseDay(), method: NONE, accountId: "", categoryId: NONE });

const valuesOf = (entry: MovementEntry): Values => ({
  kind: entry.kind,
  title: entry.title,
  description: entry.description,
  amount: String(entry.amount),
  date: entry.date,
  method: entry.method ?? NONE,
  accountId: entry.accountId,
  categoryId: entry.categoryId ?? NONE,
});

const kindOptions = [
  { id: "income" as const, label: "Entrada" },
  { id: "expense" as const, label: "Saída" },
];

const methodOptions = [
  { value: NONE as ChargeMethod | "none", label: "Sem forma definida", media: emptyOptionMedia() },
  ...(Object.keys(chargeMethods) as ChargeMethod[]).map((value) => ({ ...methodOption(value), value: value as ChargeMethod | "none" })),
];

/**
 * Lançar ou editar uma movimentação avulsa (2026-10-27, a pedido: "a mesma pegada" da janela de receber), na
 * janela dupla da casa: sem cabeçalho, o lado (entrada ou saída) em dois botões no alto, uma seção para o que foi
 * e outra para como foi, e à direita o ticket do recibo, que acompanha cada campo. Era uma gaveta lateral.
 */
export function TransactionFormDialog({ open, onClose, onCreated, editing = null }: TransactionFormDialogProps) {
  const savingRef = useRef(false);
  const close = () => {
    if (!savingRef.current) onClose();
  };
  return (
    <Dialog open={open} onClose={close} label={editing ? "Editar movimentação" : "Nova movimentação"} size="xl" surface="solid" focusOnOpen={false} className={`${formWindow.window} ${styles.window}`}>
      {open && <TransactionForm key={editing?.id ?? "nova"} onClose={close} onCreated={onCreated} editing={editing} savingRef={savingRef} />}
    </Dialog>
  );
}

function TransactionForm({ onClose, onCreated, editing, savingRef }: Omit<TransactionFormDialogProps, "open"> & { savingRef: RefObject<boolean> }) {
  const { toast } = useToast();
  const titleId = useId();
  const [values, setValues] = useState<Values>(() => (editing ? valuesOf(editing) : blank()));
  const [lookups, setLookups] = useState<FinanceLookups | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* As contas e as categorias chegam ao abrir (2026-10-27): a janela mora em telas que não as carregam, e
     levar as duas para cada uma delas seria ler o banco sem ninguém ter pedido para lançar. */
  useEffect(() => {
    let alive = true;
    void callAction(loadFinanceLookupsAction()).then((result) => {
      if (!alive || !result.ok) return;
      setLookups(result.lookups);
      const fallback = result.lookups.accounts.find((account) => account.isDefault && account.active) ?? result.lookups.accounts.find((account) => account.active);
      setValues((current) => (current.accountId || !fallback ? current : { ...current, accountId: fallback.id }));
    });
    return () => {
      alive = false;
    };
  }, []);

  /* A movimentação lançada aqui é fato consumado: o servidor grava como confirmada e o caixa cai na hora.
     Por isso a data não passa de hoje, no fuso da casa, o mesmo dia que o banco usa (2026-09-22). */
  const today = houseDay();
  const income = values.kind === "income";
  const set = <K extends keyof Values>(key: K, value: Values[K]) => setValues((current) => ({ ...current, [key]: value }));

  const accounts = lookups?.accounts ?? [];
  const account = accounts.find((candidate) => candidate.id === values.accountId) ?? null;
  const accountOptions = accounts
    .filter((candidate) => candidate.active || candidate.id === values.accountId)
    .map((candidate) => ({ value: candidate.id, label: candidate.name, media: <AccountMark account={candidate} /> }));
  const categoryOptions = [
    { value: NONE, label: "Sem categoria", media: emptyOptionMedia() },
    ...(lookups?.categories ?? []).filter((category) => category.kind === values.kind).map((category) => ({ value: category.id, label: category.name, media: <OptionIcon icon={optionGlyphs.category} hue={category.hue} /> })),
  ];

  const save = async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError(null);
    const input = {
      kind: values.kind,
      title: values.title,
      description: values.description,
      amount: Number(values.amount || 0),
      date: values.date,
      method: values.method === NONE ? null : values.method,
      accountId: values.accountId || null,
      categoryId: values.categoryId === NONE ? null : values.categoryId,
    };
    const result = await callAction(editing ? updateTransactionAction({ ...input, id: editing.id }) : createTransactionAction(input));
    savingRef.current = false;
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    toast({ title: editing ? "Movimentação atualizada" : income ? "Entrada lançada" : "Saída lançada", description: values.title, tone: "success" });
    onCreated();
  };

  useFloatingActionsRegistration({
    primary: { label: saving ? "Salvando" : "Salvar", icon: <CheckIcon weight="bold" />, loading: saving, onClick: () => void save() },
    cancel: { label: "Fechar", onClick: onClose },
  });

  return (
    <>
      <div className={`${formWindow.formCard} ${local.card}`} aria-labelledby={titleId}>
        <VisuallyHidden as="h2" id={titleId}>
          {editing ? "Editar movimentação" : "Nova movimentação"}
        </VisuallyHidden>

        <div className={formWindow.body}>
          {/* O lado no segmento da casa, no alto e de ponta a ponta: é a primeira decisão, e muda as palavras e as
              categorias. O seletor de folhas da casa só existe no celular, por isso este é o segmento das listas. */}
          <div className={local.sides} role="radiogroup" aria-label="Tipo da movimentação">
            {kindOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={values.kind === option.id}
                className={local.side}
                onClick={() => setValues((current) => ({ ...current, kind: option.id, categoryId: NONE }))}
              >
                <i className={local.sideDot} data-kind={option.id} aria-hidden="true" />
                {option.label}
              </button>
            ))}
          </div>

          <Part number={1} title="O que foi">
            <Field className={local.field} label={income ? "De quem veio" : "Para onde foi"} required>
              <Input type="text" size="sm" value={values.title} maxLength={transactionLimits.title} placeholder={income ? "Nome do cliente ou origem" : "Serviço, fornecedor ou conta"} onChange={(event) => set("title", event.target.value)} />
            </Field>
            <Field className={local.field} label="Descrição">
              <Input type="text" size="sm" value={values.description} maxLength={transactionLimits.description} placeholder="Do que se trata, em uma frase" onChange={(event) => set("description", event.target.value)} />
            </Field>
            <Field className={local.field} label="Categoria">
              <Select<string> label="Categoria" size="sm" options={categoryOptions} value={values.categoryId} onChange={(categoryId) => set("categoryId", categoryId)} />
            </Field>
          </Part>

          <Part number={2} title="Como foi">
            <div className={formWindow.pair}>
              <Field className={local.field} label="Valor" required>
                <Input type="text" size="sm" mask="currency" inputMode="numeric" value={values.amount} placeholder="0,00" onChange={(event) => set("amount", onlyDigits(event.target.value))} />
              </Field>
              <Field className={local.field} label="Data" required>
                <DatePicker size="sm" value={parseISO(values.date)} max={parseISO(today)} onChange={(date) => set("date", date ? format(date, "yyyy-MM-dd") : today)} />
              </Field>
            </div>
            <div className={formWindow.pair}>
              <Field className={local.field} label="Forma">
                <Select<ChargeMethod | "none"> label="Forma de pagamento" size="sm" options={methodOptions} value={values.method} onChange={(method) => set("method", method)} />
              </Field>
              <Field className={local.field} label={income ? "Conta de entrada" : "Conta de saída"} required>
                <Select<string> label="Conta" size="sm" options={accountOptions} value={values.accountId || undefined} placeholder={lookups ? "Escolha a conta" : "Carregando as contas"} onChange={(accountId) => set("accountId", accountId)} />
              </Field>
            </div>
          </Part>

          {error && (
            <Text variant="footnote" tone="danger" role="alert" className={formWindow.alert}>
              {error}
            </Text>
          )}
        </div>

        <footer className={formWindow.cardFoot}>
          <Button variant="ghost" size="sm" radius="md" disabled={saving} onClick={onClose}>
            Cancelar
          </Button>
          <Button size="sm" radius="md" iconStart={<CheckIcon />} loading={saving} onClick={() => void save()}>
            {saving ? "Salvando" : editing ? "Salvar" : income ? "Lançar entrada" : "Lançar saída"}
          </Button>
        </footer>
      </div>

      <aside className={`${formWindow.preview} ${ticket.ticketStage}`} aria-label="Prévia do recibo">
        <PaymentSheet
          draft={{
            direction: income ? "incoming" : "outgoing",
            party: values.title.trim() || (income ? "De quem veio" : "Para onde foi"),
            description: values.description.trim() || "Lançamento avulso",
            amount: Number(values.amount || 0),
            method: values.method === NONE ? null : values.method,
            date: values.date,
            account,
          }}
        />
      </aside>
    </>
  );
}
