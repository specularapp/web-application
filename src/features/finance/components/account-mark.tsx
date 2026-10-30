import type { CSSProperties } from "react";
import { accountKinds, bankOf, type FinanceAccount } from "../accounts";
import styles from "./account-mark.module.css";

type MarkAccount = Pick<FinanceAccount, "bank" | "kind" | "hue">;

/** O matiz da conta como variável, para o cartão, a curva e o quadradinho do logo pintarem na mesma cor. */
export const accountTone = (account: Pick<FinanceAccount, "hue">) => ({ "--account": `var(--sys-${account.hue})` }) as CSSProperties;

/**
 * O logo do banco num quadradinho ou, sem logo (o caixa, um banco fora da lista), o glifo do tipo de conta no
 * matiz da conta, no mesmo quadradinho (2026-10-27, da Le Ange).
 */
export function AccountMark({ account, size = "sm" }: { account: MarkAccount; size?: "sm" | "md" | "lg" }) {
  const bank = bankOf(account.bank);
  if (bank?.logo) {
    return (
      <span className={styles.mark} data-framed={bank.framed || undefined} data-size={size}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={bank.logo} alt="" width={20} height={20} loading="lazy" decoding="async" />
      </span>
    );
  }
  const Glyph = accountKinds[account.kind].icon;
  return (
    <span className={styles.mark} data-glyph="" data-size={size} style={accountTone(account)}>
      <Glyph aria-hidden="true" weight="duotone" />
    </span>
  );
}
