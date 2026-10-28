"use client";

import { CheckIcon } from "@phosphor-icons/react";
import { format, parseISO } from "date-fns";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { useFloatingActionsRegistration } from "@/components/layout/floating-actions";
import { useToast } from "@/components/providers/toast-provider";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Dialog, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { callAction } from "@/lib/action";
import { onlyDigits } from "@/lib/masks";
import { formatMoney } from "@/lib/utils/format";
import { adjustAccountAction } from "../accounts-actions";
import type { FinanceAccount } from "../accounts";
import { accountLimits } from "../schemas";
import { signedMoney, type Opened } from "./money";
import styles from "./account-editor.module.css";

/**
 * Acertar o saldo com o que o banco (ou a gaveta do caixa) mostra (2026-10-27, da Le Ange): a pessoa diz quanto a
 * conta tem de verdade e a diferença entra no extrato como um ajuste, que não conta como entrada nem saída.
 */
export function AdjustDialog({ opened, today, onClose }: { opened: Opened<FinanceAccount>; today: string; onClose: () => void }) {
  return (
    <Dialog open={opened !== null} onClose={onClose} label="Ajustar saldo" size="sm" surface="solid" focusOnOpen={false}>
      {opened && <AdjustForm key={opened.key} account={opened.value} today={today} onClose={onClose} />}
    </Dialog>
  );
}

function AdjustForm({ account, today, onClose }: { account: FinanceAccount; today: string; onClose: () => void }) {
  const router = useRouter();
  const { toast } = useToast();
  const titleId = useId();
  const [balance, setBalance] = useState("");
  const [date, setDate] = useState(today);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const real = balance === "" ? null : Number(balance);
  const difference = real === null ? null : real - account.balance;

  const save = async () => {
    if (saving) return;
    if (real === null) return setError("Informe o saldo que a conta tem de verdade.");
    setSaving(true);
    setError(null);
    const result = await callAction(adjustAccountAction({ id: account.id, balance: real, date, note }));
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    toast({ title: "Saldo ajustado", description: `${account.name} agora tem ${formatMoney(real)}.`, tone: "success" });
    onClose();
    router.refresh();
  };

  useFloatingActionsRegistration({
    primary: { label: saving ? "Ajustando" : "Ajustar saldo", icon: <CheckIcon weight="bold" />, loading: saving, onClick: () => void save() },
    cancel: { label: "Fechar", onClick: onClose },
  });

  return (
    <div className={styles.form} aria-labelledby={titleId}>
      <DialogHeader id={titleId} title="Ajustar saldo" description={account.name} closeDisabled={saving} onClose={onClose} />

      <div className={styles.body}>
        <dl className={styles.facts}>
          <div>
            <dt>O sistema calcula</dt>
            <dd>{formatMoney(account.balance)}</dd>
          </div>
          {difference !== null && (
            <div>
              <dt>Diferença a lançar</dt>
              <dd data-sign={difference > 0 ? "up" : difference < 0 ? "down" : undefined}>{difference === 0 ? "Nenhuma" : signedMoney(difference)}</dd>
            </div>
          )}
        </dl>
        <Field label="Saldo real da conta" required>
          <Input
            size="sm"
            mask="currency"
            inputMode="numeric"
            value={balance}
            placeholder="0,00"
            onChange={(event) => {
              setBalance(onlyDigits(event.target.value));
              setError(null);
            }}
          />
        </Field>
        <div className={styles.pair}>
          <Field label="Data do ajuste" required>
            <DatePicker size="sm" value={parseISO(date)} max={parseISO(today)} onChange={(value) => setDate(value ? format(value, "yyyy-MM-dd") : today)} />
          </Field>
          <Field label="Motivo">
            <Input size="sm" value={note} maxLength={accountLimits.note} placeholder="Opcional" onChange={(event) => setNote(event.target.value)} />
          </Field>
        </div>
        <Text as="p" variant="footnote" tone="secondary">
          Informe o que o extrato do banco ou a contagem do caixa mostra. A diferença fica no extrato como ajuste.
        </Text>
        {error && (
          <Text variant="footnote" tone="danger" role="alert">
            {error}
          </Text>
        )}
      </div>

      <DialogFooter>
        <Button variant="outline" size="sm" radius="md" disabled={saving} onClick={onClose}>
          Cancelar
        </Button>
        <Button size="sm" radius="md" iconStart={<CheckIcon />} loading={saving} disabled={difference === 0} onClick={() => void save()}>
          Ajustar saldo
        </Button>
      </DialogFooter>
    </div>
  );
}
