"use client";

import { FileIcon, FilePdfIcon, PaperclipIcon, PlusIcon, UploadSimpleIcon, XIcon } from "@phosphor-icons/react";
import { format } from "date-fns";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useFloatingActionsRegistration } from "@/components/layout/floating-actions";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { IconButton } from "@/components/ui/icon-button";
import { Text } from "@/components/ui/text";
import { squircle } from "@/lib/corners";
import { MOBILE_QUERY, useMediaQuery } from "@/hooks/use-media-query";
import { RecordPicker } from "@/features/records/components/record-picker";
import { recordKinds, type AppRecord, type RecordKind } from "@/features/records/records";
import { acceptDocuments, acceptImages, attachmentTypeOf, sizeLabel } from "../files";
import { priorityLabels } from "../labels";
import type { Subtask, TaskAttachment, TaskLink, TaskLinkKind, TaskPerson, TaskPriority } from "../summary";
import styles from "./task-add-dialogs.module.css";

/**
 * As janelas de acrescentar da ficha da tarefa (2026-09-10, a pedido de "adicionar em todos precisa abrir um
 * modal"): subtarefa, vínculo e anexo. Todas na janela pequena de vidro da casa, com os campos no `Field` e
 * nos controles de sempre, e o par de botões dividindo a largura no pé, como a confirmação de excluir.
 *
 * Nenhuma delas grava: o item entra na lista da janela e vive na sessão, enquanto o domínio não está no
 * banco. Quem ligar a tabela troca o `onAdd` por uma Server Action com o mesmo argumento.
 */

const priorities: TaskPriority[] = ["low", "normal", "high", "urgent"];

/** Os tipos de registro que uma tarefa aceita vincular: o resto do índice serve para apontar, não para amarrar. */
const linkKinds: RecordKind[] = ["client", "quote", "project", "contract"];

const isoDay = (date: Date) => format(date, "yyyy-MM-dd");

/** A moldura das três: título, o que muda no meio e os dois botões no pé. */
function AddDialog({
  open,
  onClose,
  title,
  hint,
  onSubmit,
  submitLabel,
  submitIcon,
  disabled,
  size = "md",
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  hint?: string;
  onSubmit?: (event: FormEvent) => void;
  submitLabel?: string;
  submitIcon?: React.ReactNode;
  disabled?: boolean;
  size?: "md" | "lg";
  children: React.ReactNode;
}) {
  const mobile = useMediaQuery(MOBILE_QUERY);
  const submit = useRef<HTMLFormElement>(null);

  /**
   * No celular as ações saem do pé da bandeja e vão para a barra flutuante (2026-09-11, a pedido), que é o
   * contrato de toda janela da casa e o que o editor de orçamento já fazia com as bandejas dele: conteúdo na
   * bandeja, ações na barra. Estas três abrem **por cima** da ficha da tarefa, então enquanto uma delas está
   * no ar é ela quem manda na barra, e a ficha volta a mandar quando ela fecha — quem registrar por último
   * ganha, e a bandeja de cima monta depois.
   *
   * Sem `onSubmit` a janela não tem o que confirmar, que é o caso do vincular, em que escolher já vincula:
   * ali a principal é o próprio fechar, como no editor de orçamento.
   */
  useFloatingActionsRegistration(
    open && mobile
      ? onSubmit
        ? {
            primary: { label: submitLabel ?? "Salvar", disabled, onClick: () => submit.current?.requestSubmit() },
            cancel: { label: "Cancelar", onClick: onClose },
          }
        : { primary: { label: "Concluir", onClick: onClose }, cancel: { label: "Fechar", onClick: onClose } }
      : null,
  );

  return (
    <Dialog open={open} onClose={onClose} label={title} size={size} surface="glass" focusOnOpen={false}>
      <form ref={submit} className={styles.dialog} onSubmit={onSubmit}>
        <div className={styles.head}>
          <Text as="h2" variant="headline" weight="semibold">
            {title}
          </Text>
          {hint && (
            <Text variant="footnote" tone="secondary">
              {hint}
            </Text>
          )}
        </div>

        <div className={styles.body}>{children}</div>

        {/* Sem botão de confirmar, o pé fica só com o fechar: é o caso do vincular, em que escolher já é
            confirmar. */}
        <div className={styles.actions} data-single={onSubmit ? undefined : ""}>
          <Button variant="outline" radius="md" fullWidth onClick={onClose}>
            {onSubmit ? "Cancelar" : "Fechar"}
          </Button>
          {onSubmit && (
            <Button type="submit" radius="md" fullWidth iconStart={submitIcon} disabled={disabled}>
              {submitLabel}
            </Button>
          )}
        </div>
      </form>
    </Dialog>
  );
}

