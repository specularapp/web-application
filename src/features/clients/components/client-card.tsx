"use client";

import { StarIcon } from "@phosphor-icons/react";
import { Avatar } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Text } from "@/components/ui/text";
import { VisuallyHidden } from "@/components/ui/visually-hidden";
import { squircle, squircleAuto } from "@/lib/corners";
import type { ClientListItem } from "../list-options";
import { ClientMenu } from "./client-menu";
import styles from "./client-card.module.css";

export type ClientCardProps = {
  client: ClientListItem;
  selected: boolean;
  onSelectedChange: (selected: boolean) => void;
  favorite: boolean;
  onFavoriteChange: (favorite: boolean) => void;
};

// O cartão da listagem: em cima a caixa de seleção e a estrela de favorito à esquerda, o leque de ações
// à direita; embaixo a foto, o nome e a empresa. É só a visualização do cliente, sem nada mais: quem
// abre, edita ou gera documento é o leque. O fio da caixa é o mesmo do `Card`, em duas camadas, para o
// canto sair em superelipse também onde não há `corner-shape`.
export function ClientCard({ client, selected, onSelectedChange, favorite, onFavoriteChange }: ClientCardProps) {
  return (
    <li className={styles.card} data-selected={selected || undefined} {...squircle("xl", { clip: true })}>
      <div className={styles.inner} {...squircleAuto({ clip: true })}>
        <div className={styles.head}>
          <Checkbox
            checked={selected}
            onChange={(event) => onSelectedChange(event.target.checked)}
            aria-label={`Selecionar ${client.name}`}
          />

          {/* A estrela marca e desmarca no lugar, sem abrir o leque: é a ação mais repetida da lista. */}
          <button
            type="button"
            className={styles.star}
            data-on={favorite || undefined}
            aria-pressed={favorite}
            onClick={() => onFavoriteChange(!favorite)}
            {...squircle("sm")}
          >
            <StarIcon weight={favorite ? "fill" : "regular"} aria-hidden="true" />
            <VisuallyHidden>{favorite ? `Desfavoritar ${client.name}` : `Favoritar ${client.name}`}</VisuallyHidden>
          </button>

          <span className={styles.menu}>
            <ClientMenu client={client} />
          </span>
        </div>

        <div className={styles.identity}>
          <Avatar
            name={client.name}
            src={client.avatarUrl ?? undefined}
            seed={client.email ?? client.name}
            size="lg"
            className={styles.photo}
          />
          <Text as="p" variant="subheadline" weight="semibold" truncate className={styles.name}>
            {client.name}
          </Text>
          {client.company && (
            <Text as="p" variant="caption1" tone="tertiary" truncate>
              {client.company}
            </Text>
          )}
        </div>
      </div>
    </li>
  );
}
