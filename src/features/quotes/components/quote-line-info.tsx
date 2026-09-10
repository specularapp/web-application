"use client";

import { CoinsIcon, InfoIcon, PackageIcon, PercentIcon, ShieldCheckIcon, TimerIcon, TrendUpIcon } from "@phosphor-icons/react";
import { HoverCard, HoverCardFact, HoverCardFacts, HoverCardNaming } from "@/components/ui/hover-card";
import { IconButton } from "@/components/ui/icon-button";
import { Text } from "@/components/ui/text";
import { readStock, UNLIMITED_STOCK } from "@/features/catalog/list-options";
import type { CatalogItem } from "@/features/catalog/summary";
import { formatMoney } from "@/lib/utils/format";

export type QuoteLineFactsProps = {
  item: CatalogItem;
  /** O que a linha está cobrando agora, em centavos: a margem sai daqui, e não do preço de tabela. */
  unitPrice: number;
  quantity: number;
};

export type QuoteLineInfoProps = QuoteLineFactsProps & {
  /** Classe do botão, para quem o monta poder encolhê-lo: o cabeçalho da linha usa a versão miúda. */
  className?: string;
  /** No celular a ficha abre numa bandeja de quem monta o formulário, e o botão só avisa (2026-09-10). */
  onOpen?: () => void;
};

const durationLabel = ({ min, max }: { min: number; max: number }) => (min === max ? `${min} dias` : `${min} a ${max} dias`);

const percent = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

/**
 * A ficha da linha, o que a pessoa precisa para negociar sem sair do editor: o custo que o catálogo registrou,
 * a margem do preço que está cobrando agora (e não do preço de tabela, porque o valor da linha é editável),
 * quanto de desconto ela pode dar sem pedir aprovação e o que ele vale em dinheiro no total da linha, a
 * garantia e o prazo ou o estoque. É peça própria porque mora em dois lugares: na ficha flutuante do desktop
 * e na bandeja do celular (2026-09-10).
 */
export function QuoteLineFacts({ item, unitPrice, quantity }: QuoteLineFactsProps) {
  const stock = readStock(item);
  const total = Math.round(unitPrice * quantity);
  const margin = item.cost === null ? null : percent(unitPrice - item.cost, unitPrice);
  const discountValue = Math.round((total * item.maxDiscount) / 100);

  return (
    <>
      <HoverCardNaming>
            <Text as="span" variant="subheadline" weight="semibold" truncate>
              {item.name}
            </Text>
            <Text as="span" variant="caption1" tone="secondary" truncate>
              {item.reference}, de tabela por {formatMoney(item.price)}
            </Text>
          </HoverCardNaming>

          <HoverCardFacts>
            <HoverCardFact icon={CoinsIcon}>{item.cost === null ? "Custo não medido" : `Custo de ${formatMoney(item.cost)}`}</HoverCardFact>
            <HoverCardFact icon={TrendUpIcon}>{margin === null ? "Margem sem custo para calcular" : `Margem de ${margin}% neste preço`}</HoverCardFact>
            <HoverCardFact icon={PercentIcon}>
              {item.maxDiscount > 0 ? `Desconto até ${item.maxDiscount}%, ${formatMoney(discountValue)} nesta linha` : "Sem desconto sem aprovação"}
            </HoverCardFact>
            <HoverCardFact icon={ShieldCheckIcon}>{item.supportDays === null ? "Sem garantia inclusa" : `Garantia de ${item.supportDays} dias`}</HoverCardFact>
            {item.kind === "service" ? (
              <HoverCardFact icon={TimerIcon}>{item.duration ? `Prazo de ${durationLabel(item.duration)}` : "Prazo indeterminado"}</HoverCardFact>
            ) : (
              <HoverCardFact icon={PackageIcon}>{stock ? (stock.quantity === null ? "Sob demanda" : `${stock.short} em estoque`) : UNLIMITED_STOCK}</HoverCardFact>
            )}
          </HoverCardFacts>
    </>
  );
}

// O botão de informação da linha (pedido de 2026-09-09): discreto, só o glifo fantasma ao lado do total. No
// desktop abre a ficha de vidro da casa no clique; no celular, com `onOpen`, ele só avisa quem monta o
// formulário, que abre a ficha numa bandeja de baixo, como tudo que se abre no celular (2026-09-10).
export function QuoteLineInfo({ item, unitPrice, quantity, className, onOpen }: QuoteLineInfoProps) {
  const button = (
    <IconButton label={`Margem e condições de ${item.name}`} variant="ghost" size="sm" radius="md" className={className} onClick={onOpen}>
      <InfoIcon />
    </IconButton>
  );

  if (onOpen) return button;

  return (
    <HoverCard width={264} height={240} openOnClick inline content={<QuoteLineFacts item={item} unitPrice={unitPrice} quantity={quantity} />}>
      {button}
    </HoverCard>
  );
}
