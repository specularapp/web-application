"use client";

import { ArrowUpIcon, ChatTextIcon, FileTextIcon, ImageIcon, LightningIcon, LockSimpleIcon, PaperclipIcon, PlusIcon, SmileyIcon, WaveformIcon, XIcon } from "@phosphor-icons/react";
import { useRef, useState, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, type DropdownSection } from "@/components/ui/dropdown-menu";
import { IconButton } from "@/components/ui/icon-button";
import { Kbd } from "@/components/ui/kbd";
import { Tooltip } from "@/components/ui/tooltip";
import { slugify } from "@/lib/utils/slug";
import { formatFull, formatSize } from "../inbox";
import type { MessageQuote, QuickReply } from "../types";
import styles from "./composer.module.css";
import { ReplyQuote } from "./reply-quote";

const EMOJIS: { group: string; items: string[] }[] = [
  { group: "Mais usados", items: ["😊", "😂", "👍", "🙏", "❤️", "🎉", "✅", "👏", "🙌", "😉", "🤝", "🚀"] },
  { group: "Rostos", items: ["😀", "😁", "😅", "🙂", "😍", "🤩", "🤔", "😎", "😌", "😢", "😮", "🙃"] },
  { group: "Trabalho", items: ["💼", "📎", "📅", "⏰", "📌", "📝", "💡", "📈", "💰", "🖥️", "📱", "🎨"] },
];

const FILE_KINDS = {
  midia: "image/*,video/*",
  documento: ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip",
  audio: "audio/*",
} as const;

const MAX_FILES = 10;

/** O "/" no começo do campo, sem espaço depois: o atalho de resposta rápida que está sendo digitado. */
const SLASH = /^\/(\S*)$/;

export type ComposerProps = {
  contactName: string;
  /** A janela de 24 horas: fechada, só nota interna ou modelo aprovado. */
  open: boolean;
  closedAt: string | null;
  replyTo: MessageQuote | null;
  onCancelReply: () => void;
  /** O texto parado no campo desta conversa. */
  draft: string;
  onDraft: (text: string) => void;
  /** Já com o nome do contato no lugar de {nome}. */
  quickReplies: QuickReply[];
  onSend: (text: string, mode: "text" | "note", files: File[]) => void;
  onOpenTemplates: () => void;
};

/**
 * O campo de escrever no pé da conversa, numa superfície só: o texto em cima e a fileira de funções embaixo (anexar,
 * nota interna, respostas rápidas, emojis e enviar). O "/" abre as respostas rápidas, Enter envia e Shift + Enter quebra
 * a linha. Com a janela de 24 horas fechada, o aviso fica acima do campo, que segue aberto para nota interna.
 */
