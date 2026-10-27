"use client";

import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import type { KeyboardEvent, MouseEvent } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Text } from "@/components/ui/text";
import { VisuallyHidden } from "@/components/ui/visually-hidden";
import { rounded, roundedAuto } from "@/lib/corners";
import { formatMoney } from "@/lib/utils/format";
import { paymentMethods, quoteStatuses } from "../labels";
import type { Quote } from "../summary";
import { quoteTotals } from "../totals";
import { QuoteMenu } from "./quote-menu";
import styles from "./quote-card.module.css";

export type QuoteCardProps = {
  quote: Quote;
  /** Abre o editor com o orçamento. */
  onOpen: () => void;
};

const shortDate = (iso: string) => format(parseISO(iso), "d MMM.", { locale: ptBR });

/* Quantos itens do orçamento o cartão nomeia antes de resumir o resto em "+N". */
const SHOWN_LINES = 2;

/* Controles com ação própria dentro do cartão: clique que nasce neles não abre o editor. */
const INTERACTIVE = "button, a, input, label, [role='button'], [role='menuitem']";

/**
 * Quanto tempo resta de validade, em palavras curtas, e se isso já é urgência: um orçamento é um documento
 * com prazo, e a conta que importa na lista é "ainda dá tempo?". Vencido e respondido não contam mais.
 */
function readValidity(quote: Quote) {
  if (quote.status === "approved" || quote.status === "declined") return null;
  if (quote.status === "expired") return { label: "Vencido", urgent: true };
  if (!quote.validUntil) return { label: "Sem prazo", urgent: false };

  const days = differenceInCalendarDays(parseISO(quote.validUntil), new Date());
  if (days < 0) return { label: "Vencido", urgent: true };
  if (days === 0) return { label: "Vence hoje", urgent: true };
  if (days === 1) return { label: "Vence amanhã", urgent: true };
  if (days <= 7) return { label: `Vence em ${days} dias`, urgent: true };
  return { label: `Vence ${shortDate(quote.validUntil)}`, urgent: false };
}

// O cartão do orçamento, que mora no funil (2026-10-26, a pedido: "otimize o card, não precisa ficar
// minúsculo, mas adapte melhor as informações"). A coluna já diz a situação, então o cartão não repete a
// etiqueta e sobe o que identifica o documento: o código com a emissão e o leque em cima, o título em duas
// linhas, para quem foi, os itens pelo nome, e no pé, depois do fio, **o valor** com a forma de pagamento, o
// prazo em palavras de urgência e o rosto de quem responde. O valor segue preto neutro (pedido de 2026-09-10):
// o que se compara numa coluna é o número, e a cor do cliente fica no rosto dele.
export function QuoteCard({ quote, onOpen }: QuoteCardProps) {
  const status = quoteStatuses[quote.status];
  const totals = quoteTotals(quote);
  const methods = quote.paymentMethods.map((method) => paymentMethods[method].label).join(", ");
  const payment = quote.installments > 1 ? `${quote.installments}x de ${formatMoney(totals.installment)}` : "À vista";
  const validity = readValidity(quote);

  /* Os itens pelo nome: numa lista de orçamentos, "Landing page, Identidade visual" diz o que "2 itens"
     não diz, e é o que diferencia um orçamento do outro do mesmo cliente. O resto vira "+N". */
  const shown = quote.lines.slice(0, SHOWN_LINES);
  const extraLines = quote.lines.length - shown.length;
  const lineNames = shown.map((line) => line.name).join(", ");

  const onClick = (event: MouseEvent<HTMLElement>) => {
    const control = (event.target as HTMLElement).closest(INTERACTIVE);
    if (control && control !== event.currentTarget) return;
    onOpen();
  };

  // Só o teclado abre por tecla, e só quando o foco está no próprio cartão: dentro dele o Enter é do leque.
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onOpen();
    }
  };

  return (
    <li className={styles.card} data-status={quote.status} {...rounded("xl", { clip: true })}>
      <div
        role="button"
        tabIndex={0}
        aria-haspopup="dialog"
        aria-label={`Abrir ${quote.number}, ${quote.title}, ${status.label}`}
        className={styles.inner}
        onClick={onClick}
        onKeyDown={onKeyDown}
        {...roundedAuto({ clip: true })}
      >
        <div className={styles.head}>
          <Text as="span" variant="caption1" tone="secondary" truncate className={styles.reference}>
            <span className={styles.number}>{quote.number}</span>, {shortDate(quote.issuedAt)}
          </Text>
          <span className={styles.menu}>
            <QuoteMenu quote={quote} onEdit={onOpen} />
          </span>
        </div>

        <div className={styles.body}>
          <Text as="h3" variant="subheadline" weight="semibold" className={styles.title}>
            {quote.title}
          </Text>
          <span className={styles.client}>
            <Avatar name={quote.client.name} src={quote.client.avatarUrl ?? undefined} size="xs" />
            <Text as="span" variant="footnote" tone="secondary" truncate>
              {quote.client.company ? `${quote.client.company}, ${quote.client.name}` : quote.client.name}
            </Text>
          </span>
          {lineNames && (
            <Text as="p" variant="caption1" tone="tertiary" truncate className={styles.lines}>
              {lineNames}
              {extraLines > 0 ? ` +${extraLines}` : ""}
            </Text>
          )}
        </div>

        {/* O pé, depois do fio: quanto e como de um lado, o prazo e quem responde do outro. */}
        <div className={styles.foot}>
          <p className={styles.amount}>
            <Text as="span" variant="headline" weight="semibold" className={styles.total}>
              {formatMoney(totals.total)}
            </Text>
            <Text as="span" variant="caption1" tone="secondary" truncate title={methods}>
              {payment}
            </Text>
          </p>
          <span className={styles.signals}>
            {validity && (
              <Badge size="sm" tone={validity.urgent ? "danger" : undefined}>
                {validity.label}
              </Badge>
            )}
            <span className={styles.owner} title={`Responsável: ${quote.owner.name}`}>
              <Avatar name={quote.owner.name} src={quote.owner.avatarUrl ?? undefined} size="xs" />
              <VisuallyHidden>Responsável: {quote.owner.name}</VisuallyHidden>
            </span>
          </span>
        </div>
      </div>
    </li>
  );
}
