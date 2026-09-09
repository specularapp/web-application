"use client";

import { CalendarBlankIcon, PackageIcon, ReceiptIcon, TagIcon, TimerIcon, UserIcon } from "@phosphor-icons/react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import {
  HoverCard,
  HoverCardClamp,
  HoverCardFact,
  HoverCardFacts,
  HoverCardHead,
  HoverCardNaming,
  HoverCardRule,
  HoverCardTags,
} from "@/components/ui/hover-card";
import { Text } from "@/components/ui/text";
import { formatMoney } from "@/lib/utils/format";
import { kindLabels, kindTones, readStock, UNLIMITED_STOCK, unitLabels } from "../list-options";
import type { CatalogItem } from "../summary";
import { CatalogArtwork } from "./catalog-artwork";

export type CatalogHoverCardProps = {
  item: CatalogItem;
  active: boolean;
  /** O gatilho: o que a pessoa aponta para a ficha resumida aparecer. */
  children: ReactNode;
};

const shortDate = (iso: string) => format(parseISO(iso), "d MMM. yyyy", { locale: ptBR });
const durationLabel = ({ min, max }: { min: number; max: number }) => (min === max ? `${min} dias` : `${min} a ${max} dias`);

// A ficha resumida do item, para quem aponta o nome na tabela (pedido de 2026-09-08, sobre uma referência
// de cartão de empresa), na `HoverCard` da casa: a arte, o nome com a referência e a categoria, as etiquetas
// de tipo e situação, os fatos em rótulo com ícone (preço com a cobrança, estoque ou prazo, orçamentos e
// aprovados, desde quando e quem cadastrou) e a descrição em duas linhas.
export function CatalogHoverCard({ item, active, children }: CatalogHoverCardProps) {
  const stock = readStock(item);
  const quotes =
    item.stats.quotes === 0
      ? "Nenhum orçamento"
      : `${item.stats.quotes} ${item.stats.quotes === 1 ? "orçamento" : "orçamentos"}, ${item.stats.approved} ${item.stats.approved === 1 ? "aprovado" : "aprovados"}`;

  return (
    <HoverCard
      content={
        <>
          <HoverCardHead>
            <CatalogArtwork item={item} />
            <HoverCardNaming>
              <Text as="span" variant="headline" weight="semibold" truncate>
                {item.name}
              </Text>
              <Text as="span" variant="caption1" tone="secondary" truncate>
                {item.reference}, {item.category}
              </Text>
            </HoverCardNaming>
          </HoverCardHead>

          <HoverCardTags>
            <Badge tone={kindTones[item.kind]} size="sm">
              {kindLabels[item.kind]}
            </Badge>
            <Badge tone={active ? "success" : "neutral"} size="sm">
              {active ? "Ativo" : "Inativo"}
            </Badge>
          </HoverCardTags>

          <HoverCardFacts>
            <HoverCardFact icon={TagIcon}>
              {formatMoney(item.price)} {unitLabels[item.unit]}
            </HoverCardFact>
            {item.kind === "product" ? (
              <HoverCardFact icon={PackageIcon}>{stock ? (stock.quantity === null ? "Sob demanda" : `${stock.short} em estoque`) : UNLIMITED_STOCK}</HoverCardFact>
            ) : (
              <HoverCardFact icon={TimerIcon}>{item.duration ? `Prazo de ${durationLabel(item.duration)}` : "Prazo indeterminado"}</HoverCardFact>
            )}
            <HoverCardFact icon={ReceiptIcon}>{quotes}</HoverCardFact>
            <HoverCardFact icon={CalendarBlankIcon}>Desde {shortDate(item.createdAt)}</HoverCardFact>
            <HoverCardFact icon={UserIcon}>Por {item.createdBy}</HoverCardFact>
          </HoverCardFacts>

          <HoverCardRule aria-hidden="true" />

          <HoverCardClamp variant="footnote" tone="secondary">
            {item.description}
          </HoverCardClamp>
        </>
      }
    >
      {children}
    </HoverCard>
  );
}
