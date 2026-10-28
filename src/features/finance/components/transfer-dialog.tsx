"use client";

import { ArrowsLeftRightIcon, CheckIcon, XIcon } from "@phosphor-icons/react";
import { format, parseISO } from "date-fns";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { useFloatingActionsRegistration } from "@/components/layout/floating-actions";
import { useToast } from "@/components/providers/toast-provider";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Dialog, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { formWindow, FormWindowPart as Part } from "@/components/ui/form-window";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Text } from "@/components/ui/text";
import { callAction } from "@/lib/action";
import { onlyDigits } from "@/lib/masks";
import { formatMoney } from "@/lib/utils/format";
import { createTransferAction } from "../accounts-actions";
import type { FinanceAccount, FinanceTransfer } from "../accounts";
import { accountLimits } from "../schemas";
import { AccountMark } from "./account-mark";
import { dateBr, type Opened } from "./money";
import { TransferSheet } from "./transfer-sheet";
import sheet from "./transfer-sheet.module.css";
import styles from "./transfer-dialog.module.css";

const accountOptions = (accounts: FinanceAccount[]) =>
  accounts.map((account) => ({ value: account.id, label: account.name, caption: formatMoney(account.balance), media: <AccountMark account={account} /> }));

/**
 * Transferir entre contas (2026-10-27, da Le Ange, na janela dupla da casa): à esquerda de onde sai, para onde
 * vai, o valor e a data, e o motivo; à direita a prévia do comprovante, com quanto cada conta fica depois. O
 * dinheiro só muda de lugar, e o fluxo de caixa não conta isso como entrada nem saída.
 */
export function TransferDialog({ opened, accounts, today, onClose }: { opened: Opened<string | null>; accounts: FinanceAccount[]; today: string; onClose: () => void }) {
  return (
    <Dialog open={opened !== null} onClose={onClose} label="Nova transferência" size="xl" surface="solid" focusOnOpen={false} className={`${formWindow.window} ${styles.window}`}>
      {opened && <TransferForm key={opened.key} fromId={opened.value} accounts={accounts} today={today} onClose={onClose} />}
    </Dialog>
  );
}

