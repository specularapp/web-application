"use client";

import { Badge } from "@/components/ui/badge";
import { iconButtonCornerRadius, squirclePx } from "@/lib/corners";
import { cx } from "@/lib/utils/cx";
import { YEARLY_DISCOUNT, type BillingCycle } from "../plans";
import styles from "./cycle-toggle.module.css";

const options: { value: BillingCycle; label: string }[] = [
  { value: "monthly", label: "Mensal" },
  { value: "yearly", label: "Anual" },
];

type CycleToggleProps = {
  value: BillingCycle;
  onChange: (cycle: BillingCycle) => void;
  /** Ocupa a linha toda, com as duas opções dividindo o espaço. É o formato do mobile. */
  fullWidth?: boolean;
  className?: string;
};

/** Alternador Mensal e Anual, o mesmo nos primeiros passos e em configurações. */
export function CycleToggle({ value, onChange, fullWidth = false, className }: CycleToggleProps) {
  return (
    <div
      className={cx(styles.cycles, className)}
      role="radiogroup"
      aria-label="Ciclo de cobrança"
      data-full={fullWidth || undefined}
      {...squirclePx(iconButtonCornerRadius.md)}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          className={styles.cycle}
          data-active={value === option.value || undefined}
          onClick={() => onChange(option.value)}
          {...squirclePx(iconButtonCornerRadius.sm)}
        >
          {option.label}
          {option.value === "yearly" && (
            <Badge tone="neutral" size="sm" className={styles.off}>
              {YEARLY_DISCOUNT}% OFF
            </Badge>
          )}
        </button>
      ))}
    </div>
  );
}
