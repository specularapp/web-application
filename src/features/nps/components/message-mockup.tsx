import { ArrowSquareOutIcon, CaretLeftIcon, CheckIcon, MicrophoneIcon, PlusIcon, SealCheckIcon } from "@phosphor-icons/react";
import styles from "./message-mockup.module.css";

export type MockMessage = { day: string; time: string; text: string; note?: string };

/** A conversa no WhatsApp do cliente, para a prévia das regras: o modelo que chega, com o botão do link, e o lembrete. */
export function WhatsAppMockup({ messages, button }: { messages: MockMessage[]; button: string }) {
  return (
    <div className={styles.phone} role="img" aria-label={`Prévia no WhatsApp: ${messages.map((message) => message.text).join(" ")}`}>
      <div className={styles.waHead} aria-hidden="true">
        <CaretLeftIcon />
        <span className={styles.waAvatar}>EN</span>
        <span className={styles.waTitle}>
          <strong>
            Estúdio Norte <SealCheckIcon weight="fill" />
          </strong>
          <small>Conta comercial</small>
        </span>
      </div>
      <div className={styles.waChat} aria-hidden="true">
        {messages.map((message, index) => (
          <div key={index} className={styles.waGroup}>
            <span className={styles.waDay}>{message.day}</span>
            {message.note && <span className={styles.waNote}>{message.note}</span>}
            <div className={styles.waBubble}>
              <p>{message.text}</p>
              <span className={styles.waMeta}>
                {message.time} <CheckIcon />
              </span>
            </div>
            <span className={styles.waButton}>
              <ArrowSquareOutIcon />
              {button}
            </span>
          </div>
        ))}
      </div>
      <div className={styles.waComposer} aria-hidden="true">
        <PlusIcon />
        <span className={styles.waField} />
        <MicrophoneIcon />
      </div>
    </div>
  );
}

/** O e-mail na caixa de entrada do cliente: quem mandou, o assunto, o texto e o botão da pesquisa. */
export function EmailMockup({ subject, greeting, time, button }: { subject: string; greeting: string; time: string; button: string }) {
  return (
    <div className={styles.phone} role="img" aria-label={`Prévia do e-mail: ${subject}. ${greeting}`}>
      <div className={styles.mailHead} aria-hidden="true">
        <CaretLeftIcon />
        <span>Entrada</span>
      </div>
      <div className={styles.mailBody} aria-hidden="true">
        <p className={styles.mailSubject}>{subject}</p>
        <div className={styles.mailFrom}>
          <span className={styles.mailAvatar}>EN</span>
          <span>
            <strong>Estúdio Norte</strong>
            <small>para mim</small>
          </span>
          <time>{time}</time>
        </div>
        <div className={styles.mailCard}>
          <span className={styles.mailLogo}>Estúdio Norte</span>
          <p>{greeting}</p>
          <span className={styles.mailButton}>{button}</span>
          <small>O link é pessoal e vale para uma resposta.</small>
        </div>
      </div>
    </div>
  );
}
