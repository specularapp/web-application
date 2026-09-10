"use client";

import { CalendarBlankIcon, CoinsIcon, ListBulletsIcon, ReceiptIcon, UserIcon } from "@phosphor-icons/react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import type { ReactNode } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { HoverCard, HoverCardFact, HoverCardFacts, HoverCardHead, HoverCardNaming, HoverCardRule, HoverCardTags } from "@/components/ui/hover-card";
import { Text } from "@/components/ui/text";
import { formatMoney } from "@/lib/utils/format";
import { paymentMethods, quoteStatuses } from "../labels";
import type { Quote } from "../summary";
import { quoteTotals } from "../totals";

export type QuoteHoverCardProps = {
  quote: Quote;
  children: ReactNode;
};

const shortDate = (iso: string) => format(parseISO(iso), "d MMM. yyyy", { locale: ptBR });

// A ficha resumida do orçamento, para quem aponta o título na tabela, na `HoverCard` da casa, como no
// catálogo e na base de clientes: o cliente com a foto, o número e a empresa, a situação, e os fatos de
// total com as parcelas, quantos itens, emissão e validade e quem responde; embaixo, os nomes dos itens.
export function QuoteHoverCard({ quote, children }: QuoteHoverCardProps) {
  const status = quoteStatuses[quote.status];
  const totals = quoteTotals(quote);
  const methods = quote.paymentMethods.map((method) => paymentMethods[method].label).join(", ");
  const payment = quote.installments > 1 ? `${quote.installments}x de ${formatMoney(totals.installment)}, ${methods}` : `À vista, ${methods}`;

  return (
    <HoverCard
      content={
        <>
          <HoverCardHead>
            <Avatar name={quote.client.name} src={quote.client.avatarUrl ?? undefined} shape="squircle" />
            <HoverCardNaming>
              <Text as="span" variant="headline" weight="semibold" truncate>
                {quote.title}
              </Text>
              <Text as="span" variant="caption1" tone="secondary" truncate>
                {quote.number}, {quote.client.company ?? quote.client.name}
              </Text>
            </HoverCardNaming>
          </HoverCardHead>

          <HoverCardTags>
            <Badge tone={status.tone} size="sm" icon={<status.icon />}>
              {status.label}
            </Badge>
          </HoverCardTags>

          <HoverCardFacts>
            <HoverCardFact icon={CoinsIcon}>
              {formatMoney(totals.total)}, {payment.charAt(0).toLowerCase() + payment.slice(1)}
            </HoverCardFact>
            <HoverCardFact icon={ListBulletsIcon}>{quote.lines.length === 1 ? "1 item" : `${quote.lines.length} itens`}</HoverCardFact>
            <HoverCardFact icon={CalendarBlankIcon}>
              Emitido em {shortDate(quote.issuedAt)}
              {quote.validUntil ? `, válido até ${shortDate(quote.validUntil)}` : ""}
            </HoverCardFact>
            <HoverCardFact icon={ReceiptIcon}>{quote.sentAt ? `Enviado em ${shortDate(quote.sentAt)}` : "Ainda não enviado"}</HoverCardFact>
            <HoverCardFact icon={UserIcon}>Por {quote.owner.name}</HoverCardFact>
          </HoverCardFacts>

          <HoverCardRule aria-hidden="true" />

          <Text variant="footnote" tone="secondary">
            {quote.lines.map((line) => line.name).join(", ")}
          </Text>
        </>
      }
    >
      {children}
    </HoverCard>
  );
}
