"use client";

import { useEffect, useRef, useState } from "react";
import { formatMoney } from "@/lib/utils/format";

export type AnimatedNumberProps = {
  value: number;
  /** Como o número aparece: sem isso, ele sai por extenso em pt-BR. */
  format?: (value: number) => string;
  className?: string;
};

/** Quanto tempo a contagem leva do valor antigo ao novo. Curto: é confirmação, não espetáculo. */
const DURATION = 420;

/* A saída padrão do movimento da casa, a mesma curva de `--ease-standard`: começa rápido e assenta. */
const ease = (t: number) => 1 - (1 - t) ** 3;

const numberFormat = new Intl.NumberFormat("pt-BR");

// Um número que conta do valor antigo até o novo quando ele muda (pedido de 2026-09-09, para os totais do
// orçamento): a pessoa mexe na quantidade e vê o total caminhar, em vez de pular. Anima em
// `requestAnimationFrame`, então não há transição de layout nem trabalho fora do quadro; com movimento
// reduzido, e no primeiro desenho, o valor entra direto, porque a regra da casa é sobre deslocamento e
// contagem também é movimento. Server Component pode montá-lo: quem anima é o cliente, e o servidor
// desenha o valor final.
export function AnimatedNumber({ value, format = (amount) => numberFormat.format(Math.round(amount)), className }: AnimatedNumberProps) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    const start = from.current;
    if (start === value) return;

    // Com movimento reduzido a contagem acaba no primeiro quadro: o valor entra direto, sem que o estado
    // seja escrito de dentro do efeito, que é o que a regra dos hooks pede.
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const began = performance.now();
    const step = (now: number) => {
      const progress = reduced ? 1 : Math.min(1, (now - began) / DURATION);
      const current = start + (value - start) * ease(progress);
      setShown(progress === 1 ? value : current);
      if (progress < 1) frame.current = window.requestAnimationFrame(step);
      else from.current = value;
    };

    frame.current = window.requestAnimationFrame(step);
    return () => {
      if (frame.current !== null) window.cancelAnimationFrame(frame.current);
      // Interrompida no meio, a próxima contagem parte de onde esta parou, e não do valor antigo.
      from.current = value;
    };
  }, [value]);

  return (
    <span className={className} aria-live="off">
      {format(shown)}
    </span>
  );
}

/** Dinheiro em centavos que conta até o novo valor: a peça que os totais do orçamento usam. */
export function AnimatedMoney({ cents, className }: { cents: number; className?: string }) {
  return <AnimatedNumber value={cents} format={(amount) => formatMoney(Math.round(amount))} className={className} />;
}
