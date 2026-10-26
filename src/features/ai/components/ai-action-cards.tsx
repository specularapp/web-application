"use client";

import { ArrowRightIcon, XIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { rounded } from "@/lib/corners";
import type { AiAction, AiActionState } from "../conversation";
import styles from "./ai-action-cards.module.css";

const stateBadges: Record<AiActionState, { label: string; tone: "success" | "warning" | "danger" | "neutral" }> = {
  pending: { label: "Para conferir", tone: "warning" },
  done: { label: "Feito", tone: "success" },
  failed: { label: "Não deu certo", tone: "danger" },
  canceled: { label: "Dispensada", tone: "neutral" },
};

/* Passando disto, os dados de uma ação ficam a um toque, para o cartão não virar formulário. */
const VISIBLE_FIELDS = 4;

/**
 * O que a resposta propõe fazer na conta, um cartão por ação: o que muda, o que já aconteceu e o caminho para a
 * tela onde se confere. O SpeculAI ainda não age sozinho: a ação proposta se faz na tela, e dispensar só tira
 * o cartão da frente nesta conversa.
 */
export function AiActionCards({ items }: { items: readonly AiAction[] }) {
  const [dismissed, setDismissed] = useState<readonly string[]>([]);

  return (
    <ul className={styles.cards}>
      {items.map((item) => {
        const state: AiActionState = dismissed.includes(item.id) ? "canceled" : item.state;
        const badge = stateBadges[state];

        return (
          <li key={item.id} className={styles.card} {...rounded("lg")}>
            <div className={styles.head}>
              <Text as="h3" variant="subheadline" weight="semibold" className={styles.title}>
                {item.title}
              </Text>
              <Badge tone={badge.tone} size="sm">
                {badge.label}
              </Badge>
            </div>

            {item.summary && (
              <Text as="p" variant="footnote" tone="secondary">
                {item.summary}
              </Text>
            )}

            {item.fields.length > 0 && <Fields entries={item.fields.slice(0, VISIBLE_FIELDS)} />}

            {item.fields.length > VISIBLE_FIELDS && (
              <details className={styles.more}>
                <summary>Mais {item.fields.length - VISIBLE_FIELDS} dados</summary>
                <Fields entries={item.fields.slice(VISIBLE_FIELDS)} />
              </details>
            )}

            {state !== "canceled" && (
              <div className={styles.row}>
                <Button variant="outline" size="sm" radius="md" href={item.screen.href} iconEnd={<ArrowRightIcon />}>
                  {state === "done" ? "Abrir" : "Conferir"} em {item.screen.label}
                </Button>
                {state === "pending" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    radius="md"
                    iconStart={<XIcon />}
                    onClick={() => setDismissed((current) => [...current, item.id])}
                  >
                    Dispensar
                  </Button>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function Fields({ entries }: { entries: AiAction["fields"] }) {
  return (
    <dl className={styles.fields}>
      {entries.map((field) => (
        <div key={`${field.label}-${field.value}`}>
          <dt>{field.label}</dt>
          <dd>{field.value}</dd>
        </div>
      ))}
    </dl>
  );
}
