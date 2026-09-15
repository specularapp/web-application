import { Logo } from "@/components/layout/logo";
import styles from "./ai-mark.module.css";

export type AiMarkProps = {
  /** Altura do símbolo em pixels. */
  size?: number;
  className?: string;
};

/**
 * A marca do SpeculAI: o símbolo da casa vestido no degradê da IA, com um halo da própria cor saindo por
 * trás. Sem caixa nem azulejo atrás (a pedido, 2026-09-14, depois de uma rodada em azulejo de ícone de
 * aplicativo): solto, ele assenta na barra e na margem da conversa como qualquer glifo da casa.
 *
 * Server Component com CSS Module: é desenho parado, sem estado nenhum, e aparece no cabeçalho da coluna, no
 * vazio dela, na margem de cada resposta e no widget do topo de cada página, sempre igual.
 */
export function AiMark({ size = 18, className }: AiMarkProps) {
  return <Logo variant="icon" height={size} label="" className={className ? `${styles.glyph} ${className}` : styles.glyph} />;
}
