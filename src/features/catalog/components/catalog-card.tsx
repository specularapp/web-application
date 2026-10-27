"use client";

import type { KeyboardEvent, MouseEvent } from "react";
import { Avatar, AvatarGroup } from "@/components/ui/avatar";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Text } from "@/components/ui/text";
import { rounded, roundedAuto } from "@/lib/corners";
import { formatMoney } from "@/lib/utils/format";
import { kindLabels, kindTones, readStock, unitLabels } from "../list-options";
import type { CatalogItem } from "../summary";
import { CatalogArtwork } from "./catalog-artwork";
import { CatalogMenu } from "./catalog-menu";
import styles from "./catalog-card.module.css";

export type CatalogCardProps = {
  item: CatalogItem;
  /** Se o item está em linha: vive fora do cartão, para a ficha e o cartão dizerem a mesma coisa. */
  active: boolean;
  onActiveChange: (active: boolean) => void;
  onOpen: () => void;
  onEdit: () => void;
  /** Pede a exclusão; quem confirma é a prancha. */
  onDelete: () => void;
};

const durationLabel = ({ min, max }: { min: number; max: number }) => (min === max ? `${min} dias` : `${min} a ${max} dias`);

/* Quantos clientes aparecem na fila de orçamentos. */
const SHOWN_CLIENTS = 3;

/* Controles com ação própria dentro do cartão: clique que nasce neles não abre a ficha. */
const INTERACTIVE = "button, a, input, label, [role='button'], [role='menuitem']";

// O cartão do catálogo (2026-10-26, refeito a pedido: "otimize o card de cada item"), em três degraus como o
// cartão de orçamento: em cima a arte com o nome e a categoria e o leque na ponta; no meio a descrição em até
// duas linhas e os fatos em etiqueta (o tipo na cor dele, o estoque ou o prazo e quantos orçamentos, com as
// bolinhas de quem já recebeu); e no pé, depois do fio, o preço com a forma de cobrança e a situação. O
// preço saiu da etiqueta colorida do topo: é o número que se compara numa lista, então ele vai grande e
// preto. O cartão inteiro abre a ficha, como o de cliente; abrir o leque não abre nada, porque tem ação
// própria. O fio da caixa é o do `Card`, em duas camadas recortadas pelo sistema de cantos.
export function CatalogCard({ item, active, onActiveChange, onOpen, onEdit, onDelete }: CatalogCardProps) {
  const price = formatMoney(item.price);
  const stock = readStock(item);

  // Os fatos em etiqueta, em ordem de peso: o tipo na cor dele e o estoque (só a quantidade, "49 un.", com a
  // cor do estado, a pedido de 2026-09-08) ou o prazo. A categoria sobe para o lado do nome.
  const chips: { label: string; tone?: BadgeTone }[] = [
    { label: kindLabels[item.kind], tone: kindTones[item.kind] },
    stock
      ? { label: stock.quantity === null ? "Sob demanda" : `${stock.quantity} un.`, tone: stock.tone === "neutral" ? undefined : stock.tone }
      : { label: item.duration ? durationLabel(item.duration) : "Prazo indeterminado" },
  ];
  const clients = Array.from(new Set(item.quotes.map((quote) => quote.client))).slice(0, SHOWN_CLIENTS);
  const quotesLabel = item.stats.quotes === 0 ? "Sem orçamento" : item.stats.quotes === 1 ? "1 orçamento" : `${item.stats.quotes} orçamentos`;

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
    <li className={styles.card} data-inactive={!active || undefined} {...rounded("xl", { clip: true })}>
      <div
        role="button"
        tabIndex={0}
        aria-haspopup="dialog"
        aria-label={`Ver ${item.name}`}
        className={styles.inner}
        onClick={onClick}
        onKeyDown={onKeyDown}
        {...roundedAuto({ clip: true })}
      >
        <div className={styles.head}>
          <CatalogArtwork item={item} />
          <span className={styles.naming}>
            <Text as="h2" variant="subheadline" weight="semibold" truncate>
              {item.name}
            </Text>
            <Text as="span" variant="caption1" tone="secondary" truncate>
              {item.category}
            </Text>
          </span>
          <span className={styles.menu}>
            <CatalogMenu item={item} active={active} onActiveChange={onActiveChange} onView={onOpen} onEdit={onEdit} onDelete={onDelete} />
          </span>
        </div>

        <div className={styles.body}>
          <Text as="p" variant="footnote" tone="secondary" className={styles.description}>
            {item.description}
          </Text>
          {/* Os fatos dizem o que o preço não diz sozinho: se é coisa ou trabalho, quanto há ou quanto leva, e em
              quantos orçamentos já entrou, com as bolinhas de quem recebeu. */}
          <ul className={styles.tags} aria-label="Detalhes do item">
            {chips.map((chip) => (
              <li key={chip.label}>
                <Badge tone={chip.tone} size="sm">
                  {chip.label}
                </Badge>
              </li>
            ))}
            <li className={styles.quotes}>
              {clients.length > 0 && (
                <AvatarGroup aria-label={`Clientes: ${clients.join(", ")}`}>
                  {clients.map((client) => (
                    <Avatar key={client} name={client} size="xs" />
                  ))}
                </AvatarGroup>
              )}
              <Text as="span" variant="caption1" tone="tertiary" truncate>
                {quotesLabel}
              </Text>
            </li>
          </ul>
        </div>

        {/* O pé, depois do fio: o preço grande com a forma de cobrança embaixo, e a situação na ponta. */}
        <div className={styles.foot}>
          <p className={styles.price}>
            <Text as="span" variant="headline" weight="semibold">
              {price}
            </Text>
            <Text as="span" variant="caption1" tone="secondary" truncate>
              {unitLabels[item.unit]}
            </Text>
          </p>
          <Badge tone={active ? "success" : "neutral"} size="sm">
            {active ? "Ativo" : "Inativo"}
          </Badge>
        </div>
      </div>
    </li>
  );
}
