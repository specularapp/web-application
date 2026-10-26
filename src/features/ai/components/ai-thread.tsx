"use client";

import {
  ArrowBendDownRightIcon,
  ArrowClockwiseIcon,
  CheckIcon,
  CopyIcon,
  DownloadSimpleIcon,
  FileTextIcon,
  ThumbsDownIcon,
  ThumbsUpIcon,
} from "@phosphor-icons/react";
import { Fragment, useEffect, useRef, useState } from "react";
import { useToast } from "@/components/providers/toast-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Text } from "@/components/ui/text";
import { Tooltip } from "@/components/ui/tooltip";
import { VisuallyHidden } from "@/components/ui/visually-hidden";
import { rounded } from "@/lib/corners";
import { AudioBubble } from "@/features/tasks/components/chat-audio";
import { AI_STEP_MS, aiBlocks, aiWords, type AiMessage } from "../conversation";
import { aiFollowUps } from "../starters";
import { AiActionCards } from "./ai-action-cards";
import { AiMark } from "./ai-mark";
import styles from "./ai-thread.module.css";

type Feedback = "up" | "down";

/* Resposta com mais blocos que isto abre recolhida quando volta do histórico: a primeira parte responde, e o
   resto fica a um toque. A que está sendo escrita agora sempre fica inteira. */
const LONG_BLOCKS = 4;
const PREVIEW_BLOCKS = 2;

export type AiThreadProps = {
  messages: readonly AiMessage[];
  /** Perguntar de novo a mesma coisa. */
  onRetry: (question: string) => void;
  /** Continuar a última resposta com um dos atalhos. Sem ele, os atalhos não aparecem. */
  onFollowUp?: (prompt: string) => void;
};

/**
 * A conversa. A pergunta vai em balão, à direita; a resposta vem num cartão com a marca do SpeculAI no alto,
 * o que ele diz, os registros que leu, o que propõe fazer e as ferramentas: copiar, baixar, avaliar, refazer
 * e continuar.
 */
