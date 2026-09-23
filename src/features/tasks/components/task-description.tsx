"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/providers/toast-provider";
import { RichTextView } from "@/components/ui/rich-text";
import type { RichTextEditor } from "@/components/ui/rich-text/editor";
import { Text } from "@/components/ui/text";
import { docIsEmpty, emptyDoc, type DocNode } from "@/lib/rich-doc";
import { uploadTaskImage } from "../upload";
import styles from "./task-description.module.css";

/**
 * A descrição da tarefa (2026-09-22, a pedido: "igual um notion funciona, ali conseguimos colocar titulos,
 * checkbox, lista, imagens estendidas e tudo mais").
 *
 * **É um campo como outro qualquer** (2026-09-22, a pedido, na mesma rodada): clicar no texto só põe o
 * cursor, como no título, sem trocar de caixa. Antes o texto de leitura dava lugar a um editor carregado na
 * hora do clique, com um giro no meio e uma linha de estado surgindo embaixo, e a descrição "mudava de
 * input". Agora o editor é baixado assim que a ficha abre, em segundo plano, e até ele chegar a tela mostra
 * o mesmo texto no mesmo desenho; quando ele chega, a troca não se vê.
 *
 * Sem moldura e sem barra: quem formata é a bolha que aparece na seleção e os atalhos de escrita; a imagem
 * entra colada ou arrastada. Quem grava é a ficha, que salva com uma pausa depois da última mexida.
 */

export type TaskDescriptionProps = {
  taskId: string;
  value: DocNode | null;
  onChange: (doc: DocNode | null) => void;
  /** Sem id de tarefa salva não há pasta para a imagem, e o envio dela não acontece. */
  canUpload?: boolean;
  /** Se a ficha está gravando agora, para o sinal no canto dizer a verdade. */
  saving?: boolean;
};

/* Curto como o de um campo qualquer (2026-09-22, a pedido): os atalhos de escrita se descobrem escrevendo. */
const PLACEHOLDER = "Escreva aqui";

type Editor = typeof RichTextEditor;

export function TaskDescription({ taskId, value, onChange, canUpload = true, saving = false }: TaskDescriptionProps) {
  const { toast } = useToast();
  const [Editor, setEditor] = useState<Editor | null>(null);

  /* O pacote do editor chega por trás, assim que a descrição aparece, e não no clique. */
  useEffect(() => {
    let alive = true;
    void import("@/components/ui/rich-text/editor").then((module) => {
      if (alive) setEditor(() => module.RichTextEditor);
    });
    return () => {
      alive = false;
    };
  }, []);

  const change = (doc: DocNode) => onChange(docIsEmpty(doc) ? null : doc);
  const reading = <RichTextView doc={value} placeholder={PLACEHOLDER} />;

  return (
    <div className={styles.editing}>
      {Editor ? (
        <Editor
          value={value ?? emptyDoc()}
          onChange={change}
          label="Descrição da tarefa"
          placeholder={PLACEHOLDER}
          fallback={reading}
          onUploadImage={canUpload ? (file) => uploadTaskImage(taskId, file) : undefined}
          onImageError={(message) => toast({ title: "Não deu para enviar a imagem", description: message, tone: "danger" })}
        />
      ) : (
        reading
      )}
      {saving && (
        <Text as="span" variant="caption2" tone="tertiary" className={styles.state}>
          Salvando
        </Text>
      )}
    </div>
  );
}
