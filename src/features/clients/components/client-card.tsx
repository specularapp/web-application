"use client";

import type { KeyboardEvent, MouseEvent } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Text } from "@/components/ui/text";
import { squircle, squircleAuto } from "@/lib/corners";
import type { ClientListItem } from "../list-options";
import { ClientMenu } from "./client-menu";
import styles from "./client-card.module.css";

export type ClientCardProps = {
  client: ClientListItem;
  selected: boolean;
  onSelectedChange: (selected: boolean) => void;
  onOpen: () => void;
};

/* Controles com ação própria dentro do cartão: clique que nasce neles não abre a lateral. `label` entra
   na lista porque a caixa de seleção é um `label` com o campo por dentro. */
const INTERACTIVE = "button, a, input, label, [role='button'], [role='menuitem']";

// O cartão da listagem: a caixa de seleção à esquerda e o leque de ações à direita, e embaixo a foto, o
// nome e a empresa. O cartão inteiro abre a lateral com a ficha do cliente; marcar a seleção ou abrir o
// leque não abre nada, porque cada um tem ação própria. O fio da caixa é o mesmo do `Card`, em duas
// camadas, para o canto sair em superelipse também onde não há `corner-shape`.
export function ClientCard({ client, selected, onSelectedChange, onOpen }: ClientCardProps) {
  const onClick = (event: MouseEvent<HTMLElement>) => {
    const control = (event.target as HTMLElement).closest(INTERACTIVE);
    if (control && control !== event.currentTarget) return;
    onOpen();
  };

  // Só o teclado abre por tecla, e só quando o foco está no próprio cartão: dentro dele o Espaço é da
  // caixa de seleção e o Enter é do leque.
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onOpen();
    }
  };

  return (
    <li className={styles.card} data-selected={selected || undefined} {...squircle("xl", { clip: true })}>
      <div
        role="button"
        tabIndex={0}
        aria-haspopup="dialog"
        aria-label={`Ver ${client.name}`}
        className={styles.inner}
        onClick={onClick}
        onKeyDown={onKeyDown}
        {...squircleAuto({ clip: true })}
      >
        <div className={styles.head}>
          <Checkbox
            checked={selected}
            onChange={(event) => onSelectedChange(event.target.checked)}
            aria-label={`Selecionar ${client.name}`}
          />
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
