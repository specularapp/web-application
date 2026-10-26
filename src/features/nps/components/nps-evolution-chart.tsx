"use client";

import styled from "@emotion/styled";
import { useState, type CSSProperties } from "react";
import { Bar, BarChart, ReferenceLine, Tooltip, XAxis, YAxis, type TooltipContentProps } from "recharts";
import { useMediaQuery } from "@/hooks/use-media-query";
import { monthName, type EvolutionPoint } from "../analytics";
import { formatCount, formatNps, formatShare, groupLabels, groups } from "../labels";

export type NpsEvolutionMode = "nps" | "groups";

const POINTER_QUERY = "(hover: hover)";
const BAR_RADIUS = 4;

/* Cor por classe, como no gráfico de entradas e saídas: `fill` como atributo não lê variável de CSS. O NPS é
   uma série só, no azul de acento; a composição usa as três faixas, com 2px na cor da superfície entre as
   fatias empilhadas. */
const Frame = styled.div`
  --series-nps: var(--sys-blue);

  width: 100%;
  height: 100%;
  min-height: 12rem;

  & .nps .recharts-rectangle {
    fill: var(--series-nps);
  }

  & .promoter .recharts-rectangle {
    fill: var(--sys-green);
  }

  & .passive .recharts-rectangle {
    fill: var(--sys-yellow);
  }

  & .detractor .recharts-rectangle {
    fill: var(--sys-red);
  }

  & .promoter .recharts-rectangle,
  & .passive .recharts-rectangle,
  & .detractor .recharts-rectangle {
    stroke: var(--color-bg);
    stroke-width: 2px;
  }

  & .recharts-tooltip-cursor {
    fill: var(--color-fill-quaternary);
  }

  & .recharts-reference-line line {
    stroke: var(--color-border);
  }

  & .recharts-cartesian-axis-tick-value {
    font-family: var(--font-body);
    font-size: var(--text-caption-1);
    fill: var(--color-label-secondary);
  }
`;

const Bubble = styled.div`
  --panel-line: 0.0375rem;

  display: grid;
  gap: var(--space-2);
  min-width: 12rem;
  padding: var(--space-3) var(--space-4);
  font-family: var(--font-body);
  font-size: var(--text-footnote);
  line-height: var(--leading-tight);
  letter-spacing: var(--tracking-tight);
  color: var(--color-label);
  white-space: nowrap;
  background-color: var(--glass-sheet-bg);
  border: var(--panel-line) solid var(--color-border);
  border-radius: var(--radius-lg);
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
`;

const Note = styled.span`
  font-size: var(--text-caption-1);
  color: var(--color-label-secondary);
`;

const Row = styled.span`
  display: flex;
  gap: var(--space-2);
  align-items: center;
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

type ChartPoint = EvolutionPoint & { npsValue: number; promoterShare: number; passiveShare: number; detractorShare: number };

function ChartTip({ active, payload }: Partial<TooltipContentProps>) {
  const point = payload?.[0]?.payload as ChartPoint | undefined;
  const [last, setLast] = useState<ChartPoint | null>(point ?? null);
  if (point && point !== last) setLast(point);
  const shown = point ?? last;
  if (!shown) return null;

  return (
    <Bubble data-active={(active && point) || undefined}>
      <Head>
        <Month>{monthName(shown.key)}</Month>
        <Note>{shown.count === 1 ? "1 resposta" : `${formatCount(shown.count)} respostas`}</Note>
      </Head>
      <Row>
        <Dot style={{ "--dot": "var(--sys-blue)" } as CSSProperties} aria-hidden="true" />
        NPS
        <Value>{formatNps(shown.nps)}</Value>
      </Row>
      {groups.map((group) => (
        <Row key={group}>
          <Dot style={{ "--dot": groupLabels[group].color } as CSSProperties} aria-hidden="true" />
          {groupLabels[group].plural}
          <Value>{formatShare(shown.shares[group])}</Value>
        </Row>
      ))}
    </Bubble>
  );
}

/**
 * A evolução do NPS mês a mês. Em "NPS" é uma série só, com a linha do zero; em "Faixas" é a composição em
 * 100%, promotores embaixo. Um eixo só nos dois. A leitura por número fica na lista que a tela desenha
 * embaixo, então o SVG sai da árvore acessível.
 */
export function NpsEvolutionChart({ points, mode }: { points: EvolutionPoint[]; mode: NpsEvolutionMode }) {
  const pointer = useMediaQuery(POINTER_QUERY);
  const data: ChartPoint[] = points.map((point) => ({
    ...point,
    npsValue: point.nps ?? 0,
    promoterShare: point.shares.promoter,
    passiveShare: point.shares.passive,
    detractorShare: point.shares.detractor,
  }));
  const lowest = Math.min(0, ...data.map((point) => point.npsValue));

  return (
    <Frame aria-hidden="true">
      <BarChart responsive width="100%" height="100%" data={data} margin={{ top: 8, right: 4, bottom: 0, left: 4 }} barCategoryGap="28%" maxBarSize={44} accessibilityLayer={false}>
        <XAxis dataKey="label" axisLine={false} tickLine={false} tickMargin={8} />
        {mode === "nps" ? (
          <>
            <YAxis hide domain={[lowest < 0 ? -100 : 0, 100]} />
            <ReferenceLine y={0} />
            <Bar dataKey="npsValue" className="nps" radius={[BAR_RADIUS, BAR_RADIUS, 0, 0]} isAnimationActive={false} />
          </>
        ) : (
          <>
            <YAxis hide domain={[0, 100]} />
            <Bar dataKey="promoterShare" stackId="groups" className="promoter" isAnimationActive={false} />
            <Bar dataKey="passiveShare" stackId="groups" className="passive" isAnimationActive={false} />
            <Bar dataKey="detractorShare" stackId="groups" className="detractor" radius={[BAR_RADIUS, BAR_RADIUS, 0, 0]} isAnimationActive={false} />
          </>
        )}
        {pointer && <Tooltip cursor={{ radius: BAR_RADIUS }} content={<ChartTip />} wrapperStyle={{ outline: "none", visibility: "visible", zIndex: 2 }} isAnimationActive={false} />}
      </BarChart>
    </Frame>
  );
}
