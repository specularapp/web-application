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
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Text } from "@/components/ui/text";
import { stageColorOptions } from "@/features/tasks/components/stages-dialog";
import { callAction } from "@/lib/action";
import { onlyDigits } from "@/lib/masks";
import { formatMoney } from "@/lib/utils/format";
import { saveAccountAction } from "../accounts-actions";
import { accountKinds, accountKindValues, bankKeys, bankOf, banks, type AccountHue, type AccountKind, type FinanceAccount } from "../accounts";
import { accountLimits } from "../schemas";
import { AccountMark } from "./account-mark";
import type { Opened } from "./money";
import styles from "./account-editor.module.css";

const kindOptions = accountKindValues.map((value) => ({ value, label: accountKinds[value].label }));

const NO_BANK = "outro";

const bankOptions = [
  ...bankKeys.map((key) => ({ value: key as string, label: banks[key].label, media: <AccountMark account={{ bank: key, kind: "checking", hue: banks[key].hue }} /> })),
  { value: NO_BANK, label: "Outro banco ou sem banco" },
];

/**
 * Criar e editar uma conta (2026-10-27, da Le Ange): o nome, o tipo, o banco com agência e o fim do número, a cor
 * do cartão, a abertura e se é a conta padrão. O saldo de hoje não se digita aqui: para acertá-lo há o "Ajustar
 * saldo", que deixa o rastro no extrato.
 */
export function AccountEditor({ opened, today, onClose }: { opened: Opened<FinanceAccount | null>; today: string; onClose: () => void }) {
  const account = opened?.value ?? null;
  const title = account ? `Editar ${account.name}` : "Nova conta";
  return (
    <Dialog open={opened !== null} onClose={onClose} label={title} size="md" surface="solid" focusOnOpen={false}>
      {opened && <AccountForm key={opened.key} account={account} title={title} today={today} onClose={onClose} />}
    </Dialog>
  );
}

function AccountForm({ account, title, today, onClose }: { account: FinanceAccount | null; title: string; today: string; onClose: () => void }) {
  const router = useRouter();
  const { toast } = useToast();
  const titleId = useId();
  const [name, setName] = useState(account?.name ?? "");
  const [kind, setKind] = useState<AccountKind>(account?.kind ?? "checking");
  const [bank, setBank] = useState(account?.bank ?? NO_BANK);
  const [agency, setAgency] = useState(account?.agency ?? "");
  const [lastDigits, setLastDigits] = useState(account?.lastDigits ?? "");
  const [hue, setHue] = useState<AccountHue>(account?.hue ?? "blue");
  const [opening, setOpening] = useState(account ? String(Math.abs(account.openingBalance)) : "");
  const [openingDate, setOpeningDate] = useState(account?.openingDate ?? today);
  const [isDefault, setIsDefault] = useState(account?.isDefault ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cash = kind === "cash";

  /* O banco escolhido traz a cor dele, para o cartão nascer reconhecível; a pessoa ainda pode trocar. */
  const chooseBank = (value: string) => {
    setBank(value);
    const known = bankOf(value);
    if (known) setHue(known.hue);
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    const result = await callAction(
      saveAccountAction({
        id: account?.id ?? null,
        name,
        kind,
        bank: cash || bank === NO_BANK ? null : bank,
        agency: cash || !agency.trim() ? null : agency.trim(),
        lastDigits: cash || !lastDigits.trim() ? null : lastDigits.trim(),
        hue,
        openingBalance: Number(opening || 0) * (account && account.openingBalance < 0 ? -1 : 1),
        openingDate,
        isDefault,
      }),
    );
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    toast({ title: account ? "Conta atualizada" : "Conta criada", description: name, tone: "success" });
    onClose();
    router.refresh();
  };

  useFloatingActionsRegistration({
    primary: { label: saving ? "Salvando" : account ? "Salvar conta" : "Criar conta", icon: <CheckIcon weight="bold" />, loading: saving, onClick: () => void save() },
    cancel: { label: "Fechar", onClick: onClose },
  });

  return (
    <div className={styles.form} aria-labelledby={titleId}>
      <DialogHeader id={titleId} title={title} description="Onde o dinheiro da empresa fica: bancos, maquininhas e o caixa." closeDisabled={saving} onClose={onClose} />

      <div className={styles.body}>
        <Field label="Nome da conta" required>
          <Input size="sm" value={name} maxLength={accountLimits.name} placeholder="Ex.: Itaú da empresa" onChange={(event) => setName(event.target.value)} />
        </Field>
        <div className={styles.pair}>
          <Field label="Tipo" required>
            <Select<AccountKind> label="Tipo da conta" size="sm" options={kindOptions} value={kind} onChange={setKind} />
          </Field>
          <Field label="Cor do cartão">
            <Select<string> label="Cor do cartão" size="sm" options={stageColorOptions} value={hue} onChange={(value) => setHue(value as AccountHue)} />
          </Field>
        </div>
        {!cash && (
          <>
            <Field label="Banco ou operadora">
              <Select<string> label="Banco ou operadora" size="sm" searchable options={bankOptions} value={bank} onChange={chooseBank} />
            </Field>
            <div className={styles.pair}>
              <Field label="Agência">
                <Input size="sm" inputMode="numeric" value={agency} maxLength={10} placeholder="0000" onChange={(event) => setAgency(event.target.value.replace(/[^0-9-]/g, ""))} />
              </Field>
              <Field label="Fim do número da conta">
                <Input size="sm" inputMode="numeric" value={lastDigits} maxLength={6} placeholder="Os últimos 4 dígitos" onChange={(event) => setLastDigits(onlyDigits(event.target.value))} />
              </Field>
            </div>
          </>
        )}
        <div className={styles.pair}>
          <Field label="Saldo de abertura" required>
            <Input size="sm" mask="currency" inputMode="numeric" value={opening} placeholder="0,00" onChange={(event) => setOpening(onlyDigits(event.target.value))} />
          </Field>
          <Field label="Data da abertura" required>
            <DatePicker size="sm" value={parseISO(openingDate)} max={parseISO(today)} onChange={(date) => setOpeningDate(date ? format(date, "yyyy-MM-dd") : today)} />
          </Field>
        </div>
        <Text as="p" variant="footnote" tone="secondary">
          {account
            ? `A abertura é de onde o extrato parte; o saldo de hoje é ${formatMoney(account.balance)}. Para acertar o de hoje, use "Ajustar saldo".`
            : "O saldo da conta no dia em que ela entra no sistema. Dali em diante, o saldo é sempre o que entrou menos o que saiu."}
        </Text>
        {!account?.isDefault && (
          <Switch checked={isDefault} onChange={(event) => setIsDefault(event.target.checked)}>
            Conta padrão: recebe o que for lançado sem dizer a conta
          </Switch>
        )}
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
        <Button size="sm" radius="md" iconStart={<CheckIcon />} loading={saving} onClick={() => void save()}>
          {account ? "Salvar conta" : "Criar conta"}
        </Button>
      </DialogFooter>
    </div>
  );
}