function TransferForm({ fromId, accounts, today, onClose }: { fromId: string | null; accounts: FinanceAccount[]; today: string; onClose: () => void }) {
  const router = useRouter();
  const { toast } = useToast();
  const titleId = useId();
  const active = accounts.filter((account) => account.active);
  // Sem conta escolhida, sai da que tem mais dinheiro
  const initialFrom = fromId ?? active.toSorted((a, b) => b.balance - a.balance)[0]?.id ?? "";
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(() => active.find((account) => account.id !== initialFrom)?.id ?? "");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const source = active.find((account) => account.id === from) ?? null;
  const target = active.find((account) => account.id === to) ?? null;
  const cents = Number(amount || 0);
  const short = source !== null && cents > source.balance;

  const chooseFrom = (id: string) => {
    setFrom(id);
    setError(null);
    if (id === to) setTo(active.find((account) => account.id !== id)?.id ?? "");
  };

  const save = async () => {
    if (saving) return;
    if (cents <= 0) return setError("Informe o valor da transferência.");
    setSaving(true);
    setError(null);
    const result = await callAction(createTransferAction({ fromId: from, toId: to, amount: cents, date, note }));
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    toast({ title: "Transferência feita", description: `${formatMoney(cents)} de ${source?.name ?? "uma conta"} para ${target?.name ?? "outra"}. Código ${result.transfer.reference}.`, tone: "success" });
    onClose();
    router.refresh();
  };

  useFloatingActionsRegistration({
    primary: { label: saving ? "Transferindo" : "Transferir", icon: <CheckIcon weight="bold" />, loading: saving, onClick: () => void save() },
    cancel: { label: "Fechar", onClick: onClose },
  });

  return (
    <>
      <div className={formWindow.formCard} aria-labelledby={titleId}>
        <div className={formWindow.head}>
          <header className={formWindow.cardHead}>
            <Text as="h2" id={titleId} variant="callout" weight="semibold" truncate className={formWindow.cardTitle}>
              Nova transferência
            </Text>
            <IconButton label="Fechar" variant="ghost" size="sm" disabled={saving} onClick={onClose}>
              <XIcon />
            </IconButton>
          </header>
        </div>

        <div className={formWindow.body}>
          <Part number={1} title="De onde sai" hint="A conta que o dinheiro deixa">
            <Field label="Conta de origem" required>
              <Select<string> label="Conta de origem" size="sm" options={accountOptions(active)} value={from} onChange={chooseFrom} />
            </Field>
          </Part>

          <Part number={2} title="Para onde vai" hint="A conta que recebe">
            <Field label="Conta de destino" required>
              <Select<string>
                label="Conta de destino"
                size="sm"
                options={accountOptions(active.filter((account) => account.id !== from))}
                value={to}
                onChange={(id) => {
                  setTo(id);
                  setError(null);
                }}
              />
            </Field>
          </Part>

          <Part number={3} title="Valor e data" hint="Não pode ser no futuro">
            <div className={formWindow.pair}>
              <Field label="Valor" required>
                <Input size="sm" mask="currency" inputMode="numeric" value={amount} placeholder="0,00" invalid={short} onChange={(event) => setAmount(onlyDigits(event.target.value))} />
              </Field>
              <Field label="Data" required>
                <DatePicker size="sm" value={parseISO(date)} max={parseISO(today)} onChange={(value) => setDate(value ? format(value, "yyyy-MM-dd") : today)} />
              </Field>
            </div>
            {short && source && (
              <Text as="p" variant="footnote" tone="danger">
                {source.name} tem {formatMoney(source.balance)}: a transferência não pode passar do saldo.
              </Text>
            )}
          </Part>

          <Part number={4} title="Motivo" hint="Para quem ler o extrato">
            <Field label="Motivo">
              <Input size="sm" value={note} maxLength={accountLimits.note} placeholder="Ex.: depósito do caixa da semana" onChange={(event) => setNote(event.target.value)} />
            </Field>
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
          <Button size="sm" radius="md" iconStart={<ArrowsLeftRightIcon />} loading={saving} disabled={!from || !to || short} onClick={() => void save()}>
            {saving ? "Transferindo" : "Transferir"}
          </Button>
        </footer>
      </div>

      {/* A prévia: o comprovante, com quanto cada conta fica depois */}
      <aside className={formWindow.preview} aria-label="Prévia do comprovante">
        <TransferSheet
          flat
          draft={{
            reference: null,
            date,
            amount: cents,
            note,
            from: source,
            to: target,
            after: source && target ? { from: source.balance - cents, to: target.balance + cents } : null,
          }}
        />
      </aside>
    </>
  );
}

/** O comprovante de uma transferência feita, na folha do recibo. */
export function TransferReceiptDialog({ transfer, accounts, onClose }: { transfer: FinanceTransfer | null; accounts: FinanceAccount[]; onClose: () => void }) {
  const accountOf = (id: string) => accounts.find((account) => account.id === id) ?? null;
  return (
    <Dialog open={transfer !== null} onClose={onClose} label={transfer ? `Transferência ${transfer.reference}` : "Transferência"} size="md" surface="solid" focusOnOpen={false} className={styles.receipt}>
      {transfer && (
        <>
          <DialogHeader title={`Transferência ${transfer.reference}`} description={transfer.undone ? "Desfeita: o dinheiro voltou para a conta de onde saiu." : dateBr(transfer.date)} onClose={onClose} />
          <div className={sheet.stage}>
            <TransferSheet draft={{ reference: transfer.reference, date: transfer.date, amount: transfer.amount, note: transfer.note, from: accountOf(transfer.fromId), to: accountOf(transfer.toId), undone: transfer.undone }} />
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" radius="md" onClick={onClose}>
              Fechar
            </Button>
          </DialogFooter>
        </>
      )}
    </Dialog>
  );
}
