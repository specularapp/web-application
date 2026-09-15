"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AI_STEP_MS, aiTitle, type AiConversation, type AiMessage } from "../conversation";
import { previewAiReply } from "../preview";
import type { AiAttachment, AiUsage, AiVoice } from "../summary";

/** O que o assistente precisa saber para abrir: quanto do ciclo já foi, com quem ele fala e o que oferecer. */
export type AiPanelData = {
  usage: AiUsage;
  /** Nome de quem está na conta, para a saudação do vazio. */
  viewer: string;
};

type AiPanelContextValue = {
  data: AiPanelData | null;
  open: boolean;
  toggle: () => void;
  close: () => void;
  /** O que está escrito no compositor. Mora aqui, e não no compositor, para fechar e abrir de novo não
   *  jogar fora a pergunta pela metade. */
  draft: string;
  setDraft: (value: string) => void;
  messages: readonly AiMessage[];
  /** Verdadeiro entre a pergunta sair e a resposta terminar. */
  answering: boolean;
  /** Manda a pergunta com o que ela leva junto. O anexo fica **na mensagem**, e não no compositor. */
  ask: (question: string, carried?: { files?: readonly AiAttachment[]; voice?: AiVoice | null }) => void;
  stop: () => void;
  /** Guarda a conversa em curso no histórico e abre uma vazia. */
  reset: () => void;
  /** As conversas fechadas, da mais recente para a mais antiga. */
  history: readonly AiConversation[];
  /** Tira uma do histórico e a põe de volta em curso, guardando a de agora. */
  resume: (id: string) => void;
};

const AiPanelContext = createContext<AiPanelContextValue | null>(null);

/* O tempo entre uma palavra e a seguinte. Quinze milissegundos, e não trinta e quatro (acerto de
   2026-09-14, a pedido): a resposta é longa, e no ritmo anterior ela levava mais de dez segundos para sair
   inteira, o que é tempo de esperar, não de ler. A entrada de cada palavra encurtou junto, na folha.
   O pensar antes dela sai da contagem dos passos: cada passo fica na tela o seu tempo, e a primeira palavra
   só começa quando o último passo acaba. Essa pausa não é enfeite: é ela que separa "recebi a pergunta" de
   "estou respondendo", e sem ela a resposta aparece de um golpe e a conversa lê como um script. */
const WORD_MS = 15;

/**
 * Quem sabe se o assistente está aberto e o que já foi dito nele. Mora na concha, acima da grade, porque
 * quem abre é o widget do topo, lá dentro da página, e quem aparece é uma coluna irmã do conteúdo: os dois
 * só se encontram aqui.
 *
 * A resposta é **simulada** (`previewAiReply`): ela sai palavra por palavra, como sai a de qualquer
 * assistente de verdade, para a conversa ter a forma certa antes de existir modelo do outro lado. Quando a
 * rota de IA existir, `ask` passa a chamar `api/v1` e lê o fluxo dela; o resto da tela não muda.
 */
export function AiPanelProvider({ data, children }: { data?: AiPanelData; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<readonly AiMessage[]>([]);
  /* O histórico vive na memória desta sessão, e não em cookie nem em Web Storage: conversa é conteúdo, e a
     casa só guarda preferência de tela em cookie. Ele passa a vir do banco quando a IA existir lá. */
  const [history, setHistory] = useState<readonly AiConversation[]>([]);
  const timer = useRef<number | null>(null);
  const count = useRef(0);

  const halt = useCallback(() => {
    if (timer.current === null) return;
    window.clearTimeout(timer.current);
    timer.current = null;
  }, []);

  useEffect(() => halt, [halt]);

  const toggle = useCallback(() => setOpen((current) => !current), []);
  const close = useCallback(() => setOpen(false), []);

  const last = messages[messages.length - 1];
  const answering = last?.state === "thinking" || last?.state === "writing";

  const ask = useCallback(
    (question: string, carried?: { files?: readonly AiAttachment[]; voice?: AiVoice | null }) => {
      const text = question.trim();
      if (!text) return;
      halt();
      count.current += 1;
      const answerId = `resposta-${count.current}`;
      const reply = previewAiReply(text);
      /* Quebrado mantendo os espaços, para o texto remontar exatamente como foi escrito enquanto sai. */
      const pieces = reply.text.split(/(\s+)/);

      setMessages((current) => [
        ...current,
        {
          id: `pergunta-${count.current}`,
          role: "person",
          text,
          ...(carried?.files?.length ? { files: carried.files } : {}),
          ...(carried?.voice ? { voice: carried.voice } : {}),
        },
        { id: answerId, role: "assistant", text: "", state: "thinking", sources: reply.sources, steps: reply.steps },
      ]);

      const write = (at: number) => {
        const done = at >= pieces.length;
        setMessages((current) =>
          current.map((message) =>
            message.id === answerId ? { ...message, text: pieces.slice(0, at).join(""), state: done ? "done" : "writing" } : message,
          ),
        );
        if (done) {
          timer.current = null;
          return;
        }
        timer.current = window.setTimeout(() => write(at + 1), WORD_MS);
      };

      timer.current = window.setTimeout(() => write(1), Math.max(1, reply.steps.length) * AI_STEP_MS);
    },
    [halt],
  );

  /* Interromper deixa na tela o que já saiu, e marca que parou ali: apagar o pedaço escrito seria jogar fora
     o que a pessoa já leu. */
  const stop = useCallback(() => {
    halt();
    setMessages((current) =>
      current.map((message, index) =>
        index === current.length - 1 && (message.state === "thinking" || message.state === "writing")
          ? { ...message, state: "stopped" }
          : message,
      ),
    );
  }, [halt]);

  /* A conversa de agora virando item do histórico. Fora dos atualizadores de estado de propósito: um
     atualizador precisa ser puro, e chamar outro `set` de dentro dele arquivaria duas vezes na checagem
     dupla do React. */
  const archive = useCallback(
    (kept: readonly AiConversation[]) => {
      if (messages.length === 0) return kept;
      count.current += 1;
      return [{ id: `conversa-${count.current}`, title: aiTitle(messages), messages }, ...kept];
    },
    [messages],
  );

  /* Começar de novo guarda a conversa de agora em vez de jogá-la fora: a pessoa clica em "nova conversa"
     para tirar a de agora da frente, e não para perder o que já perguntou. */
  const reset = useCallback(() => {
    halt();
    setHistory(archive);
    setMessages([]);
    setDraft("");
  }, [halt, archive]);

  /* Voltar a uma conversa guardada troca de lugar com a de agora: a de agora vai para o histórico e a
     escolhida sai dele, então nenhuma das duas some. */
  const resume = useCallback(
    (id: string) => {
      const found = history.find((conversation) => conversation.id === id);
      if (!found) return;
      halt();
      setHistory((kept) => archive(kept.filter((conversation) => conversation.id !== id)));
      setMessages(found.messages);
      setDraft("");
    },
    [halt, archive, history],
  );

  const value = useMemo<AiPanelContextValue>(
    () => ({ data: data ?? null, open, toggle, close, draft, setDraft, messages, answering, ask, stop, reset, history, resume }),
    [data, open, toggle, close, draft, messages, answering, ask, stop, reset, history, resume],
  );

  return <AiPanelContext.Provider value={value}>{children}</AiPanelContext.Provider>;
}

/** Nulo fora da concha: a tela pública e a vitrine não têm assistente, e quem chama lá não desenha o gatilho. */
export function useAiPanel() {
  return useContext(AiPanelContext);
}
