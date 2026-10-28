"use client";

import type { CSSProperties } from "react";
import { Area, AreaChart, Bar, BarChart, Cell, Pie, PieChart, ReferenceDot, ReferenceLine, Tooltip, XAxis, YAxis, type TooltipContentProps } from "recharts";
import { useMediaQuery } from "@/hooks/use-media-query";
import { formatMoney } from "@/lib/utils/format";
import type { FlowPoint, ProjectionPoint, RankItem } from "../cash-flow";
import { signedMoney } from "./money";
import styles from "./cash-flow-charts.module.css";

/*
 * Os gráficos do fluxo de caixa (2026-10-27, da Le Ange): entradas e saídas por período, a projeção do saldo e as
 * saídas por categoria. Recharts, carregado só no cliente, com as cores por classe (atributo `fill` não lê
 * variável de CSS) e a dica de vidro do gráfico do painel. Cada um tem a leitura em texto ao lado, então o SVG fica
 * fora da árvore acessível.
 */

const POINTER_QUERY = "(hover: hover)";
const RADIUS = 4;

function FlowTip({ active, payload }: Partial<TooltipContentProps>) {
  const point = payload?.[0]?.payload as FlowPoint | undefined;
  if (!active || !point) return null;
  return (
    <div className={styles.bubble}>
      <span className={styles.head}>
        <strong>{point.label}</strong>
        <span>{signedMoney(point.result)}</span>
      </span>
      <span className={styles.row}>
        <i style={{ "--dot": "var(--chart-income)" } as CSSProperties} aria-hidden="true" />
        Entrou
        <b>{formatMoney(point.income)}</b>
      </span>
      <span className={styles.row}>
        <i style={{ "--dot": "var(--chart-expense)" } as CSSProperties} aria-hidden="true" />
        Saiu
        <b>{formatMoney(point.expense)}</b>
      </span>
    </div>
  );
}

/** Entradas e saídas lado a lado em cada balde do período. */
export function FlowChart({ points }: { points: FlowPoint[] }) {
  const pointer = useMediaQuery(POINTER_QUERY);
  return (
    <div className={styles.frame} aria-hidden="true">
      <BarChart responsive width="100%" height="100%" data={points} margin={{ top: 8, right: 4, bottom: 0, left: 4 }} barGap={2} barCategoryGap="24%" accessibilityLayer={false}>
        <XAxis dataKey="label" axisLine={false} tickLine={false} tickMargin={8} minTickGap={12} />
        <YAxis hide />
        {pointer && <Tooltip cursor={{ radius: RADIUS }} content={<FlowTip />} wrapperStyle={{ outline: "none", zIndex: 2 }} isAnimationActive={false} />}
        <Bar dataKey="income" className={styles.income} radius={[RADIUS, RADIUS, 0, 0]} maxBarSize={18} isAnimationActive={false} />
        <Bar dataKey="expense" className={styles.expense} radius={[RADIUS, RADIUS, 0, 0]} maxBarSize={18} isAnimationActive={false} />
      </BarChart>
    </div>
  );
}

function ProjectionTip({ active, payload }: Partial<TooltipContentProps>) {
  const point = payload?.[0]?.payload as ProjectionPoint | undefined;
  if (!active || !point) return null;
  return (
    <div className={styles.bubble}>
      <span className={styles.head}>
        <strong>{point.label}</strong>
      </span>
      <span className={styles.row}>
        Saldo previsto
        <b data-negative={point.balance < 0 || undefined}>{formatMoney(point.balance)}</b>
      </span>
    </div>
  );
}

/** O saldo dia a dia até 90 dias, com o ponto mais baixo marcado e a linha do zero quando ele passa abaixo. */
export function ProjectionChart({ points, lowest }: { points: ProjectionPoint[]; lowest: ProjectionPoint | null }) {
  const pointer = useMediaQuery(POINTER_QUERY);
  const negative = points.some((point) => point.balance < 0);
  return (
    <div className={styles.frame} data-negative={negative || undefined} aria-hidden="true">
      <AreaChart responsive width="100%" height="100%" data={points} margin={{ top: 12, right: 24, bottom: 0, left: 24 }} accessibilityLayer={false}>
        <XAxis dataKey="label" axisLine={false} tickLine={false} tickMargin={8} ticks={points.filter((_, index) => index % 30 === 0).map((point) => point.label)} />
        <YAxis hide domain={["dataMin", "dataMax"]} />
        {negative && <ReferenceLine y={0} className={styles.zero} />}
        {pointer && <Tooltip content={<ProjectionTip />} wrapperStyle={{ outline: "none", zIndex: 2 }} isAnimationActive={false} />}
        <Area type="monotone" dataKey="balance" className={styles.projection} strokeWidth={2} isAnimationActive={false} />
        {lowest && <ReferenceDot x={lowest.label} y={lowest.balance} r={5} className={styles.lowest} />}
      </AreaChart>
    </div>
  );
}

/** As saídas por categoria numa rosca, cada fatia na cor da categoria e uma folga da superfície entre elas. */
export function CategoryDonut({ items }: { items: RankItem[] }) {
  return (
    <div className={styles.donut} aria-hidden="true">
      <PieChart responsive width="100%" height="100%" accessibilityLayer={false}>
        <Pie data={items} dataKey="amount" nameKey="label" innerRadius="64%" outerRadius="100%" paddingAngle={items.length > 1 ? 2 : 0} stroke="none" isAnimationActive={false}>
          {items.map((item) => (
            <Cell key={item.id} style={{ fill: `var(--sys-${item.hue ?? "gray"})` }} />
          ))}
        </Pie>
      </PieChart>
    </div>
  );
}