export type SubtaskDialogProps = {
  open: boolean;
  onClose: () => void;
  /** Quem pode assumir a subtarefa. */
  team: TaskPerson[];
  onAdd: (subtask: Omit<Subtask, "id">) => void;
};

/** Acrescentar subtarefa: o que precisa ser feito, quem assume, quanto pesa e até quando. */
export function SubtaskDialog({ open, onClose, team, onAdd }: SubtaskDialogProps) {
  const [title, setTitle] = useState("");
  const [owner, setOwner] = useState("");
  const [priority, setPriority] = useState<TaskPriority | "">("");
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const clean = title.trim();
    if (!clean) return;
    onAdd({
      title: clean,
      done: false,
      person: team.find((person) => person.name === owner),
      priority: priority || undefined,
      dueDate: dueDate ? isoDay(dueDate) : undefined,
    });
    setTitle("");
    setOwner("");
    setPriority("");
    setDueDate(undefined);
    onClose();
  };

  return (
    <AddDialog
      open={open}
      onClose={onClose}
      title="Nova subtarefa"
      hint="Um passo do trabalho, com responsável e prazo próprios quando fizer diferença."
      onSubmit={submit}
      submitLabel="Adicionar"
      submitIcon={<PlusIcon />}
      disabled={!title.trim()}
    >
      <Field label="O que precisa ser feito" required>
        <Input value={title} maxLength={120} onChange={(event) => setTitle(event.target.value)} placeholder="Revisar o escopo com a cliente" />
      </Field>

      <div className={styles.pair}>
        <Field label="Responsável">
          <Select
            label="Responsável"
            options={[
              { value: "", label: "Sem responsável" },
              ...team.map((person) => ({ value: person.name, label: person.name, media: <Avatar name={person.name} src={person.avatarUrl ?? undefined} size="xs" /> })),
            ]}
            value={owner}
            onChange={setOwner}
            searchable={team.length > 8}
            searchPlaceholder="Buscar pessoa"
          />
        </Field>

        <Field label="Prioridade">
          <Select
            label="Prioridade"
            options={[{ value: "", label: "Sem prioridade" }, ...priorities.map((value) => ({ value, label: priorityLabels[value] }))]}
            value={priority}
            onChange={(value) => setPriority(value as TaskPriority | "")}
          />
        </Field>
      </div>

      <Field label="Prazo">
        <DatePicker value={dueDate} onChange={setDueDate} placeholder="Sem prazo" />
      </Field>
    </AddDialog>
  );
}

export type LinkDialogProps = {
  open: boolean;
  onClose: () => void;
  /** O índice do que existe na aplicação, montado no servidor. */
  records: AppRecord[];
  /** Os que já estão vinculados, para não oferecer duas vezes. */
  linked: TaskLink[];
  onAdd: (link: TaskLink) => void;
};

/**
 * Vincular registro: o seletor do que existe na aplicação, com busca e abas por tipo. Escolher já vincula e
 * fecha, então não há botão de confirmar: a escolha é a confirmação.
 */
export function LinkDialog({ open, onClose, records, linked, onAdd }: LinkDialogProps) {
  /* Só o que uma tarefa amarra, e sem o que já está amarrado. */
  const available = records.filter(
    (record) => linkKinds.includes(record.kind) && !linked.some((link) => link.reference === record.reference),
  );

  const pick = (record: AppRecord) => {
    onAdd({
      id: record.href.split("/").at(-1) ?? record.key,
      kind: record.kind as TaskLinkKind,
      reference: record.reference ?? recordKinds[record.kind].label,
      name: record.name,
      caption: record.caption,
      media: record.media,
    });
    onClose();
  };

  return (
    <AddDialog
      open={open}
      onClose={onClose}
      title="Vincular registro"
      hint="Cliente, orçamento, projeto ou contrato. Escolher já vincula."
      size="lg"
    >
      <div className={styles.picker}>
        <RecordPicker records={available} kinds={linkKinds} onPick={pick} placeholder="Buscar cliente, orçamento ou projeto" />
      </div>
    </AddDialog>
  );
}

export type AttachmentDialogProps = {
  open: boolean;
  onClose: () => void;
  onAdd: (attachment: Omit<TaskAttachment, "id">) => void;
};

