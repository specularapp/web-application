"use client";

import { ArrowDownLeftIcon, ArrowUpRightIcon, CalendarBlankIcon, CalendarCheckIcon, CaretDownIcon, ChartBarIcon, PlusIcon, ReceiptIcon, WarningCircleIcon } from "@phosphor-icons/react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import type { Route } from "next";
import { usePathname, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { startTransition, useState, type CSSProperties, type ReactNode } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DetailsTrigger } from "@/components/ui/details-dialog";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { IconButton } from "@/components/ui/icon-button";
import { Text } from "@/components/ui/text";
import { rounded } from "@/lib/corners";
import { formatMoney } from "@/lib/utils/format";
import { chargeDirections, dueLabel, dueTone, financePeriods, installmentLabel, transactionKinds } from "../labels";
import { chargePath } from "../share";
import type { FinanceOverview, FinancePeriod, Transaction, TransactionKind, UpcomingInstallment } from "../summary";
import { CashflowChart } from "./cashflow-chart-lazy";
import { CashCard } from "./cash-card";
import { TransactionParty } from "./transaction-party";
import { TransactionReceipt } from "./transaction-receipt";
import { useOpenedOnce } from "@/hooks/use-opened-once";
import { useTabList } from "@/hooks/use-tab-list";
import styles from "./finance-overview.module.css";

/* A nova movimentação entra por importação dinâmica, montada só na primeira abertura (varredura de peso de
   2026-09-21): a visão geral já carrega o gráfico, e o formulário leva seletor de data e de cliente. */
const TransactionFormDialog = dynamic(() => import("./transaction-form-dialog").then((module) => module.TransactionFormDialog));

export type FinanceOverviewBoardProps = { overview: FinanceOverview };

type KindFilter = "all" | TransactionKind;

const kindFilters: { value: KindFilter; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "income", label: "Entradas" },
  { value: "expense", label: "Saídas" },
  { value: "scheduled", label: "Previstas" },
];

/* A ordem em que a seta do teclado percorre o filtro. */
const kindFilterValues = kindFilters.map((entry) => entry.value);

/** Quantas movimentações a lista mostra de uma vez. */
const SHOWN = 40;

function dayLabel(transaction: Transaction) {
  const day = format(parseISO(transaction.date), "d MMM. yyyy", { locale: ptBR });
  return transaction.kind === "scheduled" ? `Previsto ${day}` : day;
}