export function AiThread({ messages, onRetry, onFollowUp }: AiThreadProps) {
  const end = useRef<HTMLLIElement>(null);
  const [feedback, setFeedback] = useState<Record<string, Feedback>>({});

  /* A conversa acompanha o que está sendo escrito. Onde o compositor fica preso no pé do mesmo rolo, o rolo vai
     até o fim, senão a última linha ficaria atrás dele. */
  useEffect(() => {
    const scroller = end.current?.closest<HTMLElement>("[data-ai-scroller]");
    if (scroller) scroller.scrollTop = scroller.scrollHeight;
    else end.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  const lastAnswer = messages.findLastIndex((message) => message.role === "assistant");
  const busy = messages[lastAnswer]?.state === "thinking" || messages[lastAnswer]?.state === "writing";

  return (
    <ol className={styles.thread}>
      {messages.map((message, index) =>
        message.role === "person" ? (
          <Question key={message.id} message={message} />
        ) : (
          <Answer
            key={message.id}
            message={message}
            feedback={feedback[message.id]}
            onFeedback={(value) =>
              setFeedback((current) => {
                const next = { ...current };
                if (next[message.id] === value) delete next[message.id];
                else next[message.id] = value;
                return next;
              })
            }
            onRetry={() => onRetry(messages[index - 1]?.text ?? "")}
            onFollowUp={index === lastAnswer && !busy ? onFollowUp : undefined}
          />
        ),
      )}
      <li ref={end} aria-hidden="true" className={styles.end} />
    </ol>
  );
}

function Question({ message }: { message: AiMessage }) {
  return (
    <li className={styles.person}>
      {message.voice && (
        <span className={styles.sentAudio} {...rounded("lg")}>
          <AudioBubble audio={message.voice} />
        </span>
      )}

      {message.files && message.files.length > 0 && (
        <ul className={styles.sentFiles} aria-label="Arquivos enviados">
          {message.files.map((file) => (
            <li key={file.id} className={styles.sentFile} {...rounded("lg")}>
              <span className={styles.sentGlyph} {...rounded("md")}>
                <FileTextIcon weight="duotone" />
              </span>
              <span className={styles.sentText}>
                <Text as="span" variant="caption1" weight="medium" truncate title={file.name}>
                  {file.name}
                </Text>
                <Text as="span" variant="caption2" tone="secondary" numeric>
                  {file.size}
                </Text>
              </span>
            </li>
          ))}
        </ul>
      )}

      {message.text && (
        <Text as="p" variant="subheadline" className={styles.bubble} {...rounded("xl")}>
          {message.text}
        </Text>
      )}
    </li>
  );
}

type AnswerProps = {
  message: AiMessage;
  feedback?: Feedback;
  onFeedback: (value: Feedback) => void;
  onRetry: () => void;
  onFollowUp?: (prompt: string) => void;
};

function Answer({ message, feedback, onFeedback, onRetry, onFollowUp }: AnswerProps) {
  const { toast } = useToast();
  const blocks = aiBlocks(message.text);
  const long = blocks.length > LONG_BLOCKS;
  /* Medido ao montar: a resposta que nasce agora chega vazia e fica inteira; a que volta do histórico já chega
     longa e abre recolhida. */
  const [expanded, setExpanded] = useState(() => !(long && message.state === "done"));
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  const thinking = message.state === "thinking";
  const working = thinking || message.state === "writing";
  const settled = message.state === "done" || message.state === "stopped";
  const shown = expanded || !long ? blocks : blocks.slice(0, PREVIEW_BLOCKS);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message.text);
      setCopied(true);
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Não deu para copiar", description: "Selecione o texto e copie pelo teclado.", tone: "warning" });
    }
  };

  const download = () => {
    const url = URL.createObjectURL(new Blob([message.text], { type: "text/markdown;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "speculai-resposta.md";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <li className={styles.answerRow}>
      <article className={styles.answer} data-failed={message.failed || undefined} aria-label="Resposta do SpeculAI" {...rounded("xl")}>
        <header className={styles.identity}>
          <span className={styles.seal} {...rounded("lg")}>
            <AiMark size={18} motion={working ? "thinking" : "still"} />
          </span>
          <Text as="span" variant="subheadline" weight="semibold" className={styles.name}>
            SpeculAI
          </Text>
          <span className={styles.badges}>
            {message.failed ? (
              <Badge tone="danger" size="sm">
                Não foi possível responder
              </Badge>
            ) : working ? (
              <Badge tone="info" size="sm">
                Respondendo
              </Badge>
            ) : message.state === "stopped" ? (
              <Badge tone="neutral" size="sm">
                Interrompida
              </Badge>
            ) : message.actions && message.actions.length > 0 ? (
              <Badge tone="warning" size="sm">
                {message.actions.length} {message.actions.length === 1 ? "ação proposta" : "ações propostas"}
              </Badge>
            ) : null}
          </span>
        </header>

        {thinking ? (
          <Thinking steps={message.steps ?? []} />
        ) : message.failed ? (
          <Text as="p" variant="subheadline" tone="danger">
            {message.text}
          </Text>
        ) : (
          <div className={styles.text} data-collapsed={!expanded && long ? true : undefined}>
            {shown.map((block, blockIndex) =>
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
        )}

        {settled && long && !message.failed && (
          <Button variant="secondary" size="sm" radius="md" className={styles.expand} aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
            {expanded ? "Recolher a resposta" : "Ver a resposta completa"}
          </Button>
        )}

        {settled && message.sources && message.sources.length > 0 && (
          <section className={styles.sources} aria-label="Registros consultados">
            <Text as="p" variant="caption1" weight="medium" tone="secondary">
              Consultei
            </Text>
            <ul className={styles.sourceList}>
              {message.sources.map((source) => (
                <li key={source.id}>
                  <Badge tone="neutral" size="sm" shape="pill">
                    {source.label}
                  </Badge>
                </li>
              ))}
            </ul>
          </section>
        )}

        {settled && message.actions && message.actions.length > 0 && (
          <section className={styles.proposals} aria-label="Ações propostas">
            <Text as="h2" variant="subheadline" weight="semibold">
              Próximas ações
            </Text>
            <AiActionCards items={message.actions} />
          </section>
        )}

        {settled && (
          <div className={styles.tools}>
            <div className={styles.actions} role="group" aria-label="Ferramentas da resposta">
              {!message.failed && (
                <>
                  <Tooltip content={copied ? "Copiada" : "Copiar a resposta"}>
                    <IconButton label={copied ? "Resposta copiada" : "Copiar a resposta"} variant="ghost" size="sm" onClick={() => void copy()}>
                      {copied ? <CheckIcon /> : <CopyIcon />}
                    </IconButton>
                  </Tooltip>
                  <Tooltip content="Baixar em Markdown">
                    <IconButton label="Baixar a resposta em Markdown" variant="ghost" size="sm" onClick={download}>
                      <DownloadSimpleIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip content={feedback === "up" ? "Marcada como útil" : "Resposta útil"}>
                    <IconButton
                      label="Marcar como resposta útil"
                      variant="ghost"
                      size="sm"
                      foreground={feedback === "up" ? "var(--color-success)" : undefined}
                      aria-pressed={feedback === "up"}
                      onClick={() => onFeedback("up")}
                    >
                      <ThumbsUpIcon weight={feedback === "up" ? "fill" : "regular"} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip content={feedback === "down" ? "Marcada para melhorar" : "Resposta precisa melhorar"}>
                    <IconButton
                      label="Marcar resposta que precisa melhorar"
                      variant="ghost"
                      size="sm"
                      foreground={feedback === "down" ? "var(--color-warning)" : undefined}
                      aria-pressed={feedback === "down"}
                      onClick={() => onFeedback("down")}
                    >
                      <ThumbsDownIcon weight={feedback === "down" ? "fill" : "regular"} />
                    </IconButton>
                  </Tooltip>
                </>
              )}
              <Tooltip content="Gerar outra resposta">
                <IconButton label="Gerar outra resposta" variant="ghost" size="sm" onClick={onRetry}>
                  <ArrowClockwiseIcon />
                </IconButton>
              </Tooltip>
              <span className={styles.status} role="status">
                {copied ? "Resposta copiada." : ""}
              </span>
            </div>

            {onFollowUp && !message.failed && (
              <div className={styles.followUp} role="group" aria-label="Continuar esta resposta">
                <Text as="span" variant="caption1" weight="medium" tone="secondary">
                  Continuar
                </Text>
                <div className={styles.followUpList}>
                  {aiFollowUps.map((item) => (
                    <Button
                      key={item.id}
                      variant="outline"
                      size="sm"
                      radius="full"
                      iconStart={<ArrowBendDownRightIcon />}
                      onClick={() => onFollowUp(item.prompt)}
                    >
                      {item.label}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </article>
    </li>
  );
}

/**
 * O que ele está fazendo antes de a primeira palavra sair, um passo por vez, com um brilho passando pelas
 * letras. O leitor de tela ouve só que ele está respondendo, e não cada troca.
 */
function Thinking({ steps }: { steps: readonly string[] }) {
  const [at, setAt] = useState(0);

  useEffect(() => {
    if (steps.length <= 1) return;
    const timer = window.setInterval(() => setAt((current) => Math.min(current + 1, steps.length - 1)), AI_STEP_MS);
    return () => window.clearInterval(timer);
  }, [steps.length]);

  const label = steps[Math.min(at, steps.length - 1)] ?? "Pensando";

  return (
    <div className={styles.thinkingRow}>
      <p key={label} className={styles.thinking} aria-hidden="true">
        {label}
      </p>
      <VisuallyHidden role="status">O SpeculAI está respondendo</VisuallyHidden>
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
