"use client";

import { FloppyDiskIcon, PencilSimpleIcon, TrashIcon } from "@phosphor-icons/react";
import { useFloatingActionsRegistration } from "@/components/layout/floating-actions";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { IconButton } from "@/components/ui/icon-button";
import { Text } from "@/components/ui/text";
import { Tooltip } from "@/components/ui/tooltip";
import styles from "./quote-discard-dialog.module.css";

export type QuoteDiscardDialogProps = {
  open: boolean;
  /** Editando um orçamento que já existe, o texto fala de alterações; num novo, de rascunho. */
  editing: boolean;
  /** O número do orçamento, para a frase dizer onde ele vai ficar. */
  number: string;
  /** Enquanto o rascunho está sendo salvo, o botão gira e nada mais fecha a janela. */
  pending?: boolean;
  /**
   * No celular as três saídas moram na barra flutuante, como em toda janela da casa, e a bandeja fica só com
   * a pergunta; no desktop elas ficam aqui dentro.
   */
  mobile?: boolean;
  /** Volta para o formulário, sem sair. */
  onCancel: () => void;
  /** Sai jogando fora o que foi mexido. */
  onDiscard: () => void;
  /** Salva e sai. */
  onSave: () => void;
};

// A confirmação de sair do editor com alteração pendente (2026-09-10, a pedido). Antes, fechar salvava o
// rascunho sozinho, o que resolvia o esquecimento mas decidia pela pessoa: quem abriu para olhar e mexeu sem
// querer ficava com um rascunho que não pediu, e quem mexeu de propósito não sabia se tinha sido salvo.
// Agora a pergunta é explícita, com as três saídas que existem de verdade: salvar e sair, sair sem salvar, ou
// voltar para o formulário.
//
// Janela pequena da casa, de vidro, centrada no desktop e **bandeja no celular**, que é o `Dialog` da casa
// fazendo o que sempre faz. Quem muda com a moldura são as saídas, no contrato de toda janela daqui: no
// desktop as três ficam numa linha dentro dela, salvar com o nome e as outras duas no glifo, com o descarte
// por último, porque é o que perde trabalho; **no celular as três moram na barra flutuante** (salvar com o nome,
// sair sem salvar na lixeira e continuar editando no X), como a ficha do cliente e o item do catálogo já
// fazem, e a bandeja fica só com a pergunta.
/**
 * As três saídas na barra flutuante do celular, registradas **de dentro** da janela (2026-10-26, correção): a
 * barra mostra as ações da camada de cima, e com o editor numa janela a pergunta abre uma camada acima dele. Pelo
 * editor, uma camada abaixo, a barra ficava só com o X.
 */
function MobileExits({ editing, pending, onCancel, onDiscard, onSave }: Pick<QuoteDiscardDialogProps, "editing" | "pending" | "onCancel" | "onDiscard" | "onSave">) {
  useFloatingActionsRegistration({
    primary: { label: pending ? "Salvando" : editing ? "Salvar e sair" : "Salvar rascunho", loading: pending, onClick: onSave },
    extras: [{ label: "Sair sem salvar", icon: <TrashIcon />, disabled: pending, onClick: onDiscard }],
    cancel: { label: "Continuar editando", onClick: onCancel },
  });
  return null;
}

export function QuoteDiscardDialog({ open, editing, number, pending = false, mobile = false, onCancel, onDiscard, onSave }: QuoteDiscardDialogProps) {
  return (
    <Dialog open={open} onClose={pending ? () => undefined : onCancel} label="Sair do orçamento" size="sm" surface="glass" scrim focusOnOpen={false}>
      <div className={styles.dialog}>
        <div className={styles.copy}>
          <Text as="h2" variant="title3" weight="semibold" align="center">
            {editing ? "Salvar as alterações?" : "Salvar como rascunho?"}
          </Text>
          <Text variant="subheadline" tone="secondary" align="center">
            {editing
              ? `O que você mudou em ${number} ainda não foi salvo. Saindo sem salvar, o orçamento fica como estava.`
              : `${number} ainda não existe na lista. Salvo como rascunho, você continua de onde parou depois.`}
          </Text>
        </div>

        {/* No celular a bandeja é só a pergunta: as três saídas moram na barra flutuante, salvar com o nome,
            sair sem salvar na lixeira e continuar editando no X. */}
        {mobile && open && <MobileExits editing={editing} pending={pending} onCancel={onCancel} onDiscard={onDiscard} onSave={onSave} />}
        {!mobile && (
          <div className={styles.actions}>
            {/* As três saídas numa linha (2026-10-26, a pedido): salvar com o nome, tomando a largura, e as duas
                outras só no glifo, com o nome na dica e na leitura por voz. Sair sem salvar fica por último,
                porque é o que perde trabalho. */}
            <Button radius="md" iconStart={<FloppyDiskIcon />} loading={pending} onClick={onSave} className={styles.save}>
              {pending ? "Salvando" : editing ? "Salvar e sair" : "Salvar rascunho"}
            </Button>
            <Tooltip content="Continuar editando">
              <IconButton label="Continuar editando" variant="outline" radius="md" disabled={pending} onClick={onCancel}>
                <PencilSimpleIcon />
              </IconButton>
            </Tooltip>
            <Tooltip content="Sair sem salvar">
              <IconButton label="Sair sem salvar" variant="ghost" radius="md" disabled={pending} onClick={onDiscard}>
                <TrashIcon />
              </IconButton>
            </Tooltip>
          </div>
        )}
      </div>
    </Dialog>
  );
}