export function Composer({ contactName, open, closedAt, replyTo, onCancelReply, draft, onDraft, quickReplies, onSend, onOpenTemplates }: ComposerProps) {
  const [text, setText] = useState(draft);
  const [mode, setMode] = useState<"message" | "note">("message");
  const [panel, setPanel] = useState<"quick" | "emoji" | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [active, setActive] = useState(0);
  const [files, setFiles] = useState<File[]>([]);
  const field = useRef<HTMLTextAreaElement>(null);
  const picker = useRef<HTMLInputElement>(null);

  const note = mode === "note" || !open;
  const slash = SLASH.exec(text);
  const showQuick = panel === "quick" || (Boolean(slash) && !dismissed);
  const term = slugify(slash?.[1] ?? "", 40);
  const matches = quickReplies.filter((reply) => !term || reply.shortcut.startsWith(term) || slugify(reply.title, 80).includes(term));
  const highlighted = matches[Math.min(active, matches.length - 1)] ?? null;

  const change = (next: string) => {
    setText(next);
    setActive(0);
    setDismissed(false);
    onDraft(next);
  };

  const focusField = () => window.requestAnimationFrame(() => field.current?.focus());

  const applyReply = (reply: QuickReply) => {
    change(reply.text);
    setPanel(null);
    focusField();
  };

  const insert = (value: string) => {
    const element = field.current;
    const start = element?.selectionStart ?? text.length;
    const end = element?.selectionEnd ?? text.length;
    change(text.slice(0, start) + value + text.slice(end));
    window.requestAnimationFrame(() => {
      element?.focus();
      element?.setSelectionRange(start + value.length, start + value.length);
    });
  };

  const send = () => {
    if (!text.trim() && files.length === 0) return;
    onSend(text.trim(), note ? "note" : "text", note ? [] : files);
    change("");
    setFiles([]);
    setPanel(null);
  };

  const pick = (kind: keyof typeof FILE_KINDS) => {
    if (!picker.current) return;
    picker.current.accept = FILE_KINDS[kind];
    picker.current.click();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (showQuick && matches.length > 0) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const delta = event.key === "ArrowDown" ? 1 : -1;
        setActive((current) => (current + delta + matches.length) % matches.length);
        return;
      }
      if ((event.key === "Enter" && !event.shiftKey) || event.key === "Tab") {
        event.preventDefault();
        if (highlighted) applyReply(highlighted);
        return;
      }
    }
    if (event.key === "Escape" && (showQuick || panel)) {
      event.preventDefault();
      setPanel(null);
      setDismissed(true);
      return;
    }
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    send();
  };

  const attachSections: DropdownSection[] = [
    ...(!note
      ? [
          {
            id: "arquivos",
            label: "Do computador",
            items: [
              { id: "midia", label: "Foto ou vídeo", icon: ImageIcon, onSelect: () => pick("midia") },
              { id: "documento", label: "Documento", icon: FileTextIcon, onSelect: () => pick("documento") },
              { id: "audio", label: "Áudio", icon: WaveformIcon, onSelect: () => pick("audio") },
            ],
          },
        ]
      : []),
    { id: "whatsapp", label: "WhatsApp", items: [{ id: "modelo", label: "Modelo aprovado", icon: ChatTextIcon, onSelect: onOpenTemplates }] },
  ];

  return (
    <div className={styles.composer}>
      {showQuick && (
        <section className={styles.quick} aria-label="Respostas rápidas">
          <div className={styles.quickList}>
            <span className={styles.panelTitle}>Respostas rápidas {slash ? <Kbd>/{slash[1]}</Kbd> : null}</span>
            {matches.length === 0 ? (
              <p className={styles.panelEmpty}>Nenhuma resposta com esse atalho.</p>
            ) : (
              matches.map((reply, index) => (
                <button key={reply.id} type="button" className={styles.quickItem} data-active={reply === highlighted || undefined} onPointerEnter={() => setActive(index)} onClick={() => applyReply(reply)}>
                  <span>{reply.title}</span>
                  <Kbd>/{reply.shortcut}</Kbd>
                </button>
              ))
            )}
          </div>
          <div className={styles.quickPreview} aria-live="polite">
            {highlighted ? (
              <>
                <span className={styles.panelTitle}>Vai ficar assim</span>
                <p>{highlighted.text}</p>
                <span className={styles.quickKeys}>
                  <span>
                    <Kbd>↑</Kbd> <Kbd>↓</Kbd> escolher
                  </span>
                  <span>
                    <Kbd>Enter</Kbd> usar
                  </span>
                  <span>
                    <Kbd>Esc</Kbd> fechar
                  </span>
                </span>
              </>
            ) : (
              <p className={styles.panelEmpty}>Escolha uma resposta para ver o texto.</p>
            )}
          </div>
        </section>
      )}

      {panel === "emoji" && (
        <section className={styles.emojiPanel} aria-label="Emojis">
          {EMOJIS.map((group) => (
            <div key={group.group} className={styles.emojiGroup}>
              <span className={styles.panelTitle}>{group.group}</span>
              <div className={styles.emojiGrid}>
                {group.items.map((emoji) => (
                  <button key={emoji} type="button" className={styles.emoji} onClick={() => insert(emoji)}>
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}

      <input
        ref={picker}
        type="file"
        multiple
        hidden
        aria-label="Escolher arquivos"
        onChange={(event) => {
          const chosen = Array.from(event.target.files ?? []);
          if (chosen.length > 0) setFiles((current) => [...current, ...chosen].slice(0, MAX_FILES));
          event.target.value = "";
        }}
      />

      {!open && (
        <div className={styles.closedStrip} title={closedAt ? `A janela fechou em ${formatFull(closedAt)}` : undefined}>
          <LockSimpleIcon weight="fill" aria-hidden="true" />
          <span>Janela de 24 horas fechada. Para falar com {contactName}, envie um modelo aprovado.</span>
          <Button size="sm" variant="secondary" radius="md" onClick={onOpenTemplates}>
            Enviar modelo
          </Button>
        </div>
      )}

      <div className={styles.box} data-note={note || undefined}>
        {replyTo && <ReplyQuote quote={replyTo} contactName={contactName} onClose={onCancelReply} />}

        {files.length > 0 && (
          <ul className={styles.attachments} aria-label="Arquivos para enviar">
            {files.map((file, index) => (
              <li key={`${file.name}-${index}`}>
                <PaperclipIcon aria-hidden="true" />
                <span>
                  <strong>{file.name}</strong>
                  <small>{formatSize(file.size)}</small>
                </span>
                <IconButton label={`Tirar ${file.name}`} variant="ghost" size="sm" onClick={() => setFiles((current) => current.filter((_, position) => position !== index))}>
                  <XIcon />
                </IconButton>
              </li>
            ))}
          </ul>
        )}

        <textarea
          ref={field}
          rows={2}
          value={text}
          className={styles.field}
          placeholder={note ? "Nota interna: só a equipe vê" : `Mensagem para ${contactName}`}
          aria-label={note ? "Nota interna" : `Mensagem para ${contactName}`}
          onChange={(event) => change(event.target.value)}
          onKeyDown={onKeyDown}
        />

        <div className={styles.tools}>
          <div className={styles.toolGroup}>
            <DropdownMenu label="Anexar" triggerLabel={note ? "Enviar modelo aprovado" : "Anexar foto, documento e mais"} icon={<PlusIcon />} size="sm" searchable={false} sections={attachSections} />
            <Tooltip content={open ? (note ? "Voltar para mensagem" : "Nota interna: só a equipe vê") : "Fora da janela de 24 horas, só nota interna"}>
              <IconButton
                label={note ? "Nota interna ligada" : "Escrever nota interna"}
                variant="ghost"
                size="sm"
                className={styles.tool}
                data-on={note || undefined}
                aria-pressed={note}
                disabled={!open}
                onClick={() => {
                  setMode(note ? "message" : "note");
                  focusField();
                }}
              >
                <LockSimpleIcon weight={note ? "fill" : "regular"} />
              </IconButton>
            </Tooltip>
            <span className={styles.toolDivider} aria-hidden="true" />
            <IconButton label="Respostas rápidas" variant="ghost" size="sm" className={styles.tool} data-on={showQuick || undefined} aria-pressed={showQuick} onClick={() => setPanel((current) => (current === "quick" || showQuick ? null : "quick"))}>
              <LightningIcon weight={showQuick ? "fill" : "regular"} />
            </IconButton>
            <span className={styles.wideOnly}>
              <IconButton label="Emojis" variant="ghost" size="sm" className={styles.tool} data-on={panel === "emoji" || undefined} aria-pressed={panel === "emoji"} onClick={() => setPanel((current) => (current === "emoji" ? null : "emoji"))}>
                <SmileyIcon weight={panel === "emoji" ? "fill" : "regular"} />
              </IconButton>
            </span>
          </div>
          <div className={styles.toolGroup}>
            <span className={styles.hints} aria-hidden="true">
              <span>
                <Kbd>/</Kbd> respostas
              </span>
              <span>
                <Kbd>Enter</Kbd> {note ? "salva a nota" : "envia"}
              </span>
              <span>
                <Kbd>Shift</Kbd> + <Kbd>Enter</Kbd> quebra linha
              </span>
            </span>
            <IconButton label={note ? "Salvar nota" : "Enviar"} variant="primary" size="sm" radius="md" disabled={!text.trim() && files.length === 0} onClick={send}>
              <ArrowUpIcon />
            </IconButton>
          </div>
        </div>
      </div>
    </div>
  );
}
