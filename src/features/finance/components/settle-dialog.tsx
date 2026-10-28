"use client";

import { CheckIcon } from "@phosphor-icons/react";
import { format, parseISO } from "date-fns";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { useFloatingActionsRegistration } from "@/components/layout/floating-actions";
import { useToast } from "@/components/providers/toast-provider";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { formWindow, FormWindowPart as Part } from "@/components/ui/form-window";
import { Select } from "@/components/ui/select";
import { Text } from "@/components/ui/text";
import { VisuallyHidden } from "@/components/ui/visually-hidden";
import { callAction } from "@/lib/action";
import { formatMoney } from "@/lib/utils/format";
import { payInstallmentAction } from "../actions";
import type { FinanceAccount } from "../accounts";
import { installmentLabelOf, installmentSides, type FinanceCategory, type InstallmentEntry } from "../installments";
import { dueLabel, dueTone } from "../labels";
import { chargeMethodValues } from "../schemas";
import type { ChargeMethod } from "../summary";
import { AccountMark } from "./account-mark";
import type { Opened } from "./money";
import { methodOption } from "./option-icon";
import { PaymentSheet } from "./payment-sheet";
import ticket from "./payment-sheet.module.css";
import local from "./settle-dialog.module.css";
import styles from "./transfer-dialog.module.css";

const methodOptions = chargeMethodValues.map(methodOption);

/**
 * Receber ou pagar uma parcela (2026-10-27, da Le Ange, na janela dupla da casa): à esquerda a parcela, a forma,
 * a conta e a data, nas seções numeradas; à direita a prévia do recibo, que acompanha cada campo. A conta parte
 * da que a cobrança combinou, ou da padrão; a baixa cai nela e entra no extrato.
 */
export function SettleDialog({ opened, accounts, categories, today, onClose }: { opened: Opened<InstallmentEntry>; accounts: FinanceAccount[]; categories: FinanceCategory[]; today: string; onClose: () => void }) {
  const label = opened ? installmentSides[opened.value.direction].settleTitle : "Registrar baixa";
  return (
    <Dialog open={opened !== null} onClose={onClose} label={label} size="xl" surface="solid" focusOnOpen={false} className={`${formWindow.window} ${styles.window}`}>
      {opened && <SettleForm key={opened.key} entry={opened.value} accounts={accounts} categories={categories} today={today} onClose={onClose} />}
    </Dialog>
  );
}

