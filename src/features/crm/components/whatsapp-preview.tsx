"use client";

import { ArrowSquareOutIcon, CheckIcon, ClockIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { useToast } from "@/components/providers/toast-provider";
import { Composer } from "@/features/whatsapp/components/composer";
import inbox from "@/features/whatsapp/components/inbox.module.css";
import { WhatsappText } from "@/features/whatsapp/format";
import { formatTime } from "@/features/whatsapp/inbox";
import { contactFirstName, opportunityGreeting, whatsappLink, whatsappNumber } from "../whatsapp";
import styles from "./whatsapp-preview.module.css";

const noop = () => undefined;

type Bubble = { id: string; text: string; at: string; sent: boolean };

export type WhatsappPreviewProps = {
  contact: { name: string; phone: string };
  title: string;
  /** Quem responde pela venda: é em nome dele que a mensagem se apresenta e que o balão sai. */
  sender?: string;
};

/**
 * A conversa da oportunidade ao lado da ficha (2026-10-26, a pedido: "literalmente igual" ao chat do lead da
 * pousada): o cabeçalho curto com o link para o WhatsApp, o fundo da conversa com o divisor do dia, os balões com
 * o rabinho e a hora na última linha, e o mesmo campo das conversas no pé. O balão de saída é a prévia ao vivo
 * do que está no campo, que já nasce com a primeira mensagem escrita a partir da ficha; enviar abre o WhatsApp
 * com o texto pronto no número dela.
 *
 * Enquanto ninguém mexe no campo, o texto acompanha a ficha (nome, título e responsável). O que foi enviado daqui
 * fica na conversa enquanto a ficha está aberta, para a pessoa ver o que mandou.
 */
export function WhatsappPreview({ contact, title, sender }: WhatsappPreviewProps) {
  const { toast } = useToast();
  const greeting = opportunityGreeting({ contact: contact.name, title, sender });
  const [draft, setDraft] = useState<string | null>(null);
  /* A mensagem padrão do momento em que a pessoa começou a escrever: é a chave do campo dali em diante. */
  const [editedFrom, setEditedFrom] = useState<string | null>(null);
  const [sent, setSent] = useState<Bubble[]>([]);
  const [now] = useState(() => new Date().toISOString());
  const text = draft ?? greeting;
  const number = whatsappNumber(contact.phone);
  const first = contactFirstName(contact.name);
  const name = first || "o contato";
  const author = sender ?? "Você";

  const bubbles: Bubble[] = text.trim() ? [...sent, { id: "preview", text, at: now, sent: false }] : sent;

  const send = (value: string) => {
    if (!number) {
      toast({ title: "Sem telefone", description: "Adicione o telefone do contato em Informações para enviar.", tone: "warning" });
      return;
    }
    window.open(whatsappLink(number, value), "_blank", "noopener");
    setSent((current) => [...current, { id: `sent-${current.length}`, text: value, at: new Date().toISOString(), sent: true }]);
    setDraft("");
  };

  return (
    <section className={`${inbox.screen} ${styles.chat}`} aria-label={`Conversa com ${contact.name || "o contato"}`}>
      <header className={styles.head}>
        <span>
          <strong>Conversa</strong>
          <small>{first ? `WhatsApp de ${first}` : "WhatsApp do contato"}</small>
        </span>
        {number && (
          <a href={`https://wa.me/${number}`} target="_blank" rel="noopener" className={styles.open}>
            Abrir no WhatsApp
            <ArrowSquareOutIcon aria-hidden="true" />
          </a>
        )}
      </header>

      <div className={styles.messages}>
        <section className={styles.dayGroup} aria-label="Hoje">
          <div className={styles.day}>
            <span>Hoje</span>
          </div>
          {bubbles.length === 0 ? (
            <p className={styles.empty}>Escreva a mensagem para {name} no campo abaixo.</p>
          ) : (
            bubbles.map((bubble, index) => (
              <div key={bubble.id} className={styles.row} data-out="" data-first={index === 0 || undefined}>
                <div className={styles.bubble} data-first={index === 0 || undefined} data-pending={!bubble.sent || undefined}>
                  {index === 0 && <span className={styles.author}>{author}</span>}
                  <p className={styles.text}>
                    <WhatsappText text={bubble.text} />
                    <span className={styles.spacer} aria-hidden="true" />
                  </p>
                  <span className={styles.meta}>
                    <time dateTime={bubble.at}>{formatTime(bubble.at)}</time>
                    {bubble.sent ? <CheckIcon aria-label="Enviada" /> : <ClockIcon aria-label="Ainda não enviada" />}
                  </span>
                </div>
              </div>
            ))
          )}
        </section>
      </div>

      <div className={styles.composer}>
        {/* A chave remonta o campo quando a mensagem padrão muda e ninguém mexeu nela: o campo guarda o texto
            dele, e sem isso continuaria com o nome antigo depois de a ficha trocar o contato. Depois da primeira
            tecla ela fica parada, senão o campo remontaria no meio da escrita. */}
        <Composer
          key={editedFrom ?? greeting}
          textOnly
          contactName={name}
          open
          closedAt={null}
          replyTo={null}
          onCancelReply={noop}
          draft={text}
          onDraft={(value) => {
            if (editedFrom === null) setEditedFrom(greeting);
            setDraft(value);
          }}
          quickReplies={[]}
          onSend={(value) => send(value)}
          onOpenTemplates={noop}
        />
      </div>
    </section>
  );
}
