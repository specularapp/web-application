"use client";

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
import { recordFactGlyphs, recordKinds, type AppRecord } from "../records";
import { RecordMediaView } from "./record-media";

export type RecordHoverCardProps = {
  record: AppRecord;
  /** O gatilho: o que a pessoa aponta para o resumo aparecer. */
  children: ReactNode;
  /** Só num gatilho que é linha, para o invólucro não empurrar o vizinho. */
  inline?: boolean;
};

/**
 * O resumo de um registro da aplicação, para quem aponta uma marcação dele numa conversa (2026-09-10, a
 * pedido de "no hover aparecer meio que resumo"): a mídia, o nome com o identificador e o tipo, as etiquetas
 * de situação, os fatos em linha com glifo e a nota em duas linhas.
 *
 * Na `HoverCard` da casa, com as mesmas peças da ficha resumida do catálogo e da base de clientes: o que
 * muda é de onde o conteúdo vem, e aqui ele vem do índice de registros, que cada domínio preenche com o que
 * tem. O glifo de cada fato cruza do servidor como **chave**, e é aqui que ele vira componente.
 */
export function RecordHoverCard({ record, children, inline = true }: RecordHoverCardProps) {
  const kind = recordKinds[record.kind];

  return (
    <HoverCard
      inline={inline}
      content={
        <>
          <HoverCardHead>
            <RecordMediaView kind={record.kind} media={record.media} name={record.name} size="lg" single />
            <HoverCardNaming>
              <Text as="span" variant="headline" weight="semibold" truncate>
                {record.name}
              </Text>
              <Text as="span" variant="caption1" tone="secondary" truncate>
                {record.reference ? `${record.reference}, ${kind.label}` : kind.label}
              </Text>
            </HoverCardNaming>
          </HoverCardHead>

          {record.tags && record.tags.length > 0 && (
            <HoverCardTags>
              {record.tags.map((tag) => (
                <Badge key={tag.text} tone={tag.tone} size="sm">
                  {tag.text}
                </Badge>
              ))}
            </HoverCardTags>
          )}

          {record.facts && record.facts.length > 0 && (
            <HoverCardFacts>
              {record.facts.map((fact) => (
                <HoverCardFact key={`${fact.glyph}-${fact.text}`} icon={recordFactGlyphs[fact.glyph]}>
                  {fact.text}
                </HoverCardFact>
              ))}
            </HoverCardFacts>
          )}

          {record.note && (
            <>
              <HoverCardRule aria-hidden="true" />
              <HoverCardClamp variant="footnote" tone="secondary">
                {record.note}
              </HoverCardClamp>
            </>
          )}
        </>
      }
    >
      {children}
    </HoverCard>
  );
}
