import { useId, type ComponentPropsWithoutRef, type ElementType, type ReactNode } from "react";
import { squircle } from "@/lib/corners";
import { cx } from "@/lib/utils/cx";
import { Text } from "../text";
import styles from "./card.module.css";

export type CardProps = Omit<ComponentPropsWithoutRef<"section">, "title"> & {
  title: ReactNode;
  /** Ícone antes do título, na cor secundária. */
  icon?: ReactNode;
  /** Ação curta na outra ponta do cabeçalho, como "Ver tudo": atalho, e não foco, então `outline` e `sm`. */
  action?: ReactNode;
  as?: ElementType;
  /** Nível do título: `h2` por padrão, porque o cartão é uma seção da página. */
  heading?: "h2" | "h3";
};

// Cartão de bloco: cabeçalho com ícone, título e uma ação discreta, separado do corpo por um fio, e o
// corpo crescendo até o fim da caixa. Raio 24 com recuo 16, então o que for aninhado cai no raio 8
// (`--card-inner`), como manda a regra dos cantos.
export function Card({
  title,
  icon,
  action,
  as: Tag = "section",
  heading = "h2",
  className,
  children,
  ...props
}: CardProps) {
  const id = useId();

  return (
    <Tag className={cx(styles.card, className)} aria-labelledby={id} {...squircle("xl")} {...props}>
      <header className={styles.head}>
        {icon && (
          <span className={styles.icon} aria-hidden="true">
            {icon}
          </span>
        )}
        <Text as={heading} id={id} variant="subheadline" weight="semibold" truncate className={styles.title}>
          {title}
        </Text>
        {action && <span className={styles.action}>{action}</span>}
      </header>
      <div className={styles.body}>{children}</div>
    </Tag>
  );
}
