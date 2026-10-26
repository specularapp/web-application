"use client";

import { ArrowBendUpLeftIcon, CheckIcon, ChecksIcon, ClockIcon, FileTextIcon, ImageIcon, LockSimpleIcon, PauseIcon, PlayIcon, WarningCircleIcon } from "@phosphor-icons/react";
import { memo, useEffect, useState, type CSSProperties } from "react";
import { WhatsappText } from "../format";
import { deliveryLabels, documentType, formatDuration, formatSize, formatTime } from "../inbox";
import type { DeliveryStatus, WhatsappMessage } from "../types";
import { ReplyQuote } from "./reply-quote";
import styles from "./thread.module.css";

function Ticks({ status }: { status: DeliveryStatus }) {
  if (status === "sending") return <ClockIcon aria-label={deliveryLabels.sending} />;
  if (status === "failed") return <WarningCircleIcon weight="fill" data-failed="" aria-label={deliveryLabels.failed} />;
  if (status === "sent") return <CheckIcon aria-label={deliveryLabels.sent} />;
  return <ChecksIcon data-read={status === "read" || undefined} aria-label={deliveryLabels[status]} />;
}

/** As barras da onda, estáveis pela mensagem, para não mudarem a cada desenho. */
const bars = (id: string) => Array.from({ length: 28 }, (_, index) => 0.3 + (((id.charCodeAt(index % id.length) * (index + 7)) % 17) / 17) * 0.7);

/** O áudio no desenho do WhatsApp: tocar, a onda que acende conforme anda e a duração. */
function AudioPlayer({ id, seconds = 0 }: { id: string; seconds?: number }) {
  const [playing, setPlaying] = useState(false);
  const [heard, setHeard] = useState(0);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      setHeard((current) => {
        const next = current + 0.25;
        if (next < seconds) return next;
        setPlaying(false);
        return 0;
      });
    }, 250);
    return () => window.clearInterval(timer);
  }, [playing, seconds]);

  const share = seconds > 0 ? heard / seconds : 0;
  const levels = bars(id);
  return (
    <span className={styles.audio}>
      <button type="button" className={styles.play} aria-label={playing ? "Pausar o áudio" : "Ouvir o áudio"} aria-pressed={playing} onClick={() => setPlaying((value) => !value)}>
        {playing ? <PauseIcon weight="fill" /> : <PlayIcon weight="fill" />}
      </button>
      <span className={styles.wave} aria-hidden="true">
        {levels.map((level, index) => (
          <i key={index} data-played={(index + 1) / levels.length <= share || undefined} style={{ "--level": level } as CSSProperties} />
        ))}
      </span>
      <small>{formatDuration(playing || heard > 0 ? heard : seconds)}</small>
    </span>
  );
}

export type MessageBubbleProps = {
  message: WhatsappMessage;
  /** A primeira de um bloco do mesmo autor: leva o rabinho e o nome. */
  first: boolean;
  contactName: string;
  onReply: (message: WhatsappMessage) => void;
  onRetry: (message: WhatsappMessage) => void;
};

/**
 * Um balão da conversa. O contato fala à esquerda; a equipe e os modelos saem à direita, cada um no seu tom. A nota
 * interna é amarela, com cadeado, e só a equipe vê. A hora e os ticks moram na última linha; a que falhou diz isso em
 * texto, com o "Tentar de novo".
 */
export const MessageBubble = memo(function MessageBubble({ message, first, contactName, onReply, onRetry }: MessageBubbleProps) {
  if (message.author === "system") {
    return (
      <div className={styles.system}>
        <span>{message.text}</span>
      </div>
    );
  }

  const out = message.author !== "contact";
  const tone = message.kind === "note" ? "note" : message.kind === "template" ? "template" : message.author;
  const pending = out && message.status === "sending";
  const buttons = message.kind === "template" ? (message.template?.buttons ?? []) : [];
  const media = message.kind === "image";

  return (
    <div className={styles.row} data-out={out || undefined} data-first={first || undefined}>
      <div className={buttons.length > 0 ? styles.templateStack : styles.passThrough}>
        <div className={styles.bubble} data-tone={tone} data-first={first || undefined} data-media={media || undefined} data-pending={pending || undefined} aria-busy={pending || undefined}>
          {first && out && (
            <span className={styles.bubbleAuthor}>
              {message.kind === "note" ? (
                <>
                  <LockSimpleIcon weight="fill" aria-hidden="true" /> Nota interna de {message.authorName}
                </>
              ) : message.kind === "template" ? (
                `Modelo ${message.authorName ?? ""}`.trim()
              ) : (
                message.authorName
              )}
            </span>
          )}

          {message.replyTo && <ReplyQuote quote={message.replyTo} contactName={contactName} />}

          {media && (
            <span className={styles.image} role="img" aria-label={message.attachment?.name ? `Foto ${message.attachment.name}` : "Foto"}>
              <ImageIcon aria-hidden="true" />
              {message.attachment && <small>{message.attachment.name}</small>}
            </span>
          )}

          {message.kind === "audio" && <AudioPlayer id={message.id} seconds={message.attachment?.duration} />}

          {message.kind === "document" && message.attachment && (
            <span className={styles.document}>
              <FileTextIcon weight="duotone" aria-hidden="true" />
              <span>
                <strong>{message.attachment.name}</strong>
                <small>
                  {documentType(message.attachment.name)}, {formatSize(message.attachment.size)}
                </small>
              </span>
            </span>
          )}

          {message.kind === "template" && message.template?.header && <strong className={styles.templateHeader}>{message.template.header}</strong>}

          {message.text && (
            <p className={styles.text}>
              <WhatsappText text={message.text} />
              {!message.template?.footer && <span className={styles.spacer} data-out={out || undefined} aria-hidden="true" />}
            </p>
          )}

          {message.kind === "template" && message.template?.footer && (
            <small className={styles.templateFooter}>
              {message.template.footer}
              <span className={styles.spacer} data-out={out || undefined} aria-hidden="true" />
            </small>
          )}

          <span className={styles.meta} data-overlay={media && !message.text ? "" : undefined}>
            <time dateTime={message.at}>{formatTime(message.at)}</time>
            {out && message.status && <Ticks status={message.status} />}
          </span>

          {message.kind !== "note" && (
            <button type="button" className={styles.replyButton} aria-label="Responder" onClick={() => onReply(message)}>
              <ArrowBendUpLeftIcon />
            </button>
          )}
        </div>

        {buttons.length > 0 && (
          <div className={styles.templateButtons}>
            {buttons.map((text) => (
              <span key={text}>
                <ArrowBendUpLeftIcon aria-hidden="true" /> {text}
              </span>
            ))}
          </div>
        )}
      </div>

      {message.status === "failed" && (
        <span className={styles.failedLine} role="status">
          Não entregue.{" "}
          <button type="button" onClick={() => onRetry(message)}>
            Tentar de novo
          </button>
        </span>
      )}
    </div>
  );
});
