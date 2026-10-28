"use client";

import { ArrowCounterClockwiseIcon, ArrowDownLeftIcon, ArrowUpRightIcon, CalendarBlankIcon, DownloadSimpleIcon, ListBulletsIcon, TagIcon } from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import { PageToolbar } from "@/components/layout/page-toolbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, DataTableDate, DataTableMoney, DataTableTitle, type DataTableColumn } from "@/components/ui/data-table";
import { Dialog, DialogHeader } from "@/components/ui/dialog";
import type { DropdownSection } from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { Text } from "@/components/ui/text";
import { formatMoney } from "@/lib/utils/format";
import { accountDigits, accountIdentity, isFlow, movementOrigins, signedOf, type AccountMovement, type FinanceAccount, type MovementOrigin } from "../accounts";
import { AccountMark, accountTone } from "./account-mark";
import { dateBr, signedMoney } from "./money";
import styles from "./statement-dialog.module.css";

type Period = "30" | "90" | "ano" | "tudo";

const periods: Record<Period, string> = { "30": "Últimos 30 dias", "90": "Últimos 90 dias", ano: "Este ano", tudo: "Desde a abertura" };

const originValues = ["manual", "charge", "transfer", "adjustment"] as const satisfies readonly MovementOrigin[];

type Row = { movement: AccountMovement; balance: number };

const PAGE_SIZE = 30;

const dayBefore = (iso: string, days: number) => new Date(Date.parse(`${iso}T00:00:00Z`) - days * 86_400_000).toISOString().slice(0, 10);

const normalize = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("pt-BR");

