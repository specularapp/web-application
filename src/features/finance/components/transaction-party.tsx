import type { Icon } from "@phosphor-icons/react";
import { ArrowDownLeftIcon, ArrowUpRightIcon, CalendarCheckIcon } from "@phosphor-icons/react/ssr";
import { Avatar } from "@/components/ui/avatar";
import { BrandIcon } from "@/components/ui/brand-icon";
import { iconButtonCornerRadius, squirclePx } from "@/lib/corners";
import type { Transaction, TransactionKind } from "../summary";
import styles from "./transaction-party.module.css";

export type TransactionPartySize = "sm" | "lg";

const icons: Record<TransactionKind, Icon> = {
  income: ArrowDownLeftIcon,
  expense: ArrowUpRightIcon,
  scheduled: CalendarCheckIcon,
};

/* Chip no raio de metade do lado, a escala do botão de ícone, recortado no fallback porque não tem borda. */
const corners: Record<TransactionPartySize, ReturnType<typeof squirclePx>> = {
  sm: squirclePx(iconButtonCornerRadius.sm, { clip: true }),
  lg: squirclePx(iconButtonCornerRadius.lg, { clip: true }),
};

// Quem está do outro lado da movimentação: a pessoa pelo `Avatar` (foto, ou o rosto gerado), o serviço
// pela logo em cores num chip, e, sem nenhum dos dois, o ícone do tipo tingido pelo matiz dele. Os
// três têm o mesmo tamanho e canto, em dois tamanhos: o da linha e o do recibo.
export function TransactionParty({ transaction, size = "sm" }: { transaction: Transaction; size?: TransactionPartySize }) {
  const { visual } = transaction;

  if (visual?.type === "person") {
    return <Avatar name={transaction.title} src={visual.avatarUrl ?? undefined} size={size} shape="squircle" />;
  }

  if (visual?.type === "brand") {
    return (
      <span className={styles.party} data-size={size} data-brand aria-hidden="true" {...corners[size]}>
        <BrandIcon name={visual.name} color />
      </span>
    );
  }

  const Glyph = icons[transaction.kind];
  return (
    <span className={styles.party} data-size={size} data-glyph data-kind={transaction.kind} aria-hidden="true" {...corners[size]}>
      <Glyph weight="bold" />
    </span>
  );
}
