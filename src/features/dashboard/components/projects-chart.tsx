"use client";

import styled from "@emotion/styled";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Bar, BarChart, Tooltip, XAxis, type TooltipContentProps } from "recharts";
import { fadeIn } from "@/components/ui/styles";
import { VisuallyHidden } from "@/components/ui/visually-hidden";
import type { ProjectsMonth } from "@/features/projects/summary";
import { useMediaQuery } from "@/hooks/use-media-query";

export type ProjectsChartProps = { months: ProjectsMonth[] };

type ChartPoint = ProjectsMonth & { label: string };

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const BAR_RADIUS = 4;

/** Largura que um mês pede, em pixels: duas barras de uns 11px, o vão entre elas e o respiro do par. */
const MONTH_WIDTH = 32;
const MIN_MONTHS = 3;

/* Cor por classe, e não por atributo: `fill` como atributo não lê variável de CSS, e a regra de CSS
   ganha do atributo que o Recharts escreve. As duas séries são a mesma medida em dois tempos, então
   é o roxo do sistema em duas opacidades, e não duas cores. A faixa do hover é o preenchimento de
   hover da casa atrás do par de barras apontado. */
const Frame = styled.div`
  --series-started: color-mix(in oklab, var(--sys-purple) 35%, transparent);
  --series-completed: var(--sys-purple);

  width: 100%;
  height: 100%;
  min-height: 4rem;

  & .started .recharts-rectangle {
    fill: var(--series-started);
  }

  & .completed .recharts-rectangle {
    fill: var(--series-completed);
  }

  & .recharts-tooltip-cursor {
    fill: var(--color-fill-quaternary);
  }
`;

/* A dica é vidro, na receita das camadas da casa: fundo a 20% com borrão, fio fino e sombra, então as
   barras passam desfocadas por trás em vez de sumirem. Mês em cima, apagado; embaixo uma linha por
   série, com a bolinha na cor da barra, o nome e o número na outra ponta. Entra com um fade curto e
   sem seta, porque o Recharts é quem a posiciona. */
const Bubble = styled.div`
  --panel-line: 0.0375rem;

  display: grid;
  gap: var(--space-2);
  min-width: 9rem;
  padding: var(--space-3);
  font-family: var(--font-body);
  font-size: var(--text-footnote);
  line-height: var(--leading-tight);
  letter-spacing: var(--tracking-tight);
  color: var(--color-label);
  white-space: nowrap;
  background-color: var(--glass-layer-bg);
  border: var(--panel-line) solid var(--color-border);
  border-radius: var(--radius-lg);
  corner-shape: squircle;
  box-shadow: var(--shadow-lg);
  -webkit-backdrop-filter: var(--glass-layer-blur);
  backdrop-filter: var(--glass-layer-blur);
  animation: ${fadeIn} var(--duration-fast) var(--ease-standard) both;
`;

const Month = styled.span`
  font-size: var(--text-caption-1);
  font-weight: var(--weight-medium);
  color: var(--color-label-secondary);
`;

const Row = styled.span`
  display: flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--color-label-secondary);
`;

const Value = styled.span`
  margin-inline-start: auto;
  font-weight: var(--weight-semibold);
  font-variant-numeric: tabular-nums;
  color: var(--color-label);
`;

const Dot = styled.span`
  flex-shrink: 0;
  width: 0.5rem;
  height: 0.5rem;
  background-color: var(--dot);
  border-radius: var(--radius-full);
`;

function monthName(month: string) {
  const name = format(parseISO(`${month}-01`), "LLLL", { locale: ptBR });
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function ChartTip({ active, payload }: TooltipContentProps) {
  const point = payload[0]?.payload as ChartPoint | undefined;
  if (!active || !point) return null;

  return (
    <Bubble>
      <Month>{point.label}</Month>
      <Row>
        <Dot style={{ "--dot": "var(--series-started)" } as CSSProperties} aria-hidden="true" />
        Iniciados
        <Value>{point.started}</Value>
      </Row>
      <Row>
        <Dot style={{ "--dot": "var(--series-completed)" } as CSSProperties} aria-hidden="true" />
        Entregues
        <Value>{point.completed}</Value>
      </Row>
    </Bubble>
  );
}

// Duas barras por mês, nos meses mais recentes que couberem na largura: o gráfico mede a própria caixa
// e corta os mais antigos, então as barras têm sempre a mesma gordura e nada empurra o resumo ao lado.
// Sem eixo, grade ou texto: a leitura é a forma, e o número de cada mês aparece só na dica ao passar o
// ponteiro, presa dentro da área do gráfico para não sair da tela no celular. A leitura por voz vem do
// texto oculto ao lado, então o SVG fica fora da árvore acessível.
export function ProjectsChart({ months }: ProjectsChartProps) {
  const reducedMotion = useMediaQuery(REDUCED_MOTION_QUERY);
  const frameRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const node = frameRef.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(entry.contentRect.width);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // Sem medida ainda (servidor e primeiro quadro) não há gráfico: ele nasce no tamanho certo em vez de
  // pular de três meses para o que cabe.
  const visible = width > 0 ? Math.max(MIN_MONTHS, Math.min(months.length, Math.floor(width / MONTH_WIDTH))) : 0;
  const shown = visible > 0 ? months.slice(-visible) : [];
  const data: ChartPoint[] = shown.map((entry) => ({ ...entry, label: monthName(entry.month) }));

  return (
    <>
      <Frame ref={frameRef} aria-hidden="true">
        {data.length > 0 && (
          <BarChart
            responsive
            width="100%"
            height="100%"
            data={data}
            margin={{ top: 4, right: 0, bottom: 0, left: 0 }}
            barGap={2}
            barCategoryGap="12%"
            accessibilityLayer={false}
          >
            <XAxis dataKey="month" hide />
            <Tooltip
              content={ChartTip}
              cursor={{ radius: BAR_RADIUS }}
              offset={12}
              isAnimationActive={false}
              allowEscapeViewBox={{ x: false, y: false }}
              wrapperStyle={{ outline: "none", zIndex: 1 }}
            />
            <Bar
              dataKey="started"
              className="started"
              radius={[BAR_RADIUS, BAR_RADIUS, 0, 0]}
              maxBarSize={14}
              isAnimationActive={!reducedMotion}
            />
            <Bar
              dataKey="completed"
              className="completed"
              radius={[BAR_RADIUS, BAR_RADIUS, 0, 0]}
              maxBarSize={14}
              isAnimationActive={!reducedMotion}
            />
          </BarChart>
        )}
      </Frame>
      <VisuallyHidden as="ul">
        {months.map((entry) => (
          <li key={entry.month}>
            {monthName(entry.month)}: {entry.started} projetos iniciados e {entry.completed} entregues
          </li>
        ))}
      </VisuallyHidden>
    </>
  );
}