const csvCell = (value: string) => (/[";\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);

const csvMoney = (cents: number) => (cents / 100).toFixed(2).replace(".", ",");

/**
 * O extrato de uma conta (2026-10-27, da Le Ange): no alto a conta, no matiz dela, com o que entrou e saiu no
 * período e o saldo de agora; embaixo a barra da casa (busca, período, tipo e exportar) e a tabela de movimentos,
 * do mais novo ao mais antigo, com o saldo que a conta tinha logo depois de cada um.
 */
export function StatementDialog({ account, movements, today, onClose }: { account: FinanceAccount | null; movements: AccountMovement[]; today: string; onClose: () => void }) {
  return (
    <Dialog open={account !== null} onClose={onClose} label={account ? `Extrato de ${account.name}` : "Extrato"} size="xl" surface="solid" focusOnOpen={false} className={styles.window}>
      {account && (
        <>
          <DialogHeader title="Extrato" description={account.name} onClose={onClose} />
          <Statement key={account.id} account={account} movements={movements} today={today} />
        </>
      )}
    </Dialog>
  );
}

function Statement({ account, movements, today }: { account: FinanceAccount; movements: AccountMovement[]; today: string }) {
  const [query, setQuery] = useState("");
  const [period, setPeriod] = useState<Period>("30");
  const [origins, setOrigins] = useState<MovementOrigin[]>([]);
  const [page, setPage] = useState(1);

  // Todos os movimentos da conta, com o saldo logo depois de cada um, do primeiro ao último
  const all = useMemo<Row[]>(() => {
    const own = movements.filter((movement) => movement.accountId === account.id).toReversed();
    const rows: Row[] = [];
    for (const movement of own) rows.push({ movement, balance: (rows.at(-1)?.balance ?? account.openingBalance) + signedOf(movement) });
    return rows;
  }, [account, movements]);

  const since = period === "30" ? dayBefore(today, 29) : period === "90" ? dayBefore(today, 89) : period === "ano" ? `${today.slice(0, 4)}-01-01` : null;
  const inPeriod = useMemo(() => all.filter((row) => !since || row.movement.date >= since), [all, since]);

  const rows = useMemo(() => {
    const search = normalize(query.trim());
    return inPeriod
      .filter((row) => (origins.length === 0 || origins.includes(row.movement.origin)) && (!search || normalize(`${row.movement.title} ${row.movement.description}`).includes(search)))
      .toReversed();
  }, [inPeriod, origins, query]);

  // O que entrou e saiu no período, pela regra do cartão: só o que é dinheiro da empresa
  const totals = useMemo(() => {
    const real = inPeriod.filter((row) => isFlow(row.movement.origin));
    const sum = (kind: AccountMovement["kind"]) => real.filter((row) => row.movement.kind === kind).reduce((total, row) => total + row.movement.amount, 0);
    return { in: sum("in"), out: sum("out") };
  }, [inPeriod]);

  const toggleOrigin = (origin: MovementOrigin) => setOrigins((current) => (current.includes(origin) ? current.filter((value) => value !== origin) : [...current, origin]));

  const filterSections: DropdownSection[] = [
    {
      id: "period",
      label: "Período",
      items: (Object.keys(periods) as Period[]).map((value) => ({ id: `period-${value}`, label: periods[value], icon: CalendarBlankIcon, selected: period === value, keepOpen: true, onSelect: () => setPeriod(value) })),
    },
    {
      id: "origin",
      label: "Tipo",
      items: originValues.map((value) => ({
        id: `origin-${value}`,
        label: movementOrigins[value].label,
        icon: movementOrigins[value].icon,
        count: inPeriod.filter((row) => row.movement.origin === value).length,
        selected: origins.includes(value),
        keepOpen: true,
        onSelect: () => toggleOrigin(value),
      })),
    },
    ...(origins.length > 0 || period !== "30" ? [{ id: "reset", items: [{ id: "reset", label: "Limpar filtros", icon: ArrowCounterClockwiseIcon, onSelect: () => (setOrigins([]), setPeriod("30")) }] }] : []),
  ];

  const activeFilters = [
    ...(period !== "30" ? [{ id: "period", label: periods[period], icon: CalendarBlankIcon, onClear: () => setPeriod("30") }] : []),
    ...origins.map((origin) => ({ id: `origin-${origin}`, label: movementOrigins[origin].label, icon: TagIcon, onClear: () => toggleOrigin(origin) })),
  ];

  const exportCsv = () => {
    const lines = [
      ["Data", "Descrição", "Tipo", "Entrada", "Saída", "Saldo"],
      ...rows.map(({ movement, balance }) => [
        dateBr(movement.date),
        movement.description ? `${movement.title}: ${movement.description}` : movement.title,
        movementOrigins[movement.origin].label,
        movement.kind === "in" ? csvMoney(movement.amount) : "",
        movement.kind === "out" ? csvMoney(movement.amount) : "",
        csvMoney(balance),
      ]),
    ];
    const blob = new Blob([`﻿${lines.map((line) => line.map(csvCell).join(";")).join("\n")}`], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `extrato-${normalize(account.name).replace(/[^a-z0-9]+/g, "-")}-${today}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  /* As colunas no desenho das tabelas da casa (2026-10-27, a pedido: "padronize tudo"): o movimento em título,
     com a seta de entrada ou saída e a descrição embaixo, o tipo, a data, o valor com sinal e o saldo depois. */
  const columns: DataTableColumn<Row>[] = [
    {
      id: "title",
      header: "Movimento",
      cell: ({ movement }) => (
        <DataTableTitle
          title={movement.title}
          caption={movement.description || undefined}
          media={
            <span className={styles.direction} data-kind={movement.kind} aria-hidden="true">
              {movement.kind === "in" ? <ArrowDownLeftIcon /> : <ArrowUpRightIcon />}
            </span>
          }
        />
      ),
    },
    {
      id: "origin",
      header: "Tipo",
      hideBelow: "md",
      cell: ({ movement }) => {
        const { label, tone, icon: Glyph } = movementOrigins[movement.origin];
        return (
          <Badge tone={tone} size="sm" icon={<Glyph />}>
            {label}
          </Badge>
        );
      },
    },
    { id: "date", header: "Data", cell: ({ movement }) => <DataTableDate iso={movement.date} /> },
    {
      id: "value",
      header: "Valor",
      align: "end",
      cell: ({ movement }) => (
        <Text as="span" variant="subheadline" weight="semibold" className={styles.amount} data-kind={movement.kind}>
          {signedMoney(signedOf(movement))}
        </Text>
      ),
    },
    { id: "balance", header: "Saldo depois", align: "end", hideBelow: "md", cell: ({ balance }) => <DataTableMoney cents={balance} weight="medium" /> },
  ];

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const shown = rows.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  const { title, subtitle } = accountIdentity(account);
  const digits = accountDigits(account);
  const filtered = query !== "" || origins.length > 0;

  return (
    <div className={styles.screen}>
      {/* A conta, no matiz dela: quem é, o que entrou e saiu no período e o saldo de agora */}
      <div className={styles.hero} style={accountTone(account)}>
        <div className={styles.heroWho}>
          <AccountMark account={account} size="lg" />
          <span className={styles.ident}>
            <strong>{title}</strong>
            <small>{[subtitle, digits].filter(Boolean).join(" / ")}</small>
          </span>
        </div>
        <dl className={styles.heroFacts}>
          <div>
            <dt>Entrou no período</dt>
            <dd data-kind="in">{formatMoney(totals.in)}</dd>
          </div>
          <div>
            <dt>Saiu no período</dt>
            <dd data-kind="out">{formatMoney(totals.out)}</dd>
          </div>
          <div>
            <dt>Saldo atual</dt>
            <dd data-total="" data-negative={account.balance < 0 || undefined}>
              {formatMoney(account.balance)}
            </dd>
          </div>
        </dl>
      </div>

      <div className={styles.toolbar}>
        <PageToolbar
          search={{ value: query, onChange: (value) => (setQuery(value), setPage(1)), placeholder: "Buscar movimento", label: "Buscar movimentos pela descrição" }}
          filters={filterSections}
          activeFilters={activeFilters}
          action={
            <Button variant="outline" size="sm" radius="md" iconStart={<DownloadSimpleIcon />} disabled={rows.length === 0} onClick={exportCsv}>
              Exportar
            </Button>
          }
        />
      </div>

      <div className={styles.table}>
        <DataTable
          label={`Extrato de ${account.name}`}
          rows={shown}
          rowKey={(row) => row.movement.id}
          columns={columns}
          fill
          range={{ page: current, pageSize: PAGE_SIZE, total: rows.length }}
          footer={pageCount > 1 ? <Pagination page={current} pageSize={PAGE_SIZE} total={rows.length} onPageChange={setPage} label="Páginas do extrato" /> : undefined}
          empty={
            <EmptyState
              icon={ListBulletsIcon}
              size="sm"
              title={filtered ? "Nenhum movimento encontrado" : "Nenhum movimento no período"}
              description={filtered ? "Ajuste a busca ou o tipo." : "Escolha um período maior para ver o histórico da conta."}
            />
          }
        />
      </div>
    </div>
  );
}