/** O tamanho legível de um arquivo, como o anexo mostra na lista: "937 KB", "1,4 MB". */


/**
 * A prévia de uma imagem escolhida, antes de confirmar: o endereço `blob:` nasce com a linha e é solto
 * quando ela sai, senão cada redesenho deixaria um endereço pendurado na memória.
 */
function PickedImage({ file }: { file: File }) {
  const url = useMemo(() => URL.createObjectURL(file), [file]);

  useEffect(() => () => URL.revokeObjectURL(url), [url]);

  /* eslint-disable-next-line @next/next/no-img-element */
  return <img src={url} alt="" />;
}



/**
 * Anexar arquivo é **upload** (2026-09-10, a pedido): a área recebe o arquivo arrastado ou aberto pelo
 * seletor do sistema, vários de uma vez, e mostra o que foi escolhido antes de confirmar. O tipo sai do que o
 * navegador diz do arquivo, e não de uma escolha à mão: a pessoa já sabe o que arrastou.
 *
 * O endereço é um `blob:` feito na hora (`URL.createObjectURL`), então o anexo abre e baixa de verdade nesta
 * sessão. **O que falta é o armazenamento**: quem ligar o bucket troca o `URL.createObjectURL` pelo envio e
 * guarda o endereço que voltar, sem mexer em mais nada daqui.
 */
export function AttachmentDialog({ open, onClose, onAdd }: AttachmentDialogProps) {
  const [picked, setPicked] = useState<File[]>([]);
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const take = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setPicked((current) => [...current, ...Array.from(files)]);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (picked.length === 0) return;
    for (const file of picked) {
      onAdd({ name: file.name, url: URL.createObjectURL(file), type: attachmentTypeOf(file), size: sizeLabel(file.size) });
    }
    setPicked([]);
    onClose();
  };

  return (
    <AddDialog
      open={open}
      onClose={onClose}
      title="Anexar arquivo"
      hint="Arraste para cá ou escolha no computador. Imagem, PDF e documento."
      onSubmit={submit}
      submitLabel={picked.length > 1 ? `Anexar ${picked.length}` : "Anexar"}
      submitIcon={<PaperclipIcon />}
      disabled={picked.length === 0}
    >
      {/* A área de soltar: o clique abre o seletor do sistema e o arrasto acende a caixa. O campo de arquivo
          fica escondido porque o desenho dele não é da casa, e quem recebe o toque é a área inteira. */}
      <button
        type="button"
        className={styles.drop}
        data-over={over || undefined}
        onClick={() => input.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setOver(false);
          take(event.dataTransfer.files);
        }}
        {...squircle("lg")}
      >
        <span className={styles.dropMark} aria-hidden="true" {...squircle("md", { clip: true })}>
          <UploadSimpleIcon />
        </span>
        <Text variant="subheadline" weight="semibold">
          Solte o arquivo aqui
        </Text>
        <Text variant="footnote" tone="secondary">
          ou clique para escolher no computador
        </Text>
        <input
          ref={input}
          type="file"
          multiple
          accept={`${acceptImages},${acceptDocuments}`}
          className={styles.file}
          aria-label="Escolher arquivos para anexar"
          onChange={(event) => take(event.target.files)}
        />
      </button>

      {picked.length > 0 && (
        <ul className={styles.picked}>
          {picked.map((file, index) => (
            <li key={`${file.name}-${index}`} className={styles.pickedItem}>
              <span className={styles.pickedMark} data-preview={attachmentTypeOf(file) === "image" || undefined} aria-hidden="true" {...squircle("sm", { clip: true })}>
                {attachmentTypeOf(file) === "image" ? (
                  <PickedImage file={file} />
                ) : attachmentTypeOf(file) === "pdf" ? (
                  <FilePdfIcon weight="bold" />
                ) : (
                  <FileIcon weight="bold" />
                )}
              </span>
              <span className={styles.pickedCopy}>
                <Text as="span" variant="subheadline" weight="medium" truncate>
                  {file.name}
                </Text>
                <Text as="span" variant="caption1" tone="secondary">
                  {sizeLabel(file.size)}
                </Text>
              </span>
              <IconButton
                label={`Tirar ${file.name}`}
                variant="ghost"
                size="sm"
                onClick={() => setPicked((current) => current.filter((_, position) => position !== index))}
              >
                <XIcon />
              </IconButton>
            </li>
          ))}
        </ul>
      )}
    </AddDialog>
  );
}
