import type { CSSProperties } from "react";
import { emailHues, fillEmailVariables } from "../email-catalog";
import type { EmailBlock, EmailHue } from "../types";
import styles from "./email-preview.module.css";

export type EmailPreviewProps = {
  subject: string;
  preheader: string;
  fromName: string;
  fromEmail: string;
  hue: EmailHue;
  blocks: EmailBlock[];
  /** `desktop` e `mobile` são a prévia de trabalho; `thumb` é a miniatura do cartão de modelo. */
  size?: "desktop" | "mobile" | "thumb";
  /** Sem o cabeçalho da caixa de entrada, só o corpo do e-mail. */
  bare?: boolean;
};

function Block({ block }: { block: EmailBlock }) {
  switch (block.kind) {
    case "heading":
      return <h3 className={styles.heading}>{fillEmailVariables(block.text) || "Título"}</h3>;
    case "text":
      return <p className={styles.text}>{fillEmailVariables(block.text)}</p>;
    case "button":
      return (
        <p className={styles.buttonRow}>
          <span className={styles.button}>{block.label || "Botão"}</span>
        </p>
      );
    case "image":
      return (
        <figure className={styles.image}>
          <span className={styles.imageArt} aria-hidden="true" />
          <figcaption>{block.caption}</figcaption>
        </figure>
      );
    case "list":
      return (
        <ul className={styles.list}>
          {block.items.map((item, index) => (
            <li key={index}>{fillEmailVariables(item)}</li>
          ))}
        </ul>
      );
    case "quote":
      return (
        <blockquote className={styles.quote}>
          <p>{fillEmailVariables(block.text)}</p>
          <cite>{block.author}</cite>
        </blockquote>
      );
    case "divider":
      return <hr className={styles.divider} />;
  }
}

// A prévia do e-mail, desenhada a partir dos blocos: o cabeçalho como a caixa de entrada mostra (quem manda,
// o assunto e a linha de apoio) e o corpo na largura de um e-mail. A cor do e-mail é um matiz da paleta do
// sistema, então a prévia funciona nos dois temas. Sem estado, para servir à lista, ao editor e ao relatório.
export function EmailPreview({ subject, preheader, fromName, fromEmail, hue, blocks, size = "desktop", bare = false }: EmailPreviewProps) {
  return (
    <article className={styles.mail} data-size={size} style={{ "--mail-hue": emailHues[hue].value } as CSSProperties} aria-label={`Prévia do e-mail ${fillEmailVariables(subject)}`}>
      {!bare && (
        <header className={styles.inbox}>
          <span className={styles.sender} aria-hidden="true">
            {fromName.slice(0, 1)}
          </span>
          <span className={styles.inboxCopy}>
            <span className={styles.inboxFrom}>
              <strong>{fromName}</strong>
              <small>{fromEmail}</small>
            </span>
            <strong className={styles.subject}>{fillEmailVariables(subject) || "Sem assunto"}</strong>
            {preheader && <small className={styles.preheader}>{fillEmailVariables(preheader)}</small>}
          </span>
        </header>
      )}
      <div className={styles.body}>
        <div className={styles.paper}>
          <span className={styles.brand}>{fromName}</span>
          {blocks.length === 0 ? <p className={styles.empty}>Adicione um bloco para começar o e-mail.</p> : blocks.map((block) => <Block key={block.id} block={block} />)}
          <footer className={styles.footer}>
            Você recebeu este e-mail porque se cadastrou no site do {fromName}. <u>Descadastrar</u>
          </footer>
        </div>
      </div>
    </article>
  );
}
