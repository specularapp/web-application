import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { Text } from "@/components/ui/text";
import { cx } from "@/lib/utils/cx";
import styles from "./page-header.module.css";

export type PageHeaderProps = Omit<ComponentPropsWithoutRef<"header">, "title"> & {
  title: ReactNode;
  description?: ReactNode;
  /** Avatar ou ícone antes do texto. */
  leading?: ReactNode;
  actions?: ReactNode;
  /** Nível do título: `h1` por padrão, porque o cabeçalho abre a página. */
  as?: "h1" | "h2";
  /** No celular sobra só o `leading`: título e linha de apoio saem da tela e ficam para o leitor de tela. */
  compact?: boolean;
};

// Cabeçalho de página: quem abre a tela à esquerda (avatar ou ícone, título e uma linha de apoio) e
// a fila de ações à direita. Em tela estreita as ações descem para a linha de baixo, sem sumir.
export function PageHeader({
  title,
  description,
  leading,
  actions,
  as = "h1",
  compact = false,
  className,
  ...props
}: PageHeaderProps) {
  return (
    <header className={cx(styles.header, className)} data-compact={compact || undefined} {...props}>
      <div className={styles.identity}>
        {leading}
        <div className={styles.text}>
          <Text as={as} variant="headline" weight="semibold" truncate>
            {title}
          </Text>
          {description && (
            <Text variant="footnote" tone="secondary">
              {description}
            </Text>
          )}
        </div>
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </header>
  );
}