// A prancha da visão geral do financeiro (2026-09-15, a pedido, sobre a lógica do bloco do painel): em cima o
// período e "Nova movimentação"; o caixa vestido de cartão ao lado dos quatro números do período (recebido,
// saídas, a receber, em atraso); o gráfico de entradas e saídas dos últimos seis meses ao lado do que vence
// nos próximos dias e do que já venceu, que levam à cobrança; e, embaixo, as movimentações, com o filtro por
// tipo e o recibo de cada uma ao clique, na receita do painel. Tudo vem do servidor pelo período da URL.
export function FinanceOverviewBoard({ overview }: FinanceOverviewBoardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [kind, setKind] = useState<KindFilter>("all");
  const [adding, setAdding] = useState(false);
  /* As janelas pesadas nascem só na primeira abertura, e seguem montadas depois, para a saída animar. */
  const addReady = useOpenedOnce(adding);
  const kindTabs = useTabList(kindFilterValues, kind, setKind);

  const changePeriod = (period: FinancePeriod) => {
    const search = period === "mes" ? "" : `?periodo=${period}`;
    startTransition(() => router.replace(`${pathname}${search}` as Route, { scroll: false }));
  };

  const periodLabel = financePeriods.find((entry) => entry.value === overview.period)?.label ?? "Este mês";
  const net = overview.received - overview.expenses;
  const shown = overview.transactions.filter((transaction) => kind === "all" || transaction.kind === kind);

  const openCharge = (entry: UpcomingInstallment) => router.push(chargePath(entry.chargeId, entry.direction) as Route);

  return (
    <div className={styles.board}>
      <div className={styles.head}>
        <DropdownMenu
          label="Período"
          triggerLabel="Trocar o período"
          sections={[{ id: "period", label: "Período", items: financePeriods.map((entry) => ({ id: entry.value, label: entry.label, selected: overview.period === entry.value, onSelect: () => changePeriod(entry.value) })) }]}
          triggerContent={
            <span className={styles.periodTrigger}>
              <CalendarBlankIcon weight="bold" aria-hidden="true" />
              {periodLabel}
              <CaretDownIcon weight="bold" aria-hidden="true" className={styles.periodCaret} />
            </span>
          }
        />
        <span className={styles.spacer} />
        <span className={styles.wide}>
          <Button size="sm" radius="md" iconStart={<PlusIcon />} onClick={() => setAdding(true)}>
            Nova movimentação
          </Button>
        </span>
        <span className={styles.narrow}>
          <IconButton label="Nova movimentação" size="sm" radius="md" onClick={() => setAdding(true)}>
            <PlusIcon />
          </IconButton>
        </span>
      </div>

      <div className={styles.top}>
        <CashCard balance={overview.balance} caption={`${net >= 0 ? "+" : "-"}${formatMoney(Math.abs(net))} no período`} />
        <div className={styles.tiles}>
          <Tile icon={<ArrowDownLeftIcon weight="bold" />} hue="var(--sys-green)" label={`Recebido, ${periodLabel.toLowerCase()}`} value={overview.received} foot={`${overview.receivedCount} ${overview.receivedCount === 1 ? "entrada" : "entradas"}`} />
          <Tile icon={<ArrowUpRightIcon weight="bold" />} hue="var(--sys-red)" label={`Saídas, ${periodLabel.toLowerCase()}`} value={overview.expenses} foot={`${overview.expensesCount} ${overview.expensesCount === 1 ? "saída" : "saídas"}`} />
          {/* A receber e a pagar lado a lado, e nunca somados (2026-09-20, com a despesa): um saldo único
              diria que a equipe tem mais dinheiro a caminho do que tem, que é o engano que a despesa
              existe para não deixar acontecer. O atraso de cada lado vai no pé do azulejo dele. */}
          <Tile
            icon={<CalendarCheckIcon weight="bold" />}
            hue="var(--sys-blue)"
            label="A receber"
            value={overview.receivable}
            foot={overview.overdueCount > 0 ? `${formatMoney(overview.overdue)} em atraso` : `${overview.receivableCount} ${overview.receivableCount === 1 ? "parcela em aberto" : "parcelas em aberto"}`}
          />
          <Tile
            icon={<WarningCircleIcon weight="bold" />}
            hue={overview.payable > 0 ? "var(--sys-red)" : "var(--sys-gray)"}
            label="A pagar"
            value={overview.payable}
            foot={overview.payableOverdueCount > 0 ? `${formatMoney(overview.payableOverdue)} em atraso` : overview.payableCount === 0 ? "Nada a pagar" : `${overview.payableCount} ${overview.payableCount === 1 ? "parcela em aberto" : "parcelas em aberto"}`}
          />
        </div>
      </div>

      <div className={styles.middle}>
        <Card
          title="Entradas e saídas"
          icon={<ChartBarIcon />}
          action={
            <Text as="span" variant="caption1" tone="secondary">
              Últimos 6 meses
            </Text>
          }
          className={styles.chartCard}
        >
          <div className={styles.chart}>
            <CashflowChart months={overview.months} />
          </div>
          <ul className={styles.legend} aria-label="Entradas e saídas por mês">
            {overview.months.map((month) => (
              <li key={month.month} className={styles.legendItem}>
                <Text as="span" variant="caption1" tone="secondary">
                  {month.label}
                </Text>
                <Text as="span" variant="caption1" weight="semibold" numeric>
                  {formatMoney(month.income - month.expense)}
                </Text>
              </li>
            ))}
          </ul>
        </Card>

        <div className={styles.side}>
          <Card
            title="Próximos vencimentos"
            icon={<CalendarCheckIcon />}
            action={
              <Button variant="outline" size="sm" radius="md" href="/cobrancas">
                Cobranças
              </Button>
            }
          >
            <DueList items={overview.upcoming} empty="Nada vence nos próximos 30 dias." onOpen={openCharge} />
          </Card>
          <Card title="Em atraso" icon={<WarningCircleIcon />}>
            <DueList items={overview.late} empty="Nenhuma parcela vencida. Ótimo sinal." onOpen={openCharge} />
          </Card>
        </div>
      </div>

      <Card
        title="Movimentações"
        icon={<ReceiptIcon />}
        action={
          <div className={styles.segment} aria-label="Que movimentações ver" {...kindTabs.listProps}>
            {kindFilters.map((option) => (
              <button key={option.value} type="button" className={styles.segmentItem} {...kindTabs.tabProps(option.value)} onClick={() => setKind(option.value)}>
                {option.label}
              </button>
            ))}
          </div>
        }
      >
        {shown.length === 0 ? (
          <Text variant="footnote" tone="secondary" className={styles.empty}>
            Nenhuma movimentação desse tipo no período.
          </Text>
        ) : (
          <ul className={styles.list}>
            {shown.slice(0, SHOWN).map((transaction) => (
              <TransactionRow key={transaction.id} transaction={transaction} />
            ))}
          </ul>
        )}
        {shown.length > SHOWN && (
          <Text variant="caption1" tone="tertiary" className={styles.more}>
            Mostrando {SHOWN} de {shown.length}. Encurte o período para ver as outras.
          </Text>
        )}
      </Card>

      {addReady && (
        <TransactionFormDialog
          open={adding}
          onClose={() => setAdding(false)}
          onCreated={() => {
            setAdding(false);
          }}
        />
      )}
    </div>
  );
}

