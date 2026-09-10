"use client";

import { CoinsIcon, InfoIcon, PackageIcon, PercentIcon, ShieldCheckIcon, TimerIcon, TrendUpIcon } from "@phosphor-icons/react";
import { HoverCard, HoverCardFact, HoverCardFacts, HoverCardNaming } from "@/components/ui/hover-card";
import { IconButton } from "@/components/ui/icon-button";
import { Text } from "@/components/ui/text";
import { readStock, UNLIMITED_STOCK } from "@/features/catalog/list-options";
import type { CatalogItem } from "@/features/catalog/summary";
import { formatMoney } from "@/lib/utils/format";

export type QuoteLineInfoProps = {
  item: CatalogItem;
  /** O que a linha está cobrando agora, em centavos: a margem sai daqui, e não do preço de tabela. */
  unitPrice: number;
  quantity: number;
  /** Classe do botão, para quem o monta poder encolhê-lo: o cabeçalho da linha usa a versão miúda. */
  className?: string;
};

const durationLabel = ({ min, max }: { min: number; max: number }) => (min === max ? `${min} dias` : `${min} a ${max} dias`);

const percent = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

// O botão de informação da linha (pedido de 2026-09-09): discreto, só o glifo fantasma ao lado do total, e
// abre a ficha de vidro da casa com o que a pessoa precisa para negociar sem sair do editor: o custo que o
// catálogo registrou, a margem do preço que está cobrando agora (e não do preço de tabela, porque o valor
// da linha é editável), quanto de desconto ela pode dar sem pedir aprovação e o que ele vale em dinheiro no
// total da linha, a garantia e o prazo ou o estoque. Abre no apontar e no clique, então serve ao dedo também.
export function QuoteLineInfo({ item, unitPrice, quantity, className }: QuoteLineInfoProps) {
  const stock = readStock(item);
  const total = Math.round(unitPrice * quantity);
  const margin = item.cost === null ? null : percent(unitPrice - item.cost, unitPrice);
  const discountValue = Math.round((total * item.maxDiscount) / 100);

  return (
    <HoverCard
      width={264}
      height={240}
      openOnClick
      inline
      content={
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
      }
    >
      <IconButton label={`Margem e condições de ${item.name}`} variant="ghost" size="sm" radius="md" className={className}>
        <InfoIcon />
      </IconButton>
    </HoverCard>
  );
}
