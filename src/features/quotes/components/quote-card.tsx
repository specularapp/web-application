"use client";

import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import type { KeyboardEvent, MouseEvent } from "react";
import { Avatar, avatarHue } from "@/components/ui/avatar";
import { Badge, type BadgeHue } from "@/components/ui/badge";
import { Text } from "@/components/ui/text";
import { squircle, squircleAuto } from "@/lib/corners";
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

const shortDate = (iso: string) => format(parseISO(iso), "d MMM. yyyy", { locale: ptBR });

/* Controles com ação própria dentro do cartão: clique que nasce neles não abre o editor. */
const INTERACTIVE = "button, a, input, label, [role='button'], [role='menuitem']";

// O cartão do orçamento (2026-09-10, a pedido), na receita do cartão do catálogo e do cliente: a foto do
// cliente à esquerda e, na outra ponta, a situação, o total numa etiqueta no matiz do cliente e o leque de
// opções; depois a linha de contexto com o número e a emissão, o título e para quem é; e no pé três
// etiquetas, quantos itens, como paga e até quando vale, três e só três, como nos outros cartões. O cartão
// inteiro abre o editor; abrir o leque não abre nada, porque tem ação própria. O fio da caixa é o do `Card`,
// em duas camadas recortadas pelo sistema de cantos, para o canto sair em superelipse também onde não há
// `corner-shape`.
export function QuoteCard({ quote, onOpen }: QuoteCardProps) {
  const status = quoteStatuses[quote.status];
  const totals = quoteTotals(quote);
  const hue = avatarHue(quote.client.name) as BadgeHue;
  const methods = quote.paymentMethods.map((method) => paymentMethods[method].label).join(", ");
  const payment = quote.installments > 1 ? `${quote.installments}x de ${formatMoney(totals.installment)}` : "À vista";
  const items = quote.lines.length === 1 ? "1 item" : `${quote.lines.length} itens`;
  /* A validade avisa pela cor: vencido em vermelho, o resto neutro, e sem prazo é só o dizer. */
  const validity = quote.validUntil ? `Até ${shortDate(quote.validUntil)}` : "Sem prazo";

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
    <li className={styles.card} data-status={quote.status} {...squircle("xl", { clip: true })}>
      <div
        role="button"
        tabIndex={0}
        aria-haspopup="dialog"
        aria-label={`Abrir ${quote.number}, ${quote.title}`}
        className={styles.inner}
        onClick={onClick}
        onKeyDown={onKeyDown}
        {...squircleAuto({ clip: true })}
      >
        <div className={styles.head}>
          <Avatar name={quote.client.name} src={quote.client.avatarUrl ?? undefined} size="md" shape="squircle" />
          <span className={styles.end}>
            <Badge tone={status.tone} size="sm" icon={<status.icon />}>
              {status.label}
            </Badge>
            <Badge tone={hue} size="sm" title={`${formatMoney(totals.total)}, ${payment.toLowerCase()}, ${methods}`}>
              {formatMoney(totals.total)}
            </Badge>
            <QuoteMenu quote={quote} onEdit={onOpen} />
          </span>
        </div>

        <div className={styles.body}>
          <Text as="span" variant="footnote" tone="secondary" truncate>
            {quote.number}, emitido em {shortDate(quote.issuedAt)}
          </Text>
          <Text as="h2" variant="headline" weight="semibold" truncate>
            {quote.title}
          </Text>
          <Text as="p" variant="footnote" tone="secondary" truncate>
            {quote.client.company ? `${quote.client.company}, ${quote.client.name}` : quote.client.name}
          </Text>
        </div>

        {/* O que o total não diz sozinho: quantas linhas, como se paga e até quando vale. */}
        <ul className={styles.tags} aria-label="Detalhes do orçamento">
          <li>
            <Badge size="sm">{items}</Badge>
          </li>
          <li>
            <Badge size="sm">{payment}</Badge>
          </li>
          <li>
            <Badge size="sm" tone={quote.status === "expired" ? "danger" : undefined}>
              {validity}
            </Badge>
          </li>
        </ul>
      </div>
    </li>
  );
}
