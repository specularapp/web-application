"use client";

import { CalendarBlankIcon, CoinsIcon, EnvelopeSimpleIcon, MapPinIcon, PhoneIcon, ReceiptIcon, StarIcon } from "@phosphor-icons/react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import type { ReactNode } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { HoverCard, HoverCardFact, HoverCardFacts, HoverCardHead, HoverCardNaming, HoverCardTags } from "@/components/ui/hover-card";
import { Text } from "@/components/ui/text";
import { applyPattern } from "@/lib/masks";
import { formatMoney } from "@/lib/utils/format";
import type { ClientListItem } from "../list-options";

export type ClientHoverCardProps = {
  client: ClientListItem;
  /** O gatilho: o que a pessoa aponta para a ficha resumida aparecer. */
  children: ReactNode;
};

const shortDate = (iso: string) => format(parseISO(iso), "d MMM. yyyy", { locale: ptBR });

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

// A ficha resumida do cliente, para quem aponta o nome na tabela (pedido de 2026-09-08, igual à do
// catálogo), na `HoverCard` da casa: a foto, o nome com a empresa ou a referência, as etiquetas de situação
// e de favorito, e os fatos em rótulo com ícone: e-mail, telefone com máscara, cidade, orçamentos e
// projetos, faturado e desde quando. O que falta não entra, em vez de virar linha vazia.
export function ClientHoverCard({ client, children }: ClientHoverCardProps) {
  return (
    <HoverCard
      height={280}
      content={
        <>
          <HoverCardHead>
            <Avatar name={client.name} src={client.avatarUrl ?? undefined} shape="squircle" />
            <HoverCardNaming>
              <Text as="span" variant="headline" weight="semibold" truncate>
                {client.name}
              </Text>
              <Text as="span" variant="caption1" tone="secondary" truncate>
                {client.company ? `${client.reference}, ${client.company}` : client.reference}
              </Text>
            </HoverCardNaming>
          </HoverCardHead>

          <HoverCardTags>
            <Badge tone={client.active ? "success" : "neutral"} size="sm">
              {client.active ? "Ativo" : "Inativo"}
            </Badge>
            {client.favorite && (
              <Badge tone="yellow" size="sm" icon={<StarIcon weight="fill" />}>
                Favorito
              </Badge>
            )}
          </HoverCardTags>

          <HoverCardFacts>
            {client.email && <HoverCardFact icon={EnvelopeSimpleIcon}>{client.email}</HoverCardFact>}
            {client.phone && <HoverCardFact icon={PhoneIcon}>{applyPattern("phone", client.phone)}</HoverCardFact>}
            {client.city && <HoverCardFact icon={MapPinIcon}>{client.city}</HoverCardFact>}
            <HoverCardFact icon={ReceiptIcon}>
              {plural(client.stats.quotes, "orçamento", "orçamentos")}, {plural(client.stats.projects, "projeto", "projetos")}
            </HoverCardFact>
            <HoverCardFact icon={CoinsIcon}>{client.stats.billed > 0 ? `${formatMoney(client.stats.billed)} faturados` : "Nada faturado ainda"}</HoverCardFact>
            <HoverCardFact icon={CalendarBlankIcon}>Cliente desde {shortDate(client.createdAt)}</HoverCardFact>
          </HoverCardFacts>
        </>
      }
    >
      {children}
    </HoverCard>
  );
}
