"use client";

import { CheckIcon, FileIcon, FilePdfIcon, PaperclipIcon, PlusIcon, TrashIcon, UploadSimpleIcon, XIcon } from "@phosphor-icons/react";
import { format, parseISO } from "date-fns";
import { useRef, useState, type FormEvent } from "react";
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
import { rounded } from "@/lib/corners";
import { MOBILE_QUERY, useMediaQuery } from "@/hooks/use-media-query";
import { RecordPicker } from "@/features/records/components/record-picker";
import { recordKinds, type AppRecord, type RecordKind } from "@/features/records/records";
import { acceptDocuments, acceptImages, attachmentTypeOf, previewOf, sizeLabel } from "../files";
import { priorityLabels } from "../labels";
import type { Subtask, TaskAttachment, TaskLink, TaskLinkKind, TaskPerson, TaskPriority } from "../summary";
import { priorityMark } from "./priority-mark";
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

/**
 * As ações da janela na barra flutuante do celular (2026-09-11, a pedido), que é o contrato de toda janela da
 * casa: conteúdo na bandeja, ações na barra.
 *
 * **Isto mora dentro da `Dialog`, e não no corpo de quem a monta** (acerto de 2026-09-11, medido no
 * navegador). A barra elege quem registrou na maior profundidade, e a `Dialog` abre um `FloatingLayer` em
 * volta do **conteúdo** dela: registrando de fora, estas três janelas ficavam na mesma altura da ficha da
 * tarefa que as abre, e no empate quem vence é o pai, porque o React roda os efeitos dos filhos primeiro. Na
 * prática a barra continuava mostrando "Concluir" e "Fechar tarefa" com a janela de vincular aberta por
 * cima. Daqui de dentro a profundidade é maior e a janela de cima manda, como manda o contrato.
 *
 * **A barra é o botão da janela, e não um botão genérico**: ela leva o mesmo nome, o mesmo glifo e o mesmo
 * impedimento do confirmar que a janela desenharia no pé, então "Adicionar" na subtarefa e "Anexar" ou
 * "Anexar 3" no anexo, e nasce apagada enquanto falta o que a janela exige. Cancelar é o gêmeo do botão de
 * cancelar dela: os dois saem só desta bandeja, e a ficha continua aberta atrás.
 *
 * Sem `onSubmit` a janela não tem o que confirmar, que é o caso do vincular: ali escolher já vincula **e
 * fecha**, então não existe estado esperando um salvar. **A barra fica só com o X de sair**: uma principal
 * chamada "Fechar" ao lado do X de sair seriam dois botões para a mesma ação.
 */
/** A ação ao lado da de confirmar, como excluir a subtarefa aberta. */
type SideAction = { label: string; icon: React.ReactNode; onClick: () => void };

function BarActions({
  active,
  submitLabel,
  submitIcon,
  disabled,
  onSubmit,
  side,
  onClose,
}: {
  active: boolean;
  submitLabel?: string;
  submitIcon?: React.ReactNode;
  disabled?: boolean;
  onSubmit?: (event?: FormEvent) => void;
  side?: SideAction;
  onClose: () => void;
}) {
  useFloatingActionsRegistration(
    active
      ? onSubmit
        ? {
            primary: {
              label: submitLabel ?? "Salvar",
              icon: submitIcon,
              disabled,
              /* Direto na confirmação, e não pelo envio do formulário: o envio passa pela validação do
                 navegador, que recusava calado quando algum campo escondido da bandeja não passava. */
              onClick: () => onSubmit(),
            },
            extras: side ? [{ label: side.label, icon: side.icon, onClick: side.onClick }] : [],
            cancel: { label: "Fechar", onClick: onClose },
          }
        : { cancel: { label: "Fechar", onClick: onClose } }
      : null,
  );

  return null;
}

