"use client";

import { TrashIcon, WarningIcon } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { useFloatingActionsRegistration } from "@/components/layout/floating-actions";
import { MOBILE_QUERY, useMediaQuery } from "@/hooks/use-media-query";
import { Avatar, AvatarGroup } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Text } from "@/components/ui/text";
import styles from "./confirm-dialog.module.css";

/** Quem vai sair, quando a ação tem rosto: cliente, pessoa da equipe, parte de um contrato. */
export type ConfirmFace = { id: string; name: string; avatarUrl?: string | null; seed?: string | null };

export type ConfirmDialogProps = {
  open: boolean;
  /** A pergunta, já no plural certo: "Excluir 3 clientes?". */
  title: string;
  /** O que se perde, em uma ou duas frases. É aqui que se diz o que vai junto. */
  description: ReactNode;
  onClose: () => void;
  onConfirm: () => void;
  /** Enquanto a ação roda, o botão gira e nada mais fecha a janela. */
  pending?: boolean;
  /** O rótulo do botão que confirma; o gerúndio dele aparece enquanto roda. */
  confirmLabel?: string;
  pendingLabel?: string;
  cancelLabel?: string;
  /** Vermelho por padrão, porque a janela nasceu para o que não tem volta. */
  tone?: "danger" | "default";
  /** Os rostos de quem sai; sem eles entra o glifo. */
  faces?: ConfirmFace[];
  /** O glifo do topo quando não há rosto; o padrão é a lixeira no tom de perigo. */
  icon?: ReactNode;
  /** O nome que o leitor de tela ouve ao abrir; sem ele vale o título. */
  label?: string;
};

/**
 * No celular a resposta mora na barra flutuante, como em toda janela da casa (2026-09-22, a pedido): confirmar
 * é a principal e o X é o não. Fica num componente de dentro da janela para registrar um degrau acima de
 * quem a abriu, senão a barra continuaria mostrando as ações da tela de baixo.
 */
function ConfirmBar({ label, pending, danger, onConfirm, onClose }: { label: string; pending: boolean; danger: boolean; onConfirm: () => void; onClose: () => void }) {
  const mobile = useMediaQuery(MOBILE_QUERY);
  useFloatingActionsRegistration(
    mobile
      ? {
          primary: { label, icon: danger ? <TrashIcon weight="bold" /> : undefined, loading: pending, onClick: onConfirm },
          cancel: { label: "Fechar", onClick: onClose },
        }
      : null,
  );
  return null;
}

/** Quantos rostos aparecem na fila; o resto vira "+N". */
const SHOWN_FACES = 5;

/**
 * A confirmação de uma ação sem volta, uma só para toda a aplicação.
 *
 * Nasceu na exclusão de clientes e virou primitivo em 2026-09-16, quando a padronização mostrou que cada
 * domínio resolvia isto de um jeito: clientes tinham janela própria com rostos, automações tinham uma
 * função de confirmação escrita dentro da prancha, e catálogo, projetos, tarefas e funil ofereciam
 * "Excluir" no menu sem nada acontecer.
 *
 * Janela pequena da casa, de vidro, centrada no computador e bandeja no celular. Os dois botões dividem a
 * largura, e o de confirmar é o vermelho, à direita.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  onClose,
  onConfirm,
  pending = false,
  confirmLabel = "Excluir",
  pendingLabel = "Excluindo",
  cancelLabel = "Cancelar",
  tone = "danger",
  faces,
  icon,
  label,
}: ConfirmDialogProps) {
  const shown = faces?.slice(0, SHOWN_FACES) ?? [];
  const rest = (faces?.length ?? 0) - shown.length;

  return (
    <Dialog
      open={open}
      onClose={pending ? () => undefined : onClose}
      label={label ?? title}
      size="sm"
      surface="glass"
      /* O foco não vai para o botão de confirmar ao abrir: a janela pergunta, e a resposta padrão é não. */
      focusOnOpen={false}
    >
      <ConfirmBar label={pending ? pendingLabel : confirmLabel} pending={pending} danger={tone === "danger"} onConfirm={onConfirm} onClose={pending ? () => undefined : onClose} />
      <div className={styles.dialog}>
        {shown.length > 0 ? (
          <div className={styles.faces}>
            <AvatarGroup className={styles.group}>
              {shown.map((face) => (
                <Avatar
                  key={face.id}
                  name={face.name}
                  src={face.avatarUrl ?? undefined}
                  seed={face.seed ?? face.name}
                  size="md"
                  shape="rounded"
                />
              ))}
            </AvatarGroup>
            {rest > 0 && (
              <Text as="span" variant="footnote" weight="semibold" className={styles.more}>
                +{rest}
              </Text>
            )}
          </div>
        ) : (
          <span className={styles.glyph} aria-hidden="true">
            {icon ?? (tone === "danger" ? <TrashIcon weight="bold" /> : <WarningIcon weight="bold" />)}
          </span>
        )}

        <div className={styles.copy}>
          <Text as="h2" variant="title3" weight="semibold" align="center">
            {title}
          </Text>
          <Text variant="subheadline" tone="secondary" align="center">
            {description}
          </Text>
        </div>

        <div className={styles.actions}>
          <Button variant="outline" radius="md" fullWidth disabled={pending} onClick={onClose}>
            {cancelLabel}
          </Button>
          <Button
            variant={tone === "danger" ? "danger" : "primary"}
            radius="md"
            fullWidth
            iconStart={tone === "danger" ? <TrashIcon /> : undefined}
            loading={pending}
            onClick={onConfirm}
          >
            {pending ? pendingLabel : confirmLabel}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

/** "Camila, Rafael e Ana" ou "Camila, Rafael, Ana e mais 4": primeiros nomes, para a frase caber. */
const listFormat = new Intl.ListFormat("pt-BR", { style: "long", type: "conjunction" });

export function confirmNames(names: string[], shown = 3) {
  const first = names.slice(0, shown).map((name) => name.split(" ")[0] ?? name);
  const rest = names.length - first.length;
  return rest > 0 ? listFormat.format([...first, `mais ${rest}`]) : listFormat.format(first);
}
