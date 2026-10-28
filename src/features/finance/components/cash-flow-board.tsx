"use client";

import { ArrowDownLeftIcon, ArrowUpRightIcon, DownloadSimpleIcon, PlusIcon, WarningCircleIcon } from "@phosphor-icons/react";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Progress } from "@/components/ui/progress";
import { Select } from "@/components/ui/select";
import { Text } from "@/components/ui/text";
import { formatMoney } from "@/lib/utils/format";
import { cashFlowReport, cashPeriods, changeOf, type CashPeriod, type RankItem } from "../cash-flow";
import { installmentLabelOf, type InstallmentEntry } from "../installments";
import { chargeMethods, dueLabel, dueTone } from "../labels";
import type { CashFlowData } from "../movements";
import { AccountMark } from "./account-mark";
import { CategoryDonut, FlowChart, ProjectionChart } from "./cash-flow-charts-lazy";
import { dateBr, signedMoney } from "./money";
import { Sparkline } from "./sparkline";
import { TransactionFormDialog } from "./transaction-form-dialog";
import styles from "./cash-flow-board.module.css";

const ALL = "todas";

const periodOptions = (Object.keys(cashPeriods) as CashPeriod[]).map((value) => ({ value, label: cashPeriods[value] }));

const percent = (fraction: number) => `${Math.round(fraction * 100)}%`;

/** "12% acima do período anterior", ou nada quando o anterior foi zero. */
function Change({ current, previous, inverse = false }: { current: number; previous: number; inverse?: boolean }) {
  const change = changeOf(current, previous);
  if (change === null || change === 0) return null;
  const good = inverse ? change < 0 : change > 0;
  return (
    <span className={styles.change} data-good={good || undefined}>
      {change > 0 ? <ArrowUpRightIcon aria-hidden="true" /> : <ArrowDownLeftIcon aria-hidden="true" />}
      {percent(Math.abs(change))} {change > 0 ? "acima" : "abaixo"} do anterior
    </span>
  );
}

function Kpi({ label, value, caption, spark, hue, children }: { label: string; value: string; caption?: string; spark?: number[]; hue: string; children?: ReactNode }) {
  return (
    <article className={styles.kpi} style={{ "--account": `var(--sys-${hue})` } as CSSProperties}>
      <span className={styles.kpiLabel}>{label}</span>
      <strong className={styles.kpiValue}>{value}</strong>
      {caption && <span className={styles.kpiCaption}>{caption}</span>}
      {children}
      {spark && spark.length > 1 && (
        <div className={styles.kpiSpark}>
          <Sparkline values={spark} label={`${label} ao longo do período`} />
        </div>
      )}
    </article>
  );
}

