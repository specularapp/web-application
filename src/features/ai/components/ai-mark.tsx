import { Logo } from "@/components/layout/logo";
import styles from "./ai-mark.module.css";

/**
 * Como a marca se mexe. `still` é o glifo parado, para a barra e a margem da conversa; `idle` é a marca viva
 * da abertura, com o reflexo passando de tempos em tempos; `thinking` é enquanto a resposta não terminou, com
 * as cores correndo e o halo respirando.
 */
export type AiMarkMotion = "still" | "idle" | "thinking";

export type AiMarkProps = {
  /** Altura do símbolo em pixels. */
  size?: number;
  motion?: AiMarkMotion;
  className?: string;
};

/**
 * A marca do SpeculAI: o símbolo da casa vestido no degradê da IA, com um halo da própria cor. Viva, ela ganha
 * um **reflexo especular**, a faixa de luz que atravessa o símbolo como a luz numa superfície polida, que é de
 * onde vem o nome da casa. Com movimento reduzido ela fica sempre parada.
 */
export function AiMark({ size = 18, motion = "still", className }: AiMarkProps) {
  return (
    <Logo
      variant="icon"
      height={size}
      label=""
      aria-hidden="true"
      data-motion={motion}
      className={className ? `${styles.glyph} ${className}` : styles.glyph}
    />
  );
}
