"use client";

import type { KeyboardEvent, MouseEvent } from "react";
import { Avatar, AvatarGroup } from "@/components/ui/avatar";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Text } from "@/components/ui/text";
import { squircle, squircleAuto } from "@/lib/corners";
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
};

const durationLabel = ({ min, max }: { min: number; max: number }) => (min === max ? `${min} dias` : `${min} a ${max} dias`);

/* Quantos clientes aparecem na fila de orçamentos. */
const SHOWN_CLIENTS = 3;

/* Controles com ação própria dentro do cartão: clique que nasce neles não abre a ficha. */
const INTERACTIVE = "button, a, input, label, [role='button'], [role='menuitem']";

// O cartão do catálogo, na receita da referência: a arte do item à esquerda e, na outra ponta, a situação,
// o preço numa etiqueta do matiz do item e o leque de opções; depois a linha de orçamentos, as bolinhas de
// quem já recebeu o item e o total (acima do nome, a pedido de 2026-09-08); o nome e a descrição em até duas
// linhas; e no pé três etiquetas, categoria, tipo e estoque ou prazo, sem contagem do resto. O cartão inteiro
// abre a ficha, como o de cliente; abrir o leque não abre nada, porque tem ação própria. O fio da caixa é o
// do `Card`, em duas camadas recortadas pelo sistema de cantos, para o canto sair em superelipse também onde
// não há `corner-shape`: a camada de dentro precisa do mesmo recorte, senão os dois raios não casam na quina.
export function CatalogCard({ item, active, onActiveChange, onOpen, onEdit }: CatalogCardProps) {
  const price = formatMoney(item.price);
  const stock = readStock(item);

  // As três etiquetas, em ordem de peso: a categoria, o tipo na cor dele e o estoque (só a quantidade, "49
  // un.", com a cor do estado, a pedido de 2026-09-08) ou o prazo. O que sobra fica para a ficha.
  const chips: { label: string; tone?: BadgeTone }[] = [
    { label: item.category },
    { label: kindLabels[item.kind], tone: kindTones[item.kind] },
    stock
      ? { label: stock.quantity === null ? "Sob demanda" : `${stock.quantity} un.`, tone: stock.tone === "neutral" ? undefined : stock.tone }
      : { label: item.duration ? durationLabel(item.duration) : "Prazo indeterminado" },
  ];
  const clients = Array.from(new Set(item.quotes.map((quote) => quote.client))).slice(0, SHOWN_CLIENTS);
  const quotesLabel = item.stats.quotes === 0 ? "Nenhum orçamento" : item.stats.quotes === 1 ? "1 orçamento" : `${item.stats.quotes} orçamentos`;

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
    <li className={styles.card} data-inactive={!active || undefined} {...squircle("xl", { clip: true })}>
      <div
        role="button"
        tabIndex={0}
        aria-haspopup="dialog"
        aria-label={`Ver ${item.name}`}
        className={styles.inner}
        onClick={onClick}
        onKeyDown={onKeyDown}
        {...squircleAuto({ clip: true })}
      >
        <div className={styles.head}>
          <CatalogArtwork item={item} />
          <span className={styles.end}>
            {/* A situação vem antes do valor (a pedido, 2026-09-08): é o primeiro fato do item, e o preço
                de um item fora de linha lê diferente. As duas etiquetas no mesmo tamanho, também a pedido. */}
            <Badge tone={active ? "success" : "neutral"} size="sm">
              {active ? "Ativo" : "Inativo"}
            </Badge>
            <Badge tone={item.hue} size="sm" title={`${price} ${unitLabels[item.unit]}`}>
              {price}
            </Badge>
            <CatalogMenu item={item} active={active} onActiveChange={onActiveChange} onView={onOpen} onEdit={onEdit} />
          </span>
        </div>

        <div className={styles.body}>
          {/* Quem já recebeu orçamento com o item, em bolinhas, e o total: fica acima do nome, como a linha
              de contexto do cartão. */}
          <span className={styles.quotes}>
            {clients.length > 0 && (
              <AvatarGroup aria-label={`Clientes: ${clients.join(", ")}`}>
                {clients.map((client) => (
                  <Avatar key={client} name={client} size="xs" />
                ))}
              </AvatarGroup>
            )}
            <Text as="span" variant="footnote" tone="secondary" truncate>
              {quotesLabel}
            </Text>
          </span>
          <Text as="h2" variant="headline" weight="semibold" truncate>
            {item.name}
          </Text>
          <Text as="p" variant="footnote" tone="secondary" className={styles.description}>
            {item.description}
          </Text>
        </div>

        {/* As etiquetas dizem o que o preço não diz sozinho: de que família é, se é coisa ou trabalho e quanto
            há ou quanto leva. Três, e só três (pedido de 2026-09-08). */}
        <ul className={styles.tags} aria-label="Detalhes do item">
          {chips.map((chip) => (
            <li key={chip.label}>
              <Badge tone={chip.tone} size="sm">
                {chip.label}
              </Badge>
            </li>
          ))}
        </ul>
      </div>
    </li>
  );
}