function Ranking({ title, items, empty, render }: { title: string; items: RankItem[]; empty: string; render?: (item: RankItem) => ReactNode }) {
  const top = items.slice(0, 6);
  const max = top[0]?.amount ?? 0;
  return (
    <section className={styles.card} aria-label={title}>
      <Text as="h3" variant="subheadline" weight="semibold">
        {title}
      </Text>
      {top.length === 0 ? (
        <Text as="p" variant="footnote" tone="secondary">
          {empty}
        </Text>
      ) : (
        <ol className={styles.ranking}>
          {top.map((item) => (
            <li key={item.id} style={{ "--bar": `var(--sys-${item.hue ?? "blue"})` } as CSSProperties}>
              <span className={styles.rankName}>{render ? render(item) : item.label}</span>
              <span className={styles.rankValue}>{formatMoney(item.amount)}</span>
              <span className={styles.rankBar} aria-hidden="true">
                <i style={{ inlineSize: `${max > 0 ? Math.max(2, (item.amount / max) * 100) : 0}%` }} />
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function DueList({ title, entries, today, empty }: { title: string; entries: InstallmentEntry[]; today: string; empty: string }) {
  return (
    <section className={styles.card} aria-label={title}>
      <header className={styles.cardHead}>
        <Text as="h3" variant="subheadline" weight="semibold">
          {title}
        </Text>
        {entries.length > 0 && (
          <Text as="span" variant="caption1" tone="secondary">
            {entries.length === 1 ? "1 parcela" : `${entries.length} parcelas`}
          </Text>
        )}
      </header>
      {entries.length === 0 ? (
        <Text as="p" variant="footnote" tone="secondary">
          {empty}
        </Text>
      ) : (
        <ul className={styles.dues}>
          {entries.slice(0, 6).map((entry) => (
            <li key={entry.id}>
              <Link href={(entry.direction === "outgoing" ? "/financeiro/a-pagar" : "/financeiro/a-receber") as Route} className={styles.due}>
                <span className={styles.dueSide} data-kind={entry.direction} aria-hidden="true">
                  {entry.direction === "incoming" ? <ArrowDownLeftIcon /> : <ArrowUpRightIcon />}
                </span>
                <Avatar name={entry.party.name} src={entry.party.avatarUrl ?? undefined} size="xs" />
                <span className={styles.dueCopy}>
                  <strong>{entry.party.standalone ? entry.title : (entry.party.company ?? entry.party.name)}</strong>
                  <small>
                    {entry.title}, {installmentLabelOf(entry).toLocaleLowerCase("pt-BR")}
                  </small>
                </span>
                <span className={styles.dueEnd}>
                  <strong data-kind={entry.direction}>{signedMoney(entry.direction === "incoming" ? entry.amount : -entry.amount)}</strong>
                  <Badge tone={dueTone(entry.dueDate, today)} size="sm">
                    {dueLabel(entry.dueDate, today)}
                  </Badge>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const csvCell = (value: string) => (/[";\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
const csvMoney = (cents: number) => (cents / 100).toFixed(2).replace(".", ",");

/**
 * O fluxo de caixa (2026-10-27, fase 5 da vinda do financeiro da Le Ange, no lugar da visão geral): o período e a
 * conta em cima; o resultado em destaque com o que entrou e saiu e quanto do que está por vir está em dia; oito
 * números com a curva do período; entradas e saídas por balde; as saídas por categoria; o saldo projetado para 90
 * dias com o ponto mais baixo; três rankings; e o que está atrasado e o que vence em 30 dias. Tudo é calculado
 * aqui, no navegador: trocar o período ou a conta não volta ao servidor.
 */
export function CashFlowBoard(data: CashFlowData) {
  const router = useRouter();
  const [period, setPeriod] = useState<CashPeriod>("mes");
  const [accountId, setAccountId] = useState<string>(ALL);
  const [creating, setCreating] = useState(false);
  const report = useMemo(() => cashFlowReport(data, period, accountId === ALL ? null : accountId), [data, period, accountId]);

  const { totals, previous, series } = report;
  const periodName = cashPeriods[period].toLocaleLowerCase("pt-BR");
  const flow = totals.inflow + totals.outflow;
  const margin = totals.inflow > 0 ? totals.result / totals.inflow : null;
  const accounts = data.accounts.filter((account) => account.active);
  const accountOptions = [
    { value: ALL, label: "Todas as contas" },
    ...accounts.map((account) => ({ value: account.id, label: account.name, media: <AccountMark account={account} /> })),
  ];

  const exportCsv = () => {
    const lines = [
      ["Data", "Movimentação", "Descrição", "Tipo", "Valor"],
      ...report.movements.map((entry) => [dateBr(entry.date), entry.title, entry.description, entry.kind === "income" ? "Entrada" : "Saída", csvMoney(entry.kind === "income" ? entry.amount : -entry.amount)]),
    ];
    const blob = new Blob([`﻿${lines.map((line) => line.map(csvCell).join(";")).join("\n")}`], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `fluxo-de-caixa-${report.range.from}-a-${report.range.to}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <div className={styles.board}>
      <div className={styles.toolbar}>
        <div className={styles.filters}>
          <Select<CashPeriod> label="Período" size="sm" options={periodOptions} value={period} onChange={setPeriod} />
          {accounts.length > 1 && <Select<string> label="Conta" size="sm" options={accountOptions} value={accountId} onChange={setAccountId} />}
        </div>
        <span className={styles.wide}>
          <Button variant="outline" size="sm" radius="md" iconStart={<DownloadSimpleIcon />} disabled={report.movements.length === 0} onClick={exportCsv}>
            Exportar
          </Button>
          <Button size="sm" radius="md" iconStart={<PlusIcon />} onClick={() => setCreating(true)}>
            Nova movimentação
          </Button>
        </span>
        <span className={styles.narrow}>
          <IconButton label="Nova movimentação" size="sm" radius="md" onClick={() => setCreating(true)}>
            <PlusIcon />
          </IconButton>
        </span>
      </div>

      {/* O destaque: o resultado do período, o que entrou e saiu com a barra da proporção, e o que está em dia */}
      <section className={styles.highlight} aria-label="Resultado do período">
        <div className={styles.result}>
          <span className={styles.kpiLabel}>Resultado, {periodName}</span>
          <strong data-negative={totals.result < 0 || undefined}>{signedMoney(totals.result)}</strong>
          <Change current={totals.result} previous={previous.result} />
          <div className={styles.split}>
            <span data-kind="in">
              <ArrowDownLeftIcon aria-hidden="true" /> Entrou <b>{formatMoney(totals.inflow)}</b>
            </span>
            <span data-kind="out">
              <ArrowUpRightIcon aria-hidden="true" /> Saiu <b>{formatMoney(totals.outflow)}</b>
            </span>
            {margin !== null && (
              <span>
                Margem <b>{percent(margin)}</b>
              </span>
            )}
          </div>
          <span className={styles.splitBar} role="img" aria-label={flow > 0 ? `${percent(totals.inflow / flow)} do movimento foi entrada` : "Sem movimento no período"}>
            {flow > 0 && (
              <>
                <i data-kind="in" style={{ flexGrow: totals.inflow }} />
                <i data-kind="out" style={{ flexGrow: totals.outflow }} />
              </>
            )}
          </span>
        </div>
        <div className={styles.gauges}>
          <div>
            <span className={styles.kpiLabel}>A receber em dia</span>
            <strong>{report.receivableOnTime === null ? "Nada pendente" : percent(report.receivableOnTime)}</strong>
            {report.receivableOnTime !== null && <Progress variant="bar" value={report.receivableOnTime * 100} max={100} size="xs" tone={report.receivableOnTime !== null && report.receivableOnTime < 0.8 ? "danger" : "success"} aria-label="Parte do que está por receber que ainda não venceu" />}
          </div>
          <div>
            <span className={styles.kpiLabel}>A pagar em dia</span>
            <strong>{report.payableOnTime === null ? "Nada pendente" : percent(report.payableOnTime)}</strong>
            {report.payableOnTime !== null && <Progress variant="bar" value={report.payableOnTime * 100} max={100} size="xs" tone={report.payableOnTime !== null && report.payableOnTime < 0.8 ? "danger" : "success"} aria-label="Parte do que está por pagar que ainda não venceu" />}
          </div>
        </div>
      </section>

      <div className={styles.kpis}>
        <Kpi label="Entrou" value={formatMoney(totals.inflow)} spark={series.map((point) => point.income)} hue="green">
          <Change current={totals.inflow} previous={previous.inflow} />
        </Kpi>
        <Kpi label="Saiu" value={formatMoney(totals.outflow)} spark={series.map((point) => point.expense)} hue="red">
          <Change current={totals.outflow} previous={previous.outflow} inverse />
        </Kpi>
        <Kpi label="Resultado" value={signedMoney(totals.result)} spark={series.map((point) => point.result)} hue="indigo">
          <Change current={totals.result} previous={previous.result} />
        </Kpi>
        <Kpi label="Saldo nas contas" value={formatMoney(report.balance)} spark={series.map((point) => point.balance)} hue="blue" caption="Hoje" />
        <Kpi label="Recebimentos" value={String(totals.countIn)} spark={series.map((point) => point.countIn)} hue="teal" caption={totals.countIn === 1 ? "entrada no período" : "entradas no período"} />
        <Kpi label="Pagamentos" value={String(totals.countOut)} spark={series.map((point) => point.countOut)} hue="orange" caption={totals.countOut === 1 ? "saída no período" : "saídas no período"} />
        <Kpi label="A receber em 30 dias" value={formatMoney(report.receivable30)} hue="mint" caption={report.receivableCount30 === 1 ? "1 parcela" : `${report.receivableCount30} parcelas`} />
        <Kpi label="A pagar em 30 dias" value={formatMoney(report.payable30)} hue="pink" caption={report.payableCount30 === 1 ? "1 parcela" : `${report.payableCount30} parcelas`} />
      </div>

      <div className={styles.pair}>
        <section className={styles.card} aria-label="Entradas e saídas">
          <header className={styles.cardHead}>
            <Text as="h3" variant="subheadline" weight="semibold">
              Entradas e saídas
            </Text>
            <span className={styles.legend}>
              <span data-kind="in">Entradas</span>
              <span data-kind="out">Saídas</span>
            </span>
          </header>
          <div className={styles.chart}>
            <FlowChart points={series} />
          </div>
        </section>

        <section className={styles.card} aria-label="Saídas por categoria">
          <header className={styles.cardHead}>
            <Text as="h3" variant="subheadline" weight="semibold">
              Saídas por categoria
            </Text>
          </header>
          {report.outByCategory.length === 0 ? (
            <Text as="p" variant="footnote" tone="secondary">
              Nenhuma saída {periodName}.
            </Text>
          ) : (
            <div className={styles.donutRow}>
              <div className={styles.donutBox}>
                <CategoryDonut items={report.outByCategory.slice(0, 7)} />
              </div>
              <ul className={styles.donutLegend}>
                {report.outByCategory.slice(0, 7).map((item) => (
                  <li key={item.id} style={{ "--dot": `var(--sys-${item.hue ?? "gray"})` } as CSSProperties}>
                    <i aria-hidden="true" />
                    <span>{item.label}</span>
                    <b>{percent(item.amount / Math.max(1, totals.outflow))}</b>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>

      {/* O saldo projetado: de hoje a 90 dias, com o que vence entrando e saindo, e o ponto mais baixo */}
      <section className={styles.card} aria-label="Saldo projetado">
        <header className={styles.cardHead}>
          <Text as="h3" variant="subheadline" weight="semibold">
            Saldo projetado
          </Text>
          <Text as="span" variant="caption1" tone="secondary">
            O saldo de hoje mais o que vence a receber, menos o que vence a pagar
          </Text>
        </header>
        <dl className={styles.milestones}>
          <div>
            <dt>Hoje</dt>
            <dd>{formatMoney(report.balance)}</dd>
          </div>
          {report.projectionAt.map((milestone) => (
            <div key={milestone.days}>
              <dt>Em {milestone.days} dias</dt>
              <dd data-negative={milestone.balance < 0 || undefined}>{formatMoney(milestone.balance)}</dd>
            </div>
          ))}
          {report.lowest && (
            <div data-lowest="">
              <dt>
                <WarningCircleIcon aria-hidden="true" /> Ponto mais baixo
              </dt>
              <dd data-negative={report.lowest.balance < 0 || undefined}>
                {formatMoney(report.lowest.balance)} <small>em {dateBr(report.lowest.date)}</small>
              </dd>
            </div>
          )}
        </dl>
        <div className={styles.chart}>
          <ProjectionChart points={report.projection} lowest={report.lowest} />
        </div>
      </section>

      <div className={styles.triple}>
        <Ranking title="Entradas por categoria" items={report.inByCategory} empty={`Nenhuma entrada ${periodName}.`} />
        <Ranking title="Saídas por fornecedor" items={report.outByParty.map((item) => ({ ...item, hue: "orange" }))} empty={`Nenhuma saída ${periodName}.`} />
        <Ranking
          title="Entradas por forma"
          items={report.inByMethod.map((item) => ({ ...item, hue: "teal" }))}
          empty={`Nenhuma entrada ${periodName}.`}
          render={(item) => {
            if (!item.method) return "Sem forma";
            const method = chargeMethods[item.method];
            return (
              <span className={styles.method}>
                <method.icon aria-hidden="true" />
                {method.label}
              </span>
            );
          }}
        />
      </div>

      <div className={styles.pair}>
        <DueList title="Atrasadas" entries={report.overdue} today={data.today} empty="Nenhuma parcela atrasada. Ótimo sinal." />
        <DueList title="Próximos vencimentos" entries={report.upcoming} today={data.today} empty="Nada vence nos próximos 30 dias." />
      </div>

      <TransactionFormDialog
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={() => {
          setCreating(false);
          router.refresh();
        }}
      />
    </div>
  );
}
