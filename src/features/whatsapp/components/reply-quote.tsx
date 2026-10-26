import { CameraIcon, FileTextIcon, MicrophoneIcon, XIcon } from "@phosphor-icons/react";
import { IconButton } from "@/components/ui/icon-button";
import { whatsappPlain } from "../format";
import type { MessageQuote } from "../types";
import styles from "./reply-quote.module.css";

export type ReplyQuoteProps = {
  quote: MessageQuote;
  contactName: string;
  /** No campo, o X que desiste de responder. */
  onClose?: () => void;
};

/**
 * A citação de uma mensagem, no campo (ao responder) e dentro do balão (o que foi respondido): a barra e o nome na cor
 * de quem falou e o conteúdo numa linha no jeito do tipo.
 */
export function ReplyQuote({ quote, contactName, onClose }: ReplyQuoteProps) {
  const Glyph = quote.kind === "image" ? CameraIcon : quote.kind === "audio" ? MicrophoneIcon : quote.kind === "document" ? FileTextIcon : null;
  const fallback = quote.kind === "image" ? "Foto" : quote.kind === "audio" ? "Áudio" : quote.kind === "document" ? "Documento" : "";
  return (
    <span className={styles.quote} data-author={quote.author} data-in-field={onClose ? "" : undefined}>
      <span className={styles.copy}>
        <strong>{quote.author === "contact" ? contactName : "Você"}</strong>
        <span className={styles.body} data-kind={Glyph ? "media" : "text"}>
          {Glyph && <Glyph aria-hidden="true" />}
          {whatsappPlain(quote.text || fallback)}
        </span>
      </span>
      {onClose && (
        <IconButton label="Cancelar a resposta" variant="ghost" size="sm" onClick={onClose}>
          <XIcon />
        </IconButton>
      )}
    </span>
  );
}
