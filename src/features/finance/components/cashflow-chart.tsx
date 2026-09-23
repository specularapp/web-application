"use client";

import styled from "@emotion/styled";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import { useState, type CSSProperties } from "react";
import { Bar, BarChart, Tooltip, XAxis, type TooltipContentProps } from "recharts";
import { useMediaQuery } from "@/hooks/use-media-query";
import { formatMoney } from "@/lib/utils/format";
import type { FinanceMonth } from "../summary";

export type CashflowChartProps = { months: FinanceMonth[] };

type ChartPoint = FinanceMonth & { name: string };

const POINTER_QUERY = "(hover: hover)";
const BAR_RADIUS = 4;

/* Cor por classe, e não por atributo, como no gráfico de projetos: `fill` como atributo não lê variável de
   CSS. Entradas em verde, saídas em vermelho, os tons do sistema. */
const Frame = styled.div`
  --series-income: var(--sys-green);
  --series-expense: color-mix(in oklab, var(--sys-red) 70%, transparent);

  width: 100%;
  height: 100%;
  min-height: 12rem;

  & .income .recharts-rectangle {
    fill: var(--series-income);
  }

  & .expense .recharts-rectangle {
    fill: var(--series-expense);
  }

  & .recharts-tooltip-cursor {
    fill: var(--color-fill-quaternary);
  }

  & .recharts-cartesian-axis-tick-value {
    font-family: var(--font-body);
    font-size: var(--text-caption1);
    fill: var(--color-label-secondary);
  }
`;

/* A dica é vidro, na receita das camadas da casa: o mês em cima com o saldo do mês na outra ponta, um fio,
   e embaixo uma linha por série, com a bolinha na cor da barra. */
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

const Net = styled.span`
  font-size: var(--text-caption1);
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

function monthName(month: string) {
  const name = format(parseISO(`${month}-01`), "LLLL", { locale: ptBR });
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function ChartTip({ active, payload }: Partial<TooltipContentProps>) {
  const point = payload?.[0]?.payload as ChartPoint | undefined;
  const [last, setLast] = useState<ChartPoint | null>(point ?? null);
  if (point && point !== last) setLast(point);
  const shown = point ?? last;
  if (!shown) return null;
  const net = shown.income - shown.expense;

  return (
    <Bubble data-active={(active && point) || undefined}>
      <Head>
        <Month>{monthName(shown.month)}</Month>
        <Net>
          {net >= 0 ? "+" : "-"}
          {formatMoney(Math.abs(net))} no mês
        </Net>
      </Head>
      <Row>
        <Dot style={{ "--dot": "var(--series-income)" } as CSSProperties} aria-hidden="true" />
        Entradas
        <Value>{formatMoney(shown.income)}</Value>
      </Row>
      <Row>
        <Dot style={{ "--dot": "var(--series-expense)" } as CSSProperties} aria-hidden="true" />
        Saídas
        <Value>{formatMoney(shown.expense)}</Value>
      </Row>
    </Bubble>
  );
}

// Duas barras por mês, entradas e saídas, nos últimos seis meses, com o nome curto do mês embaixo e o
// número de cada um na dica ao passar o ponteiro. Sem grade nem eixo de valor: a leitura é a forma. A
// leitura por voz vem da lista ao lado do gráfico, então o SVG fica fora da árvore acessível.
export function CashflowChart({ months }: CashflowChartProps) {
  const pointer = useMediaQuery(POINTER_QUERY);
  const data: ChartPoint[] = months.map((entry) => ({ ...entry, name: entry.label }));

  return (
    <Frame aria-hidden="true">
      <BarChart responsive width="100%" height="100%" data={data} margin={{ top: 8, right: 4, bottom: 0, left: 4 }} barGap={3} barCategoryGap="22%" accessibilityLayer={false}>
        <XAxis dataKey="name" axisLine={false} tickLine={false} tickMargin={8} />
        {pointer && <Tooltip cursor={{ radius: BAR_RADIUS }} content={<ChartTip />} wrapperStyle={{ outline: "none", visibility: "visible", zIndex: 2 }} isAnimationActive={false} />}
        <Bar dataKey="income" className="income" radius={[BAR_RADIUS, BAR_RADIUS, 0, 0]} isAnimationActive={false} />
        <Bar dataKey="expense" className="expense" radius={[BAR_RADIUS, BAR_RADIUS, 0, 0]} isAnimationActive={false} />
      </BarChart>
    </Frame>
  );
}