/** A moldura das três: título, o que muda no meio e os dois botões no pé. */
function AddDialog({
  open,
  onClose,
  title,
  onSubmit,
  submitLabel,
  submitIcon,
  disabled,
  side,
  size = "md",
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  onSubmit?: (event?: FormEvent) => void;
  submitLabel?: string;
  submitIcon?: React.ReactNode;
  disabled?: boolean;
  /** A ação que mora ao lado da de confirmar, como excluir o que está aberto. */
  side?: SideAction;
  size?: "md" | "lg";
  children: React.ReactNode;
}) {
  const mobile = useMediaQuery(MOBILE_QUERY);
  const submit = useRef<HTMLFormElement>(null);

  /* No celular o tamanho grande só tira o vidro, e não dá nada em troca: na bandeja toda janela é de largura
     cheia e 85dvh de altura, então `lg` e `md` desenham a mesma caixa, mas o `lg` entra na conta de janela
     pesada da `Dialog` e recebe a superfície sólida. Toda bandeja de escolha da casa é de vidro — a busca, as
     notificações, os seletores, o calendário —, e a de vincular saía sólida por causa disso. No desktop o
     `lg` continua, que é onde a largura serve à lista de registros. */
  const sheetSize = mobile && size === "lg" ? "md" : size;

  return (
    <Dialog open={open} onClose={onClose} label={title} size={sheetSize} surface="glass" focusOnOpen={false}>
      <BarActions
        active={open && mobile}
        submitLabel={submitLabel}
        submitIcon={submitIcon}
        disabled={disabled}
        onSubmit={onSubmit}
        side={side}
        onClose={onClose}
      />
      <form ref={submit} className={styles.dialog} onSubmit={onSubmit}>
        {/* Quem cancela é o X do topo (2026-09-22, a pedido): o pé fica só com o que confirma. No celular o X
            mora na barra flutuante. */}
        <div className={styles.head}>
          <Text as="h2" variant="headline" weight="semibold">
            {title}
          </Text>
          {!mobile && (
            <IconButton label="Fechar" variant="ghost" size="sm" onClick={onClose}>
              <XIcon />
            </IconButton>
          )}
        </div>

        <div className={styles.body}>{children}</div>

        {/* Sem botão de confirmar não há pé: é o caso do vincular, em que escolher já é confirmar. */}
        {onSubmit && (
          <div className={styles.actions} data-single={side ? undefined : ""}>
            {side && (
              <Button variant="outline" radius="md" fullWidth iconStart={side.icon} className={styles.danger} onClick={side.onClick}>
                {side.label}
              </Button>
            )}
            <Button type="submit" radius="md" fullWidth iconStart={submitIcon} disabled={disabled}>
              {submitLabel}
            </Button>
          </div>
        )}
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
  /** A subtarefa aberta para ver e editar; sem ela, a janela cria uma nova. */
  subtask?: Subtask;
  /** Excluir a subtarefa aberta, quando a janela está editando. */
  onRemove?: () => void;
};

/** O teto do título no celular (2026-09-22, a pedido): curto, para a linha caber na tela sem reticência longa. */
const SUBTASK_TITLE_MOBILE = 60;

/** Acrescentar subtarefa: o que precisa ser feito, quem assume, quanto pesa e até quando. */
export function SubtaskDialog({ open, onClose, team, onAdd, subtask, onRemove }: SubtaskDialogProps) {
  const mobile = useMediaQuery(MOBILE_QUERY);
  const [title, setTitle] = useState(subtask?.title ?? "");
  const [owner, setOwner] = useState(subtask?.person?.name ?? "");
  const [priority, setPriority] = useState<TaskPriority | "">(subtask?.priority ?? "");
  const [dueDate, setDueDate] = useState<Date | undefined>(subtask?.dueDate ? parseISO(subtask.dueDate) : undefined);

  const close = () => {
    setTitle("");
    setOwner("");
    setPriority("");
    setDueDate(undefined);
    onClose();
  };

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    const clean = title.trim();
    if (!clean) return;
    onAdd({
      title: clean,
      done: subtask?.done ?? false,
      person: team.find((person) => person.name === owner),
      priority: priority || undefined,
      dueDate: dueDate ? isoDay(dueDate) : undefined,
    });
    close();
  };

  return (
    <AddDialog
      open={open}
      onClose={close}
      title={subtask ? "Subtarefa" : "Nova subtarefa"}
      onSubmit={submit}
      submitLabel={subtask ? "Salvar" : "Adicionar"}
      submitIcon={subtask ? <CheckIcon /> : <PlusIcon />}
      side={onRemove ? { label: "Excluir", icon: <TrashIcon />, onClick: onRemove } : undefined}
      disabled={!title.trim()}
    >
      <Field label="O que precisa ser feito" required>
        <Input value={title} maxLength={mobile ? SUBTASK_TITLE_MOBILE : 120} onChange={(event) => setTitle(event.target.value)} placeholder="Revisar o escopo" />
      </Field>

      <div className={styles.pair}>
        <Field label="Responsável">
          <Select
            surface="glass"
            indicator="toggle"
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
            surface="glass"
            label="Prioridade"
            options={[
              { value: "", label: "Sem prioridade", media: <XIcon /> },
              ...priorities.map((value) => ({ value, label: priorityLabels[value], media: priorityMark(value) })),
            ]}
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
  /* eslint-disable-next-line @next/next/no-img-element */
  return <img src={previewOf(file)} alt="" />;
}

/**
 * Anexar arquivo é **upload** (2026-09-10, a pedido): a área recebe o arquivo arrastado ou aberto pelo
 * seletor do sistema, vários de uma vez, e mostra o que foi escolhido antes de confirmar. O tipo sai do que o
 * navegador diz do arquivo, e não de uma escolha à mão: a pessoa já sabe o que arrastou.
 *
 * A lista mostra o anexo na hora pelo endereço local do arquivo, e a ficha o sobe para o balde da tarefa ao
 * confirmar, gravando a linha que aponta para ele.
 */
export function AttachmentDialog({ open, onClose, onAdd }: AttachmentDialogProps) {
  const [picked, setPicked] = useState<File[]>([]);
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const close = () => {
    setPicked([]);
    setOver(false);
    onClose();
  };

  const take = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setPicked((current) => [...current, ...Array.from(files)]);
  };

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    if (picked.length === 0) return;
    for (const file of picked) {
      onAdd({ name: file.name, url: previewOf(file), type: attachmentTypeOf(file), size: sizeLabel(file.size) });
    }
    close();
  };

  return (
    <AddDialog
      open={open}
      onClose={close}
      title="Anexar arquivo"
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
        {...rounded("lg")}
      >
        <span className={styles.dropMark} aria-hidden="true" {...rounded("md", { clip: true })}>
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
              <span className={styles.pickedMark} data-preview={attachmentTypeOf(file) === "image" || undefined} aria-hidden="true" {...rounded("sm", { clip: true })}>
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
