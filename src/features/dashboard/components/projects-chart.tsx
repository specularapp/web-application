"use client";

import styled from "@emotion/styled";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Bar, BarChart, Cell, Tooltip, XAxis, type TooltipContentProps } from "recharts";
import type { ProjectsMonth } from "@/features/projects/summary";
import { useMediaQuery } from "@/hooks/use-media-query";

export type ProjectsChartProps = { months: ProjectsMonth[] };

type ChartPoint = ProjectsMonth & { label: string };

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
/* A dica é hover, e hover não existe no toque: a regra da casa é que `:hover` só vale onde há ponteiro
   de verdade, e aqui vale igual. No celular quem mostra os números é a janela de métricas que o bloco
   abre ao toque, então a dica sai de cena em vez de ficar presa no último mês tocado. */
const POINTER_QUERY = "(hover: hover)";
const BAR_RADIUS = 4;
/** Quanto os meses fora do apontado apagam enquanto há um mês apontado. */
const DIMMED = 0.35;

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

  & .recharts-rectangle {
    transition: opacity var(--duration-base) var(--ease-standard);
  }

  & .recharts-tooltip-cursor {
    fill: var(--color-fill-quaternary);
  }
`;

/* A dica é vidro, na receita das camadas da casa: fundo a 20% com borrão, fio fino e sombra, então as
   barras passam desfocadas por trás em vez de sumirem. O mês em cima com o total do mês na outra ponta,
   um fio, e embaixo uma linha por série, com a bolinha na cor da barra, o nome e o número. Entra
   crescendo de baixo com a mola curta e sai só apagando, sem seta, porque o Recharts é quem a posiciona. */
const Bubble = styled.div`
  --panel-line: 0.0375rem;

  display: grid;
  gap: var(--space-2);
  min-width: 10rem;
  padding: var(--space-3) var(--space-4);
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
  opacity: 0;
  transform: translateY(6px) scale(0.96);
  transform-origin: bottom center;
  transition:
    opacity var(--duration-base) var(--ease-standard),
    transform var(--duration-base) var(--ease-standard);

  &[data-active] {
    opacity: 1;
    transform: none;
    transition:
      opacity var(--duration-base) var(--ease-standard),
      transform var(--duration-slow) var(--ease-spring);
  }

  @media (prefers-reduced-motion: reduce) {
    transform: none;
    transition: opacity var(--duration-fast) linear;
  }
`;

const Head = styled.span`
  display: flex;
  gap: var(--space-3);
  align-items: baseline;
  justify-content: space-between;
  padding-block-end: var(--space-2);
  border-block-end: var(--panel-line) solid var(--color-border);
`;

const Month = styled.span`
  font-size: var(--text-subheadline);
  font-weight: var(--weight-semibold);
  color: var(--color-label);
`;

const Total = styled.span`
  font-size: var(--text-caption-1);
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
  font-size: var(--text-subheadline);
  font-weight: var(--weight-semibold);
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

// A dica fica montada e só troca de opacidade, para aparecer e sumir com suavidade nas duas direções: o
// último mês apontado fica guardado em estado, ajustado durante o render como o React recomenda para
// estado derivado, para a caixa não esvaziar durante a saída. É componente (elemento passado ao
// Recharts, que preenche as props), por isso as props são parciais.
function ChartTip({ active, payload }: Partial<TooltipContentProps>) {
  const point = payload?.[0]?.payload as ChartPoint | undefined;
  const [last, setLast] = useState<ChartPoint | null>(point ?? null);
  if (point && point !== last) setLast(point);
  const shown = point ?? last;
  if (!shown) return null;

  return (
    <Bubble data-active={(active && point) || undefined}>
      <Head>
        <Month>{shown.label}</Month>
        <Total>{shown.started + shown.completed} no total</Total>
      </Head>
      <Row>
        <Dot style={{ "--dot": "var(--series-started)" } as CSSProperties} aria-hidden="true" />
        Iniciados
        <Value>{shown.started}</Value>
      </Row>
      <Row>
        <Dot style={{ "--dot": "var(--series-completed)" } as CSSProperties} aria-hidden="true" />
        Entregues
        <Value>{shown.completed}</Value>
      </Row>
    </Bubble>
  );
}

// Duas barras por mês, nos meses mais recentes que couberem na largura: o gráfico mede a própria caixa
// e corta os mais antigos, então as barras têm sempre a mesma gordura e nada empurra o resumo ao lado.
// Sem eixo, grade ou texto: a leitura é a forma, e o número de cada mês aparece só na dica ao passar o
// ponteiro ou ao tocar, presa dentro da área do gráfico para não sair da tela no celular, enquanto os
// outros meses apagam para o apontado sobrar (o mês vem do estado do gráfico nos eventos de ponteiro e
// toque, e as barras recebem a opacidade por `Cell`, com transição); a caixa dela
// fica sempre montada e o Recharts só a move (o `visibility` dele é forçado visível), então é a opacidade
// da própria dica que a faz aparecer e sumir com suavidade. A leitura por voz vem do
// texto oculto ao lado, então o SVG fica fora da árvore acessível.
export function ProjectsChart({ months }: ProjectsChartProps) {
  const reducedMotion = useMediaQuery(REDUCED_MOTION_QUERY);
  const pointer = useMediaQuery(POINTER_QUERY);
  const frameRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [hovered, setHovered] = useState<string | null>(null);

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
            onMouseMove={pointer ? (state) => setHovered(state.isTooltipActive && state.activeLabel != null ? String(state.activeLabel) : null) : undefined}
            onMouseLeave={pointer ? () => setHovered(null) : undefined}
          >
            <XAxis dataKey="month" hide />
            {pointer && (
              <Tooltip
                content={<ChartTip />}
                cursor={{ radius: 6 }}
                offset={14}
                isAnimationActive={!reducedMotion}
                animationDuration={160}
                animationEasing="ease-out"
                allowEscapeViewBox={{ x: false, y: false }}
                wrapperStyle={{ outline: "none", zIndex: 1, visibility: "visible" }}
              />
            )}
            <Bar
              dataKey="started"
              className="started"
              radius={[BAR_RADIUS, BAR_RADIUS, 0, 0]}
              maxBarSize={14}
              isAnimationActive={!reducedMotion}
            >
              {data.map((entry) => (
                <Cell key={entry.month} opacity={hovered && hovered !== entry.month ? DIMMED : 1} />
              ))}
            </Bar>
            <Bar
              dataKey="completed"
              className="completed"
              radius={[BAR_RADIUS, BAR_RADIUS, 0, 0]}
              maxBarSize={14}
              isAnimationActive={!reducedMotion}
            >
              {data.map((entry) => (
                <Cell key={entry.month} opacity={hovered && hovered !== entry.month ? DIMMED : 1} />
              ))}
            </Bar>
          </BarChart>
        )}
      </Frame>
    </>
  );
}