function SettleForm({ entry, accounts, categories, today, onClose }: { entry: InstallmentEntry; accounts: FinanceAccount[]; categories: FinanceCategory[]; today: string; onClose: () => void }) {
  const router = useRouter();
  const { toast } = useToast();
  const titleId = useId();
  const side = installmentSides[entry.direction];
  const active = accounts.filter((account) => account.active);
  const planned = active.find((account) => account.id === entry.accountId) ?? null;
  const [method, setMethod] = useState<ChargeMethod>(entry.method);
  const [accountId, setAccountId] = useState(planned?.id ?? active.find((account) => account.isDefault)?.id ?? active[0]?.id ?? "");
  const [date, setDate] = useState(today);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const account = active.find((candidate) => candidate.id === accountId) ?? null;
  const category = categories.find((candidate) => candidate.id === entry.categoryId) ?? null;
  const party = entry.party.standalone ? entry.title : (entry.party.company ?? entry.party.name);

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    const result = await callAction(payInstallmentAction({ id: entry.chargeId, installmentId: entry.id, method, paidOn: date, accountId: accountId || null }));
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    toast({
      title: entry.direction === "outgoing" ? "Pagamento registrado" : "Recebimento registrado",
      description: `${formatMoney(entry.amount)} ${entry.direction === "outgoing" ? "saíram de" : "entraram em"} ${account?.name ?? "conta padrão"}.`,
      tone: "success",
    });
    if (result.warning) toast({ title: "Atenção", description: result.warning, tone: "warning" });
    onClose();
    router.refresh();
  };

  useFloatingActionsRegistration({
    primary: { label: saving ? "Salvando" : side.settle, icon: <CheckIcon weight="bold" />, loading: saving, onClick: () => void save() },
    cancel: { label: "Fechar", onClick: onClose },
  });

  return (
    <>
      <div className={`${formWindow.formCard} ${local.card}`} aria-labelledby={titleId}>
        {/* Sem cabeçalho (2026-10-27, a pedido): o resumo já diz o que é, e fechar é o Cancelar ou o Esc. O título
            fica só para o leitor de tela. */}
        <VisuallyHidden as="h2" id={titleId}>
          {side.settleTitle}
        </VisuallyHidden>

        <div className={formWindow.body}>
          {/* O que está sendo baixado, num bloco só: quem, o quê, quando vence e quanto (2026-10-27, a pedido: "tudo
              quebrado, organize melhor"). Era uma seção numerada de linhas soltas que empurrava a data para fora. */}
          <section className={local.summary} aria-label="A parcela">
            <Avatar name={entry.party.name} src={entry.party.avatarUrl ?? undefined} size="md" />
            <span className={local.who}>
              <Text as="strong" variant="callout" weight="semibold" truncate>
                {party}
              </Text>
              <span className={local.tags}>
                <Badge tone={entry.status === "overdue" ? "danger" : dueTone(entry.dueDate, today)} size="sm">
                  {dueLabel(entry.dueDate, today)}
                </Badge>
                <Text as="span" variant="caption1" tone="tertiary">
                  {installmentLabelOf(entry)}
                  {category ? `, ${category.name}` : ""}
                </Text>
              </span>
            </span>
            <span className={local.amount}>
              <Text as="span" variant="caption1" tone="secondary">
                {entry.direction === "outgoing" ? "A pagar" : "A receber"}
              </Text>
              <Text as="strong" variant="title3" weight="bold" numeric>
                {formatMoney(entry.amount)}
              </Text>
            </span>
          </section>

          <Part number={1} title={entry.direction === "outgoing" ? "Como foi pago" : "Como foi recebido"}>
            <div className={formWindow.pair}>
              <Field className={local.field} label="Forma" required>
                <Select<ChargeMethod> label="Forma de pagamento" size="sm" options={methodOptions} value={method} onChange={setMethod} />
              </Field>
              <Field className={local.field} label={entry.direction === "outgoing" ? "Data do pagamento" : "Data do recebimento"} required>
                <DatePicker size="sm" value={parseISO(date)} max={parseISO(today)} onChange={(value) => setDate(value ? format(value, "yyyy-MM-dd") : today)} />
              </Field>
            </div>
            <Field className={local.field} label={entry.direction === "outgoing" ? "Conta de saída" : "Conta de entrada"} required>
              <Select<string>
                label="Conta"
                size="sm"
                options={active.map((candidate) => ({ value: candidate.id, label: candidate.name, media: <AccountMark account={candidate} /> }))}
                value={accountId}
                onChange={(id) => {
                  setAccountId(id);
                  setError(null);
                }}
              />
            </Field>
            {planned && planned.id !== accountId && (
              <Text as="p" variant="footnote" tone="secondary">
                A conta combinada na {entry.direction === "outgoing" ? "despesa" : "cobrança"} era {planned.name}.
              </Text>
            )}
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
          <Button size="sm" radius="md" iconStart={<CheckIcon />} loading={saving} disabled={!accountId} onClick={() => void save()}>
            {saving ? "Salvando" : `Confirmar ${entry.direction === "outgoing" ? "pagamento" : "recebimento"}`}
          </Button>
        </footer>
      </div>

      <aside className={`${formWindow.preview} ${ticket.ticketStage}`} aria-label="Prévia do recibo">
        <PaymentSheet draft={{ direction: entry.direction, party, description: entry.title, reference: entry.reference, installment: installmentLabelOf(entry), amount: entry.amount, method, date, account }} />
      </aside>
    </>
  );
}
