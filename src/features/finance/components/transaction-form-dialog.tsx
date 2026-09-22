"use client";

import { CheckIcon, XIcon } from "@phosphor-icons/react";
import { format, parseISO } from "date-fns";
import { useId, useRef, useState, type RefObject } from "react";
import { useFloatingActionsRegistration } from "@/components/layout/floating-actions";
import { useToast } from "@/components/providers/toast-provider";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Text } from "@/components/ui/text";
import { MOBILE_QUERY, useMediaQuery } from "@/hooks/use-media-query";
import { onlyDigits } from "@/lib/masks";
import { createTransactionAction } from "../actions";
import { chargeMethods, transactionKinds } from "../labels";
import { transactionLimits } from "../schemas";
import type { ChargeMethod } from "../summary";
import styles from "./transaction-form-dialog.module.css";
import { callAction } from "@/lib/action";

export type TransactionFormDialogProps = {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
};

type Values = { kind: "income" | "expense"; title: string; description: string; amount: string; date: string; method: ChargeMethod | "none" };

const blank = (): Values => ({ kind: "expense", title: "", description: "", amount: "", date: format(new Date(), "yyyy-MM-dd"), method: "none" });

const kindOptions = (["income", "expense"] as const).map((value) => ({ value, label: transactionKinds[value].label }));

const methodOptions = [{ value: "none" as const, label: "Sem forma definida" }, ...(Object.keys(chargeMethods) as ChargeMethod[]).map((value) => ({ value, label: chargeMethods[value].label }))];

// A gaveta de lançar uma movimentação à mão (2026-09-15): uma entrada ou uma saída que não veio de cobrança,
// como uma assinatura paga ou um recebimento avulso. Tipo, de quem ou para onde, do que se trata, o valor, a
// data e a forma. Salva no servidor e a lista é refeita por ele.
export function TransactionFormDialog({ open, onClose, onCreated }: TransactionFormDialogProps) {
  const mobile = useMediaQuery(MOBILE_QUERY);
  const savingRef = useRef(false);
  const close = () => {
    if (!savingRef.current) onClose();
  };
  return (
    <Dialog open={open} onClose={close} label="Nova movimentação" size="md" placement="end" surface="page" scrim={mobile} focusOnOpen={false}>
      <TransactionForm onClose={close} onCreated={onCreated} savingRef={savingRef} />
    </Dialog>
  );
}

function TransactionForm({ onClose, onCreated, savingRef }: Omit<TransactionFormDialogProps, "open"> & { savingRef: RefObject<boolean> }) {
  const { toast } = useToast();
  const titleId = useId();
  const [values, setValues] = useState<Values>(blank);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof Values>(key: K, value: Values[K]) => setValues((current) => ({ ...current, [key]: value }));

  const save = async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError(null);
    const result = await callAction(
      createTransactionAction({
        kind: values.kind,
        title: values.title,
        description: values.description,
        amount: Number(values.amount || 0),
        date: values.date,
        method: values.method === "none" ? null : values.method,
      }),
    );
    savingRef.current = false;
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    toast({ title: values.kind === "income" ? "Entrada lançada" : "Saída lançada", description: `${values.title} entrou nas movimentações.`, tone: "success" });
    onCreated();
  };

  useFloatingActionsRegistration({
    primary: { label: saving ? "Salvando" : "Salvar", icon: <CheckIcon weight="bold" />, loading: saving, onClick: () => void save() },
    cancel: { label: "Fechar", onClick: onClose },
  });

  return (
    <div className={styles.drawer} aria-labelledby={titleId}>
      <header className={styles.head}>
        <div className={styles.heading}>
          <Text as="h2" id={titleId} variant="headline" weight="semibold">
            Nova movimentação
          </Text>
          <Text variant="footnote" tone="secondary">
            Uma entrada ou saída que não veio de cobrança.
          </Text>
        </div>
        <IconButton label="Fechar" variant="ghost" size="sm" disabled={saving} onClick={onClose}>
          <XIcon />
        </IconButton>
      </header>

      <div className={styles.body}>
        <Field label="Tipo">
          <Select<Values["kind"]> label="Tipo da movimentação" size="sm" options={kindOptions} value={values.kind} onChange={(kind) => set("kind", kind)} />
        </Field>
        <Field label={values.kind === "income" ? "De quem veio" : "Para onde foi"} required>
          <Input type="text" size="sm" value={values.title} maxLength={transactionLimits.title} placeholder={values.kind === "income" ? "Nome do cliente ou origem" : "Serviço, fornecedor ou conta"} onChange={(event) => set("title", event.target.value)} />
        </Field>
        <Field label="Descrição">
          <Input type="text" size="sm" value={values.description} maxLength={transactionLimits.description} placeholder="Do que se trata, em uma frase" onChange={(event) => set("description", event.target.value)} />
        </Field>
        <div className={styles.pair}>
          <Field label="Valor" required>
            <Input type="text" size="sm" mask="currency" inputMode="numeric" value={values.amount} placeholder="0,00" onChange={(event) => set("amount", onlyDigits(event.target.value))} />
          </Field>
          <Field label="Data" required>
            <DatePicker size="sm" value={parseISO(values.date)} onChange={(date) => set("date", format(date ?? new Date(), "yyyy-MM-dd"))} />
          </Field>
        </div>
        <Field label="Forma">
          <Select<Values["method"]> label="Forma de pagamento" size="sm" options={methodOptions} value={values.method} onChange={(method) => set("method", method)} />
        </Field>
        {error && (
          <Text variant="footnote" tone="danger" role="alert">
            {error}
          </Text>
        )}
      </div>

      <footer className={styles.foot}>
        <Button variant="outline" size="sm" radius="md" disabled={saving} onClick={onClose}>
          Cancelar
        </Button>
        <Button size="sm" radius="md" iconStart={<CheckIcon />} loading={saving} onClick={() => void save()}>
          {saving ? "Salvando" : "Salvar"}
        </Button>
      </footer>
    </div>
  );
}
