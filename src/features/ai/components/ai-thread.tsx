"use client";

import { ArrowClockwiseIcon, CopyIcon, PaperclipIcon } from "@phosphor-icons/react";
import { Fragment, useEffect, useRef, useState } from "react";
import { useToast } from "@/components/providers/toast-provider";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { squircle, squircleAuto } from "@/lib/corners";
import { AudioBubble } from "@/features/tasks/components/chat-audio";
import { AI_STEP_MS, aiBlocks, aiWords, type AiMessage } from "../conversation";
import { AiMark } from "./ai-mark";
import styles from "./ai-thread.module.css";

export type AiThreadProps = {
  messages: readonly AiMessage[];
  /** Perguntar de novo a mesma coisa, no botão de refazer da resposta. */
  onRetry: (question: string) => void;
};

/**
 * A conversa. A pergunta da pessoa vai em balão, à direita; a resposta vem **solta na coluna**, sem balão e
 * sem recuo, do jeito que Gemini, Claude e Grok resolvem: a resposta é longa e cheia de lista, e um balão em
 * volta dela só estreitaria o texto e faria a leitura pular de margem em margem.
 *
 * Antes da primeira palavra ela diz o que está fazendo, um passo por vez, e depois o texto **surge palavra
 * por palavra**, cada uma saindo do borrão. Terminada, mostra os registros que leu e as ações de copiar e
 * refazer.
 */
export function AiThread({ messages, onRetry }: AiThreadProps) {
  const { toast } = useToast();
  const end = useRef<HTMLDivElement>(null);

  /* A conversa acompanha o que está sendo escrito: cada palavra que chega empurra o fim para a vista. Sem
     movimento suave, porque em texto que cresce a cada 34ms o suave nunca alcança. */
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Resposta copiada", description: "Cole onde precisar.", tone: "success" });
    } catch {
      toast({ title: "Não deu para copiar", description: "Selecione o texto e copie pelo teclado.", tone: "warning" });
    }
  };

  return (
    <ol className={styles.thread}>
      {messages.map((message, index) =>
        message.role === "person" ? (
          <li key={message.id} className={styles.person}>
            <div className={styles.sent}>
              {/* O que foi junto fica **acima** do balão, e não dentro: o balão é a fala, e o anexo é o que
                  a acompanha, como em qualquer conversa com arquivo. */}
              {message.voice && (
                <span className={styles.sentAudio} {...squircle("md")}>
                  <AudioBubble audio={message.voice} />
                </span>
              )}

              {message.files && message.files.length > 0 && (
                <ul className={styles.sentFiles}>
                  {message.files.map((file) => (
                    <li key={file.id} className={styles.sentFile} {...squircle("sm")}>
                      <PaperclipIcon />
                      <Text as="span" variant="caption2" weight="medium" truncate>
                        {file.name}
                      </Text>
                      <Text as="span" variant="caption2" tone="tertiary" numeric>
                        {file.size}
                      </Text>
                    </li>
                  ))}
                </ul>
              )}

              <div className={styles.bubble} {...squircle("lg")}>
                <Text as="p" variant="subheadline">
                  {message.text}
                </Text>
              </div>
            </div>
          </li>
        ) : (
          <li key={message.id} className={styles.answer}>
            <AiMark size={15} className={styles.mark} />

            <div className={styles.said}>
              {message.state === "thinking" ? <Thinking steps={message.steps ?? []} /> : <Said text={message.text} />}

              {message.state === "stopped" && (
                <Text as="p" variant="caption2" tone="tertiary">
                  Resposta interrompida.
                </Text>
              )}

              {/* De onde saiu o que ela diz: os registros lidos, em pílulas, para dar para conferir. */}
              {(message.state === "done" || message.state === "stopped") && message.sources && message.sources.length > 0 && (
                <ul className={styles.sources}>
                  {message.sources.map((source) => (
                    <li key={source.id} className={styles.source} {...squircleAuto()}>
                      <Text as="span" variant="caption2" weight="medium" truncate>
                        {source.label}
                      </Text>
                    </li>
                  ))}
                </ul>
              )}

              {(message.state === "done" || message.state === "stopped") && (
                <div className={styles.actions}>
                  <Button variant="ghost" size="sm" radius="md" iconStart={<CopyIcon />} onClick={() => void copy(message.text)}>
                    Copiar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    radius="md"
                    iconStart={<ArrowClockwiseIcon />}
                    onClick={() => onRetry(messages[index - 1]?.text ?? "")}
                  >
                    Refazer
                  </Button>
                </div>
              )}
            </div>
          </li>
        ),
      )}
      <div ref={end} />
    </ol>
  );
}

/**
 * O que ela está fazendo antes de a primeira palavra sair, um passo por vez, na tinta que anda do apagado
 * para o vivo. É o que Claude e Gemini fazem, e o motivo é honestidade: dizer "lendo os orçamentos" e depois
 * "montando o resumo" conta o que está acontecendo, enquanto um ponto girando não conta nada.
 */
function Thinking({ steps }: { steps: readonly string[] }) {
  const [at, setAt] = useState(0);

  /* Sem zerar o passo aqui: cada resposta traz um `Thinking` novo, porque a linha dela é uma chave nova na
     lista, então este estado já nasce no primeiro passo. */
  useEffect(() => {
    if (steps.length <= 1) return;
    const timer = window.setInterval(() => setAt((current) => Math.min(current + 1, steps.length - 1)), AI_STEP_MS);
    return () => window.clearInterval(timer);
  }, [steps.length]);

  const label = steps[Math.min(at, steps.length - 1)] ?? "Pensando";

  /* Sem o `Text` da casa de propósito: a tinta aqui é um degradê que anda, e a classe do primitivo e a minha
     têm a mesma força, então quem ganharia dependeria da ordem da folha. A chave troca com o passo, para a
     linha nova entrar animando em vez de o texto simplesmente mudar embaixo do olho. */
  return (
    <p key={label} className={styles.thinking}>
      {label}
    </p>
  );
}

/** A resposta em blocos, com cada palavra num elemento próprio: é isso que deixa a que chega agora surgir do
 *  borrão sem mexer nas que já estão na tela. */
function Said({ text }: { text: string }) {
  return (
    <div className={styles.text}>
      {aiBlocks(text).map((block, blockIndex) =>
        block.kind === "list" ? (
          <ul key={blockIndex} className={styles.list}>
            {block.items.map((item, itemIndex) => (
              <li key={itemIndex}>
                <Text as="span" variant="subheadline">
                  <Words text={item} id={`${blockIndex}-${itemIndex}`} />
                </Text>
              </li>
            ))}
          </ul>
        ) : (
          <Text key={blockIndex} as="p" variant="subheadline">
            <Words text={block.text} id={`${blockIndex}`} />
          </Text>
        ),
      )}
    </div>
  );
}

function Words({ text, id }: { text: string; id: string }) {
  return (
    <>
      {aiWords(text).map((word, index) =>
        word.space ? (
          <Fragment key={`${id}-${index}`}>{word.text}</Fragment>
        ) : (
          <span key={`${id}-${index}`} className={styles.word}>
            {word.strong ? <strong>{word.text}</strong> : word.text}
          </span>
        ),
      )}
    </>
  );
}
