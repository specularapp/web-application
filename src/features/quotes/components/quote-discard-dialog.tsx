"use client";

import { FloppyDiskIcon, TrashIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Text } from "@/components/ui/text";
import styles from "./quote-discard-dialog.module.css";

export type QuoteDiscardDialogProps = {
  open: boolean;
  /** Editando um orçamento que já existe, o texto fala de alterações; num novo, de rascunho. */
  editing: boolean;
  /** O número do orçamento, para a frase dizer onde ele vai ficar. */
  number: string;
  /** Enquanto o rascunho está sendo salvo, o botão gira e nada mais fecha a janela. */
  pending?: boolean;
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
// Os botões vão empilhados, e não em duas colunas como na exclusão: aqui são três, e a ordem de cima para
// baixo é a da intenção mais provável, com o descarte por último e em vermelho, porque é o que perde
// trabalho. Janela pequena da casa, de vidro, centrada no desktop e bandeja no celular.
export function QuoteDiscardDialog({ open, editing, number, pending = false, onCancel, onDiscard, onSave }: QuoteDiscardDialogProps) {
  return (
    <Dialog open={open} onClose={pending ? () => undefined : onCancel} label="Sair do orçamento" size="sm" surface="glass" focusOnOpen={false}>
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

        <div className={styles.actions}>
          <Button radius="md" fullWidth iconStart={<FloppyDiskIcon />} loading={pending} onClick={onSave}>
            {pending ? "Salvando" : editing ? "Salvar e sair" : "Salvar rascunho"}
          </Button>
          <Button variant="outline" radius="md" fullWidth disabled={pending} onClick={onCancel}>
            Continuar editando
          </Button>
          {/* Sair sem salvar fica por último e como fantasma: ele perde trabalho, então não disputa a vista
              com salvar. O vermelho sólido do `danger` é do excluir, que apaga da base; descartar o que ainda
              não foi salvo é menos que isso, e o texto já diz o que acontece. */}
          <Button variant="ghost" radius="md" fullWidth iconStart={<TrashIcon />} disabled={pending} onClick={onDiscard}>
            Sair sem salvar
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
