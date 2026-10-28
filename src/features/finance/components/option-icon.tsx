import type { Icon } from "@phosphor-icons/react";
import {
  ArrowsClockwiseIcon,
  BankIcon,
  BarcodeIcon,
  CalendarBlankIcon,
  CalendarCheckIcon,
  CreditCardIcon,
  FileDashedIcon,
  FileTextIcon,
  MoneyIcon,
  PixLogoIcon,
  ProhibitIcon,
  StackIcon,
  TagIcon,
  UserCircleDashedIcon,
} from "@phosphor-icons/react";
import type { CSSProperties } from "react";
import { chargeMethods } from "../labels";
import type { ChargeMethod, ChargeRecurrence } from "../summary";
import styles from "./option-icon.module.css";

/**
 * O glifo de uma opção de seletor num quadradinho no matiz dela (2026-10-27, a pedido: "melhore os dropdown para
 * usar ícones e cores"), o mesmo desenho da marca de conta sem logo: o seletor lê pela cor antes do nome.
 */
export function OptionIcon({ icon: Glyph, hue }: { icon: Icon; hue: string }) {
  return (
    <span className={styles.icon} style={{ "--hue": `var(--sys-${hue})` } as CSSProperties} aria-hidden="true">
      <Glyph weight="duotone" />
    </span>
  );
}

/** O matiz e o glifo de cada forma de pagamento. */
export const methodLooks: Record<ChargeMethod, { icon: Icon; hue: string }> = {
  pix: { icon: PixLogoIcon, hue: "teal" },
  boleto: { icon: BarcodeIcon, hue: "brown" },
  transfer: { icon: BankIcon, hue: "blue" },
  card: { icon: CreditCardIcon, hue: "purple" },
  cash: { icon: MoneyIcon, hue: "green" },
};

export const methodOption = (value: ChargeMethod) => ({ value, label: chargeMethods[value].label, media: <OptionIcon {...methodLooks[value]} /> });

/** A opção vazia de um seletor ("Sem categoria", "Sem forma"), no cinza, com o glifo de "nada aqui". */
export const emptyOptionMedia = (icon: Icon = ProhibitIcon) => <OptionIcon icon={icon} hue="gray" />;

const recurrenceHues: Record<ChargeRecurrence, string> = { none: "gray", monthly: "blue", quarterly: "indigo", yearly: "purple" };

export const recurrenceMedia = (value: ChargeRecurrence) => <OptionIcon icon={value === "none" ? ProhibitIcon : ArrowsClockwiseIcon} hue={recurrenceHues[value]} />;

/** "À vista" no verde, parcelado no laranja: a pessoa vê de relance se divide ou não. */
export const installmentsMedia = (count: number) => <OptionIcon icon={count === 1 ? CalendarCheckIcon : StackIcon} hue={count === 1 ? "green" : "orange"} />;

export const optionGlyphs = { quote: FileTextIcon, noQuote: FileDashedIcon, standalone: UserCircleDashedIcon, account: BankIcon, category: TagIcon, date: CalendarBlankIcon };
