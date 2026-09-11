import type { TaskAttachment, TaskAttachmentType } from "./summary";

/**
 * As contas de arquivo da tarefa, num lugar só: o tamanho escrito como a pessoa lê, o tipo que o navegador
 * diz do arquivo e a conversão de um arquivo escolhido em anexo. Servem à janela de upload da ficha e ao
 * anexo da conversa, que fazem a mesma coisa com o mesmo modelo (2026-09-10).
 */
export function sizeLabel(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1).replace(".", ",")} MB`;
}

/** O tipo do anexo pelo que o navegador diz do arquivo: imagem, PDF, ou arquivo que a tela não abre. */
export function attachmentTypeOf(file: File): TaskAttachmentType {
  if (file.type.startsWith("image/")) return "image";
  if (file.type === "application/pdf") return "pdf";
  return "file";
}

/**
 * Um arquivo escolhido virando anexo. O endereço é um `blob:` feito na hora, então ele abre e baixa de
 * verdade nesta sessão; **o que falta é o armazenamento**: quem ligar o bucket troca o `createObjectURL` pelo
 * envio e guarda o endereço que voltar.
 */
export function attachmentOf(file: File, id: string): TaskAttachment {
  return { id, name: file.name, url: URL.createObjectURL(file), type: attachmentTypeOf(file), size: sizeLabel(file.size) };
}

/** O que o seletor do sistema aceita em cada caso, para "Imagem" não abrir a pasta inteira. */
export const acceptImages = "image/*";
export const acceptDocuments = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt,.zip,.rar,.ai,.psd,.sketch,.fig";
