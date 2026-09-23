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
 * O arquivo de verdade por trás de cada endereço `blob:` feito na tela: a lista mostra o anexo na hora pelo
 * endereço local, e quem grava precisa do conteúdo para subir ao balde. Guardado por endereço, e solto quando
 * o envio termina.
 */
const localFiles = new Map<string, Blob>();

export function keepLocalFile(blob: Blob) {
  const url = URL.createObjectURL(blob);
  localFiles.set(url, blob);
  return url;
}

export const localFileOf = (url: string) => localFiles.get(url) ?? null;

export function releaseLocalFile(url: string) {
  localFiles.delete(url);
}

/**
 * A prévia de um arquivo escolhido, uma por arquivo. Guardada, e não refeita a cada montagem: no modo estrito
 * o React monta, desmonta e monta de novo, e a prévia que era revogada na desmontagem de teste ficava
 * apontando para um endereço morto, que é a imagem quebrada da janela de anexar (2026-09-22).
 */
const previews = new WeakMap<Blob, string>();

export function previewOf(file: Blob) {
  const known = previews.get(file);
  if (known) return known;
  const url = keepLocalFile(file);
  previews.set(file, url);
  return url;
}

/** Um arquivo escolhido virando anexo, com o endereço local que abre na hora e o conteúdo guardado para subir. */
export function attachmentOf(file: File, id: string): TaskAttachment {
  return { id, name: file.name, url: previewOf(file), type: attachmentTypeOf(file), size: sizeLabel(file.size) };
}

/** O que o seletor do sistema aceita em cada caso, para "Imagem" não abrir a pasta inteira. */
export const acceptImages = "image/*";
export const acceptDocuments = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt,.zip,.rar,.ai,.psd,.sketch,.fig";

/**
 * Os dois juntos, para o celular (2026-09-11, a pedido de o anexo ser uma opção só que abre as outras): na
 * barra flutuante não cabe um glifo para imagem e outro para documento, e o seletor do próprio aparelho já
 * oferece galeria e arquivos na mesma folha. No desktop o menu com os dois tipos continua, porque lá o
 * seletor do sistema não separa nada.
 */
export const acceptAny = `${acceptImages},${acceptDocuments}`;
