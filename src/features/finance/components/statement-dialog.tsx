"use client";

import { ArrowCounterClockwiseIcon, ArrowDownLeftIcon, ArrowUpRightIcon, CalendarBlankIcon, DownloadSimpleIcon, ListBulletsIcon, TagIcon, XIcon } from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import { PageToolbar } from "@/components/layout/page-toolbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, DataTableDate, DataTableTitle, type DataTableColumn } from "@/components/ui/data-table";
import { Dialog } from "@/components/ui/dialog";
import type { DropdownSection } from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { IconButton } from "@/components/ui/icon-button";
import { Pagination } from "@/components/ui/pagination";
import { Text } from "@/components/ui/text";
import { formatMoney } from "@/lib/utils/format";
import { accountDigits, accountIdentity, movementOrigins, signedOf, type AccountMovement, type FinanceAccount, type MovementOrigin } from "../accounts";
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
        <Statement key={account.id} account={account} movements={movements} today={today} onClose={onClose} />
      )}
    </Dialog>
  );
}

function Statement({ account, movements, today, onClose }: { account: FinanceAccount; movements: AccountMovement[]; today: string; onClose: () => void }) {
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

  /* As colunas na mesma ordem e no mesmo desenho da tabela de movimentações (2026-10-29, a pedido: "a tabela não
     está nos padrões e está confusa"): o movimento com a seta do lado e a descrição embaixo; o valor
     com sinal, na cor do texto na entrada e vermelho na saída, como lá; a data; o tipo; e o saldo que a conta
     ficou logo depois, que é o que só o extrato tem. */
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
      id: "value",
      header: "Valor",
      align: "end",
      cell: ({ movement }) => (
        <Text as="span" variant="subheadline" weight="semibold" className={styles.amount} data-kind={movement.kind}>
          {signedMoney(signedOf(movement))}
        </Text>
      ),
    },
    { id: "date", header: "Data", cell: ({ movement }) => <DataTableDate iso={movement.date} /> },
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
    {
      id: "balance",
      header: "Saldo",
      align: "end",
      cell: ({ balance }) => (
        <Text as="span" variant="footnote" weight="medium" tone={balance < 0 ? "danger" : "secondary"} className={styles.amount}>
          {formatMoney(balance)}
        </Text>
      ),
    },
  ];

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const shown = rows.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  const { title, subtitle } = accountIdentity(account);
  const digits = accountDigits(account);
  const filtered = query !== "" || origins.length > 0;

  return (
    <div className={styles.screen}>
      {/* A conta no lugar do cabeçalho, com o fechar dentro dela (2026-10-29, a pedido: "faça a parte da conta ficar
          no lugar do header, e o X fica dentro"): o tom do banco translúcido desde o topo da janela, a marca e o
          nome com o banco e o número. Os números de entrou, saiu e saldo saíram a pedido; o saldo depois de cada
          movimento está na tabela */}
      <header className={styles.hero} style={accountTone(account)}>
        <div className={styles.heroWho}>
          <AccountMark account={account} size="lg" />
          <span className={styles.ident}>
            <small>Extrato</small>
            <h2>{title}</h2>
            <small>{[subtitle, digits].filter(Boolean).join(" / ")}</small>
          </span>
        </div>
        <IconButton label="Fechar o extrato" variant="ghost" size="sm" onClick={onClose} className={styles.close}>
          <XIcon />
        </IconButton>
      </header>

      <div className={styles.body}>
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
    </div>
  );
}
