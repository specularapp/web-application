"use client";

import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import type { CSSProperties, KeyboardEvent, MouseEvent } from "react";
import { Avatar, avatarHue } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Text } from "@/components/ui/text";
import { VisuallyHidden } from "@/components/ui/visually-hidden";
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

// O cartão do orçamento (2026-09-10, a pedido). Ele nasceu na receita do cartão do catálogo e ficou igual
// demais a ele (relato do mesmo dia), então foi redesenhado para dizer o que um orçamento é: **um documento
// que foi para alguém, vale um valor e tem prazo**, e não uma ficha estável como o item do catálogo.
//
// A diferença está no eixo do cartão. No catálogo o que manda é a arte do item, e o preço é uma etiqueta na
// ponta; aqui o que manda é **o valor**, escrito grande no corpo, porque é por ele que se lê uma lista de
// orçamentos. Em cima fica o número, que é como o documento se chama, com a situação ao lado; no meio o
// título com o valor; depois **as duas pessoas**, para quem foi e quem responde, lado a lado, o que o
// catálogo não tem; e no pé os itens nomeados, e não contados, com o prazo na outra ponta, que é a conta que
// importa numa lista de coisas em aberto.
export function QuoteCard({ quote, onOpen }: QuoteCardProps) {
  const status = quoteStatuses[quote.status];
  const totals = quoteTotals(quote);
  const hue = avatarHue(quote.client.name);
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
        {/* Em cima a situação e o leque, e nada mais: numa coluna de 16rem, que é a medida da grade, o código
            do documento com uma etiqueta de "Visualizado" e o leque não cabem na mesma linha (medido em
            2026-09-10), e o que sobrava era a etiqueta esmagando a data. Então a etiqueta manda no topo, onde
            pode ceder pelo texto, e o código desce para a linha de contexto do corpo. */}
        <div className={styles.head}>
          <Badge tone={status.tone} size="sm" icon={<status.icon />}>
            {status.label}
          </Badge>
          <span className={styles.menu}>
            <QuoteMenu quote={quote} onEdit={onOpen} />
          </span>
        </div>

        {/* O miolo: o código com a emissão, o título e o valor. O código em algarismo tabular alinha de
            cartão a cartão numa coluna da grade, e a emissão logo atrás dele é o "quando" do documento. O
            valor é a peça grande, no matiz do cliente, com a forma de pagamento embaixo, miúda: a leitura é
            "quanto" e só depois "como". */}
        <div className={styles.body}>
          <Text as="span" variant="caption1" tone="secondary" truncate className={styles.reference}>
            <span className={styles.number}>{quote.number}</span>, {shortDate(quote.issuedAt)}
          </Text>
          <Text as="h2" variant="headline" weight="semibold" className={styles.title}>
            {quote.title}
          </Text>
          <p className={styles.amount} style={{ "--quote-hue": `var(--sys-${hue})` } as CSSProperties}>
            <Text as="span" variant="title3" weight="semibold" className={styles.total}>
              {formatMoney(totals.total)}
            </Text>
            <Text as="span" variant="caption1" tone="secondary" truncate title={methods}>
              {payment}
            </Text>
          </p>
        </div>

        {/* As duas pessoas do documento, que é o que um orçamento tem e um item de catálogo não: para quem
            foi, com a empresa, e quem da equipe responde, só o rosto, com o nome na dica e na voz. */}
        <div className={styles.people}>
          <span className={styles.client}>
            <Avatar name={quote.client.name} src={quote.client.avatarUrl ?? undefined} size="sm" shape="squircle" />
            <span className={styles.clientCopy}>
              <Text as="span" variant="footnote" weight="medium" truncate>
                {quote.client.company ?? quote.client.name}
              </Text>
              {quote.client.company && (
                <Text as="span" variant="caption2" tone="secondary" truncate>
                  {quote.client.name}
                </Text>
              )}
            </span>
          </span>
          <span className={styles.owner} title={`Responsável: ${quote.owner.name}`}>
            <Avatar name={quote.owner.name} src={quote.owner.avatarUrl ?? undefined} size="xs" />
            <VisuallyHidden>Responsável: {quote.owner.name}</VisuallyHidden>
          </span>
        </div>

        {/* O pé é a linha do tempo do documento: o que ele lista de um lado, quanto ainda vale do outro. */}
        <div className={styles.foot}>
          <Text as="p" variant="caption1" tone="secondary" truncate className={styles.lines}>
            {lineNames}
            {extraLines > 0 ? ` +${extraLines}` : ""}
          </Text>
          {validity && (
            <Badge size="sm" tone={validity.urgent ? "danger" : undefined}>
              {validity.label}
            </Badge>
          )}
        </div>
      </div>
    </li>
  );
}
