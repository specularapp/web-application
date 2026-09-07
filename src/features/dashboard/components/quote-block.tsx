import type { Icon } from "@phosphor-icons/react";
import {
  CalendarBlankIcon,
  CalendarCheckIcon,
  CreditCardIcon,
  CurrencyCircleDollarIcon,
  PencilSimpleIcon,
  ReceiptIcon,
} from "@phosphor-icons/react/ssr";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import type { Route } from "next";
import type { ReactNode } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TextLink } from "@/components/ui/link";
import { Text } from "@/components/ui/text";
import { quoteStatuses } from "@/features/quotes/labels";
import type { LatestQuote, QuotePerson, QuotesSummary } from "@/features/quotes/summary";
import { iconButtonCornerRadius, squirclePx } from "@/lib/corners";
import { formatMoney } from "@/lib/utils/format";
import styles from "./quote-block.module.css";

export type QuoteBlockProps = { summary: QuotesSummary };


const chipCorner = squirclePx(iconButtonCornerRadius.sm, { clip: true });

const dayLabel = (date: string) => format(parseISO(date), "d MMM. yyyy", { locale: ptBR });

/** "3x de R$ 6.133,33", ou "À vista" quando é parcela única. */
function paymentOf(quote: LatestQuote) {
  if (quote.installments <= 1) return "À vista";
  return `${quote.installments}x de ${formatMoney(Math.round(quote.amount / quote.installments))}`;
}

// Um campo da ficha: o rótulo pequeno em cima e o valor embaixo, na estrutura da referência.
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.field}>
      <Text as="dt" variant="caption1" tone="secondary" className={styles.label}>
        {label}
      </Text>
      <dd className={styles.value}>{children}</dd>
    </div>
  );
}

// Uma pessoa em linha: a bolinha e o nome.
function Person({ person }: { person: QuotePerson }) {
  return (
    <span className={styles.inline}>
      <Avatar name={person.name} src={person.avatarUrl ?? undefined} size="sm" />
      <Text as="span" variant="subheadline" weight="medium" truncate>
        {person.name}
      </Text>
    </span>
  );
}

// Um ícone no chip da casa, do tamanho da bolinha, antes de um valor.
function Glyph({ icon: Shape }: { icon: Icon }) {
  return (
    <span className={styles.glyph} aria-hidden="true" {...chipCorner}>
      <Shape weight="bold" />
    </span>
  );
}

// O último orçamento que a pessoa criou, em ficha na pegada da referência: o título com a situação ao
// lado, cliente e responsável, valor e pagamento, as duas datas e a descrição, sempre em pares para
// aproveitar a largura. O título leva ao orçamento. Sem orçamento nenhum, o convite de criar o primeiro.
export function QuoteBlock({ summary }: QuoteBlockProps) {
  const quote = summary.latest;

  if (!quote) {
    return (
      <div className={styles.empty}>
        <Text variant="footnote" tone="secondary">
          Você ainda não criou nenhum orçamento
        </Text>
        <Button href="/orcamentos/novo" variant="outline" size="sm" radius="md">
          Criar orçamento
        </Button>
      </div>
    );
  }

  const status = quoteStatuses[quote.status];

  return (
    <dl className={styles.sheet}>
      <Field label={quote.number}>
        <span className={styles.heading}>
          <Glyph icon={ReceiptIcon} />
          <Text as="span" variant="headline" truncate className={styles.title}>
            <TextLink href={`/orcamentos/${quote.id}` as Route} tone="inherit">
              {quote.title}
            </TextLink>
          </Text>
          <Badge tone={status.tone} size="sm" icon={<status.icon />} className={styles.status}>
            {status.label}
          </Badge>
        </span>
      </Field>

      <div className={styles.pair}>
        <Field label="Cliente">
          <Person person={quote.client} />
        </Field>
        <Field label="Responsável">
          <Person person={quote.owner} />
        </Field>
      </div>

      <div className={styles.pair}>
        <Field label="Valor">
          <span className={styles.inline}>
            <Glyph icon={CurrencyCircleDollarIcon} />
            <span className={styles.stack}>
              <Text as="span" variant="title3" weight="semibold" truncate>
                {formatMoney(quote.amount)}
              </Text>
              <Text as="span" variant="caption1" tone="secondary">
                {quote.items} {quote.items === 1 ? "item" : "itens"}
              </Text>
            </span>
          </span>
        </Field>
        <Field label="Pagamento">
          <span className={styles.inline}>
            <Glyph icon={CreditCardIcon} />
            <Text as="span" variant="subheadline" weight="medium" truncate>
              {paymentOf(quote)}
            </Text>
          </span>
        </Field>
      </div>

      <div className={styles.pair}>
        <Field label="Enviado em">
          <span className={styles.inline}>
            <Glyph icon={CalendarBlankIcon} />
            <Text as="span" variant="subheadline" weight="medium" truncate>
              {quote.sentAt ? dayLabel(quote.sentAt) : "Ainda não enviado"}
            </Text>
          </span>
        </Field>
        <Field label="Válido até">
          <span className={styles.inline}>
            <Glyph icon={CalendarCheckIcon} />
            <Text as="span" variant="subheadline" weight="medium" truncate>
              {quote.validUntil ? dayLabel(quote.validUntil) : "Sem prazo"}
            </Text>
          </span>
        </Field>
      </div>

      <Field label="Descrição">
        <span className={styles.inline}>
          <Glyph icon={PencilSimpleIcon} />
          <Text as="span" variant="subheadline" tone="secondary" className={styles.description}>
            {quote.description}
          </Text>
        </span>
      </Field>
    </dl>
  );
}