/* Um número do período: o glifo no matiz, o rótulo, o valor e a linha de apoio. */
function Tile({ icon, hue, label, value, foot }: { icon: ReactNode; hue: string; label: string; value: number; foot: string }) {
  return (
    <div className={styles.tile} style={{ "--tile-hue": hue } as CSSProperties} {...rounded("lg")}>
      <span className={styles.tileGlyph} aria-hidden="true" {...rounded("sm")}>
        {icon}
      </span>
      <Text as="span" variant="caption1" tone="secondary" className={styles.tileLabel}>
        {label}
      </Text>
      <Text as="span" variant="title3" weight="semibold" numeric truncate>
        {formatMoney(value)}
      </Text>
      <Text as="span" variant="caption1" tone="tertiary" truncate>
        {foot}
      </Text>
    </div>
  );
}

/* As parcelas por vencer ou vencidas: quem paga ou recebe, de que lado ela está, qual parcela de qual
   cobrança, o valor com sinal e o vencimento em palavras. A linha inteira abre a cobrança.

   As duas listas misturam o que a equipe tem a receber e o que ela tem a pagar de propósito, e por isso cada
   linha precisa dizer o lado (2026-09-22, na varredura): sem o sinal e sem o rótulo, uma cobrança de cinco
   mil e uma despesa de cinco mil no mesmo dia saíam idênticas, e quem lia contava dez mil a caminho do caixa
   quando o efeito era zero. O sinal e o nome saem de `chargeDirections`, o mesmo mapa do cartão e da tabela. */
function DueList({ items, empty, onOpen }: { items: UpcomingInstallment[]; empty: string; onOpen: (entry: UpcomingInstallment) => void }) {
  if (items.length === 0) {
    return (
      <Text variant="footnote" tone="secondary">
        {empty}
      </Text>
    );
  }
  return (
    <ul className={styles.dueList}>
      {items.slice(0, 5).map((entry) => {
        const side = chargeDirections[entry.direction];
        return (
          <li key={entry.installmentId}>
            <button type="button" className={styles.dueRow} onClick={() => onOpen(entry)}>
              <Avatar name={entry.clientName ?? entry.title} src={entry.clientAvatarUrl ?? undefined} size="sm" shape="rounded" />
              <span className={styles.dueCopy}>
                <Text as="span" variant="footnote" weight="medium" truncate>
                  {entry.clientName ?? `${side.label} avulsa`}
                </Text>
                <Text as="span" variant="caption1" tone="secondary" truncate>
                  {side.listLabel} · {installmentLabel(entry.number, entry.total)} de {entry.title}
                </Text>
              </span>
              <span className={styles.dueEnd}>
                <Text as="span" variant="footnote" weight="semibold" numeric>
                  {side.sign}
                  {formatMoney(entry.amount)}
                </Text>
                <Badge tone={entry.reported ? "info" : dueTone(entry.dueDate)} size="sm">
                  {entry.reported ? "Pagamento avisado" : dueLabel(entry.dueDate)}
                </Badge>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/* A linha da movimentação abre o recibo, como no painel. */
function TransactionRow({ transaction }: { transaction: Transaction }) {
  const kind = transactionKinds[transaction.kind];
  return (
    <DetailsTrigger dialog={<TransactionReceipt transaction={transaction} />} dialogLabel={`Recibo de ${transaction.title}`} label={`Ver detalhes de ${transaction.title}`} className={styles.row}>
      <TransactionParty transaction={transaction} />
      <span className={styles.rowCopy}>
        <Text as="span" variant="subheadline" weight="medium" truncate>
          {transaction.title}
        </Text>
        <Text as="span" variant="footnote" tone="secondary" truncate>
          {transaction.description}
        </Text>
      </span>
      <span className={styles.rowEnd}>
        <Text as="span" variant="subheadline" weight="semibold" numeric>
          {kind.sign}
          {formatMoney(transaction.amount)}
        </Text>
        <Text as="span" variant="caption1" tone="secondary" numeric>
          {dayLabel(transaction)}
        </Text>
      </span>
    </DetailsTrigger>
  );
}
