"use client";

import { TrashIcon } from "@phosphor-icons/react";
import { Avatar, AvatarGroup } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Text } from "@/components/ui/text";
import type { ClientListItem } from "../list-options";
import styles from "./delete-clients-dialog.module.css";

export type DeleteClientsDialogProps = {
  clients: ClientListItem[];
  open: boolean;
  /** Enquanto a exclusão roda, o botão gira e nada mais fecha a janela. */
  pending?: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

/** Quantos rostos aparecem na fila; o resto vira "+N". */
const SHOWN_FACES = 5;
/** Quantos nomes aparecem na frase; o resto vira "e mais N". */
const SHOWN_NAMES = 3;

const listFormat = new Intl.ListFormat("pt-BR", { style: "long", type: "conjunction" });

/* "Camila, Rafael e Ana" ou "Camila, Rafael, Ana e mais 4": primeiros nomes, para a frase caber. */
function namesOf(clients: ClientListItem[]) {
  const first = clients.slice(0, SHOWN_NAMES).map((client) => client.name.split(" ")[0] ?? client.name);
  const rest = clients.length - first.length;
  return rest > 0 ? listFormat.format([...first, `mais ${rest}`]) : listFormat.format(first);
}

// A confirmação de excluir vários clientes de uma vez: a fila de rostos de quem vai sair, com teto e o
// resto em "+N", a pergunta com a contagem, a frase que diz o que se perde e os dois botões, o de excluir
// em vermelho. Janela pequena da casa, de vidro, centrada no desktop e bandeja no celular.
export function DeleteClientsDialog({ clients, open, pending = false, onClose, onConfirm }: DeleteClientsDialogProps) {
  const shown = clients.slice(0, SHOWN_FACES);
  const rest = clients.length - shown.length;
  const many = clients.length > 1;

  return (
    <Dialog open={open} onClose={pending ? () => undefined : onClose} label="Confirmar exclusão de clientes" size="sm" surface="glass" focusOnOpen={false}>
      <div className={styles.dialog}>
        <div className={styles.faces}>
          <AvatarGroup className={styles.group}>
            {shown.map((client) => (
              <Avatar key={client.id} name={client.name} src={client.avatarUrl ?? undefined} seed={client.email ?? client.name} size="md" shape="squircle" />
            ))}
          </AvatarGroup>
          {rest > 0 && (
            <Text as="span" variant="footnote" weight="semibold" className={styles.more}>
              +{rest}
            </Text>
          )}
        </div>

        <div className={styles.copy}>
          <Text as="h2" variant="title3" weight="semibold" align="center">
            {many ? `Excluir ${clients.length} clientes?` : "Excluir este cliente?"}
          </Text>
          <Text variant="subheadline" tone="secondary" align="center">
            {namesOf(clients)} {many ? "saem" : "sai"} da base com os orçamentos e projetos ligados a {many ? "eles" : "ele"}. Isso não pode ser desfeito.
          </Text>
        </div>

        <div className={styles.actions}>
          <Button variant="outline" radius="md" fullWidth disabled={pending} onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="danger" radius="md" fullWidth iconStart={<TrashIcon />} loading={pending} onClick={onConfirm}>
            {pending ? "Excluindo" : "Excluir"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
