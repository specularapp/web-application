import type { Icon } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { rounded } from "@/lib/corners";
import { Text } from "../text";
import styles from "./empty-state.module.css";

export type EmptyStateProps = {
  /** O glifo do que falta: o mesmo que o menu dá àquela página, para o vazio e a tela falarem a mesma língua. */
  icon: Icon;
  /** O que não existe, em uma linha curta. */
  title: string;
  /** Por que não existe e o que fazer, em uma frase. */
  description: string;
  /** `sm` para dentro de cartão, janela ou gaveta, onde o vazio de página inteira não cabe. */
  size?: "sm" | "md";
  /** O caminho de saída: criar o primeiro, limpar a busca, voltar. Sem isso o vazio só dá a notícia. */
  children?: ReactNode;
};

/**
 * O vazio de uma tela, igual em toda a aplicação (2026-09-16, a pedido, sobre uma referência do usuário):
 * o glifo do que falta, o que não existe, por que não existe e **o caminho de saída**.
 *
 * O caminho é a razão de ele existir. Até aqui cada lista dizia "Nenhum cliente por aqui" e parava; quem
 * abria a tela pela primeira vez via uma frase e nenhum botão, e tinha de descobrir sozinho que o que cria
 * mora lá em cima, na barra. Um vazio sem saída é um beco.
 *
 * **Dois tamanhos com composições diferentes**, e não o mesmo desenho encolhido: em página cheia o glifo vem
 * num azulejo acima do texto, sobre papel quadriculado que se dissolve nas bordas, que é a referência; em
 * cartão ele vira um glifo solto na frente do título, numa linha só. O motivo é medida: um bloco do painel
 * de uma linha da grade dá cerca de 118px de conteúdo, e o azulejo mais o botão já passam disso sozinhos.
 *
 * Server Component com CSS Module, porque é desenho parado; quem tem clique são os botões que chegam por
 * `children`.
 */
export function EmptyState({ icon: Glyph, title, description, size = "md", children }: EmptyStateProps) {
  return (
    <div className={styles.empty} data-size={size}>
      <div className={styles.head}>
        {/* O canto só existe onde há azulejo: em cartão o glifo é solto e não tem caixa para arredondar. */}
        <span className={styles.tile} aria-hidden="true" {...(size === "md" ? rounded("lg") : {})}>
          <Glyph />
        </span>
        <Text as="p" variant="callout" weight="semibold" className={styles.title}>
          {title}
        </Text>
      </div>

      <Text as="p" variant="footnote" tone="secondary" className={styles.line}>
        {description}
      </Text>

      {children && <div className={styles.actions}>{children}</div>}
    </div>
  );
}
