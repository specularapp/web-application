"use client";

import { useState } from "react";
import { useToast } from "@/components/providers/toast-provider";
import { RichTextView } from "@/components/ui/rich-text";
import { LazyRichTextEditor } from "@/components/ui/rich-text/lazy";
import { Text } from "@/components/ui/text";
import { docIsEmpty, emptyDoc, type DocNode } from "@/lib/rich-doc";
import { uploadTaskImage } from "../upload";
import styles from "./task-description.module.css";

/**
 * A descrição da tarefa (2026-09-22, a pedido: "igual um notion funciona, ali conseguimos colocar titulos,
 * checkbox, lista, imagens estendidas e tudo mais"). Ela tem dois estados, e essa é a decisão que segura o
 * "sem pesar o sistema" do mesmo pedido:
 *
 * - **Lendo**, que é como toda ficha abre, o texto é desenhado pelo `RichTextView`, que é estático. O editor
 *   não existe no pacote dessa tela: ele é importado só quando alguém clica para editar.
 * - **Editando**, o editor entra por importação dinâmica, **sem moldura e sem barra** (a pedido, na mesma
 *   rodada): o texto fica no mesmo lugar e com a mesma cara, só ganha cursor. Quem formata é a bolha que
 *   aparece na seleção e os atalhos de escrita; a imagem entra colada ou arrastada. Quem grava é a ficha,
 *   que salva tudo o que ela guarda com uma pausa depois da última mexida.
 *
 * O clique no texto abre a edição, como já acontecia com a descrição de uma linha que existia aqui antes, e
 * de lá não se sai: enquanto a ficha estiver aberta, a descrição segue editável, que é como se escreve numa
 * página de anotação. Não há botão de concluir porque não há nada a confirmar, e não há saída por clique
 * fora porque a bolha de formatação flutua fora da caixa e fecharia o editor no meio da frase.
 */

export type TaskDescriptionProps = {
  taskId: string;
  value: DocNode | null;
  onChange: (doc: DocNode | null) => void;
  /** Sem id de tarefa salva não há pasta para a imagem, e o botão dela não aparece. */
  canUpload?: boolean;
  /** Se a ficha está gravando agora, para o sinal ao pé do editor dizer a verdade. */
  saving?: boolean;
};

export function TaskDescription({ taskId, value, onChange, canUpload = true, saving = false }: TaskDescriptionProps) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);

  const change = (doc: DocNode) => onChange(docIsEmpty(doc) ? null : doc);

  if (!editing) {
    return (
      <button type="button" className={styles.opener} aria-label="Editar a descrição" onClick={() => setEditing(true)}>
        <RichTextView doc={value} placeholder="Sem descrição. Clique para escrever." />
      </button>
    );
  }

  return (
    <div className={styles.editing}>
      <LazyRichTextEditor
        value={value ?? emptyDoc()}
        onChange={change}
        label="Descrição da tarefa"
        placeholder="Escreva os detalhes. Comece com # para um título, - para uma lista ou [] para uma caixa de marcar."
        focusOnMount
        onUploadImage={canUpload ? (file) => uploadTaskImage(taskId, file) : undefined}
        onImageError={(message) => toast({ title: "Não deu para enviar a imagem", description: message, tone: "danger" })}
      />
      <Text as="span" variant="caption2" tone="tertiary" className={styles.state}>
        {saving ? "Salvando" : "Salvo"}
      </Text>
    </div>
  );
}
