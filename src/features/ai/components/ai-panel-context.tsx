"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AI_STEP_MS, type AiConversation, type AiMessage } from "../conversation";
import { askAiAction, deleteConversationAction, loadConversationsAction, renameConversationAction } from "../actions";
import { defaultAiScope, type AiScopeId } from "../scope";
import type { AiAttachment, AiUsage, AiVoice } from "../summary";

/** O que o assistente precisa saber para abrir: quanto do ciclo já foi, com quem ele fala e o que já foi
 *  conversado antes. */
export type AiPanelData = {
  usage: AiUsage;
  /** Nome de quem está na conta, para a saudação do vazio. */
  viewer: string;
  /** As conversas guardadas. Chegam na primeira abertura da coluna, e não com a concha: são conteúdo longo
   *  e a coluna começa fechada. */
  conversations?: readonly AiConversation[];
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
  /** Tudo que já foi conversado, da mais recente para a mais antiga. */
  conversations: readonly AiConversation[];
  /** Em qual delas se está; nulo é a conversa nova, que só nasce na primeira pergunta. */
  currentId: string | null;
  messages: readonly AiMessage[];
  /** Verdadeiro entre a pergunta sair e a resposta terminar, **nesta** conversa. */
  answering: boolean;
  /** Manda a pergunta com o que ela leva junto. O anexo fica **na mensagem**, e não no compositor. */
  ask: (question: string, carried?: { files?: readonly AiAttachment[]; voice?: AiVoice | null }) => void;
  stop: () => void;
  /** Abre uma conversa vazia, sem jogar fora a de agora, que já está na lista. */
  reset: () => void;
  /** Volta para uma conversa guardada. */
  resume: (id: string) => void;
  remove: (id: string) => void;
  rename: (id: string, title: string) => void;
  /** As guardadas que não são a de agora, para o leque de conversas da coluna. */
  history: readonly AiConversation[];
  /** Pede o histórico, se ainda não pediu. A coluna chama ao abrir; a página cheia, ao montar. */
  loadHistory: () => void;
  /** O que o assistente pode ler para responder. */
  scope: readonly AiScopeId[];
  setScope: (scope: readonly AiScopeId[]) => void;
};

const AiPanelContext = createContext<AiPanelContextValue | null>(null);

/* O tempo entre uma palavra e a seguinte. Quinze milissegundos, e não trinta e quatro (acerto de
   2026-09-14, a pedido): a resposta é longa, e no ritmo anterior ela levava mais de dez segundos para sair
   inteira, o que é tempo de esperar, não de ler. A entrada de cada palavra encurtou junto, na folha.
   O pensar antes dela sai da contagem dos passos: cada passo fica na tela o seu tempo, e a primeira palavra
   só começa quando o último passo acaba. Essa pausa não é enfeite: é ela que separa "recebi a pergunta" de
   "estou respondendo", e sem ela a resposta aparece de um golpe e a conversa lê como um script. */
const WORD_MS = 15;

/* A conversa nova, antes da primeira pergunta. Constante do módulo para a identidade não mudar a cada
   desenho e quem depende dela não se achar diferente de si mesmo. */
const noMessages: readonly AiMessage[] = [];

/* O que fica na tela enquanto a resposta não chega. Os passos de verdade vêm com ela, dizendo o que foi
   lido; estes são o primeiro, para a espera não ser uma tela parada. */
const THINKING_STEPS = ["Lendo a sua conta"] as const;

const NETWORK_ERROR = "Não consegui falar com o assistente agora. Tente de novo em instantes.";

/**
 * Quem sabe o que já foi conversado com o assistente, e se a coluna dele está aberta. Mora na concha, acima
 * da grade, e serve os **dois** lugares em que ele aparece: a coluna que abre ao lado da página e a página
 * inteira em `/ia`. É por morar aqui que perguntar na coluna e depois abrir a página cheia continua a mesma
 * conversa, em vez de duas listas que não se conhecem.
 *
 * A resposta vem do servidor, por `askAiAction`, que lê a conta de quem pergunta e fala com o modelo. Ela
 * **sai palavra por palavra** aqui, e não em fluxo do servidor: o texto chega inteiro e a tela o escreve no
 * ritmo de leitura, que é o que separa "recebi a pergunta" de "estou respondendo". Enquanto a resposta não
 * chega, o que está na tela são os passos do pensamento.
 */
export function AiPanelProvider({ data, children }: { data?: AiPanelData; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  /* As conversas vivem na memória desta sessão, e não em cookie nem em Web Storage: conversa é conteúdo, e a
     casa só guarda preferência de tela em cookie. Elas passam a vir do banco quando a IA existir lá. */
  const [conversations, setConversations] = useState<readonly AiConversation[]>(data?.conversations ?? []);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [scope, setScope] = useState<readonly AiScopeId[]>(defaultAiScope);
  const timer = useRef<number | null>(null);
  const count = useRef(0);
  /* Qual resposta está sendo escrita agora. Num id, e não "a última da conversa de agora": trocar de
     conversa no meio não interrompe o que já estava saindo, e ele precisa continuar achando onde escrever. */
  const writing = useRef<string | null>(null);

  const halt = useCallback(() => {
    if (timer.current === null) return;
    window.clearTimeout(timer.current);
    timer.current = null;
  }, []);

  useEffect(() => halt, [halt]);

  /* A primeira abertura busca o histórico; as seguintes não. A referência é o que separa "ainda não pedi"
     de "pedi e não tinha nada", que com uma lista vazia seriam a mesma coisa e pediriam de novo a cada
     abertura. */
  const asked = useRef(false);
  const loadHistory = useCallback(() => {
    if (asked.current) return;
    asked.current = true;
    void loadConversationsAction()
      .then((loaded) => {
        if (loaded.length > 0) setConversations((current) => (current.length > 0 ? current : loaded));
      })
      .catch(() => undefined);
  }, []);

  const toggle = useCallback(() => {
    setOpen((current) => {
      if (!current) loadHistory();
      return !current;
    });
  }, [loadHistory]);
  const close = useCallback(() => setOpen(false), []);

  const chosen = conversations.find((conversation) => conversation.id === currentId) ?? null;
  const messages = chosen?.messages ?? noMessages;
  const last = messages[messages.length - 1];
  const answering = last?.state === "thinking" || last?.state === "writing";

  const ask = useCallback(
    (question: string, carried?: { files?: readonly AiAttachment[]; voice?: AiVoice | null }) => {
      const text = question.trim();
      if (!text) return;
      halt();
      count.current += 1;
      const answerId = `resposta-${count.current}`;
      /* A conversa nova ainda não existe no banco: ela nasce com um id local, e a action devolve o id de
         verdade, que substitui este assim que a resposta chega. */
      const askedId = currentId ?? `conversa-${count.current}`;
      const at = new Date().toISOString();
      writing.current = answerId;

      const person: AiMessage = {
        id: `pergunta-${count.current}`,
        role: "person",
        text,
        ...(carried?.files?.length ? { files: carried.files } : {}),
        ...(carried?.voice ? { voice: carried.voice } : {}),
      };
      const answer: AiMessage = { id: answerId, role: "assistant", text: "", state: "thinking", steps: THINKING_STEPS };

      /* A conversa em que se perguntou vai para o topo da lista: recência é o que ordena o histórico, e
         responder numa conversa velha a traz de volta para o presente. */
      const history = (conversations.find((conversation) => conversation.id === askedId)?.messages ?? []).map((message) => ({
        role: message.role,
        text: message.text,
      }));

      setConversations((all) => {
        const found = all.find((conversation) => conversation.id === askedId);
        const asked: AiConversation = found
          ? { ...found, updatedAt: at, messages: [...found.messages, person, answer] }
          : { id: askedId, title: text, updatedAt: at, messages: [person, answer] };
        return [asked, ...all.filter((conversation) => conversation.id !== askedId)];
      });
      setCurrentId(askedId);

      const patch = (id: string, change: (message: AiMessage) => AiMessage) =>
        setConversations((all) =>
          all.map((conversation) =>
            conversation.messages.some((message) => message.id === id)
              ? { ...conversation, messages: conversation.messages.map((message) => (message.id === id ? change(message) : message)) }
              : conversation,
          ),
        );

      const write = (pieces: string[], index: number) => {
        const done = index >= pieces.length;
        patch(answerId, (message) => ({ ...message, text: pieces.slice(0, index).join(""), state: done ? "done" : "writing" }));
        if (done) {
          timer.current = null;
          writing.current = null;
          return;
        }
        timer.current = window.setTimeout(() => write(pieces, index + 1), WORD_MS);
      };

      void askAiAction({ question: text, scope, conversationId: null, history })
        .then((result) => {
          /* Quem interrompeu no meio não recebe a resposta que chegou depois: a tela já disse que parou. */
          if (writing.current !== answerId) return;

          if (!result.ok) {
            patch(answerId, (message) => ({ ...message, text: result.error, state: "done", steps: undefined }));
            writing.current = null;
            return;
          }

          /* O id de verdade só chega agora: a conversa local vira a do banco, para a próxima pergunta cair
             nela em vez de abrir outra. */
          setConversations((all) =>
            all.map((conversation) =>
              conversation.id === askedId ? { ...conversation, id: result.conversationId } : conversation,
            ),
          );
          setCurrentId((current) => (current === askedId ? result.conversationId : current));

          patch(answerId, (message) => ({ ...message, sources: result.reply.sources, steps: result.reply.steps }));

          /* Quebrado mantendo os espaços, para o texto remontar exatamente como foi escrito enquanto sai. */
          const pieces = result.reply.text.split(/(\s+)/);
          timer.current = window.setTimeout(() => write(pieces, 1), Math.max(1, result.reply.steps.length) * AI_STEP_MS);
        })
        .catch(() => {
          if (writing.current !== answerId) return;
          patch(answerId, (message) => ({ ...message, text: NETWORK_ERROR, state: "done", steps: undefined }));
          writing.current = null;
        });
    },
    [halt, currentId, conversations, scope],
  );

  /* Interromper deixa na tela o que já saiu, e marca que parou ali: apagar o pedaço escrito seria jogar fora
     o que a pessoa já leu. */
  const stop = useCallback(() => {
    halt();
    const answerId = writing.current;
    writing.current = null;
    if (!answerId) return;
    setConversations((all) =>
      all.map((conversation) => ({
        ...conversation,
        messages: conversation.messages.map((message) =>
          message.id === answerId && (message.state === "thinking" || message.state === "writing")
            ? { ...message, state: "stopped" }
            : message,
        ),
      })),
    );
  }, [halt]);

  /* Começar de novo é só deixar de estar numa conversa: a de agora já está na lista, então nada é guardado
     nem jogado fora aqui. A resposta que estava saindo **continua saindo** na conversa dela, como em
     qualquer assistente: quem abre uma conversa nova não pediu para cancelar a anterior. */
  const reset = useCallback(() => {
    setCurrentId(null);
    setDraft("");
  }, []);

  const resume = useCallback((id: string) => {
    setCurrentId(id);
    setDraft("");
  }, []);

  /* Some da tela na hora e some do banco em seguida: esperar a ida ao servidor para tirar da lista faria o
     clique parecer que não pegou. A conversa que ainda não foi gravada não existe lá, e o erro é ignorado. */
  const remove = useCallback((id: string) => {
    setConversations((all) => all.filter((conversation) => conversation.id !== id));
    setCurrentId((current) => (current === id ? null : current));
    void deleteConversationAction(id).catch(() => undefined);
  }, []);

  const rename = useCallback((id: string, title: string) => {
    const clean = title.trim();
    if (!clean) return;
    void renameConversationAction({ id, title: clean }).catch(() => undefined);
    setConversations((all) =>
      all.map((conversation) => (conversation.id === id ? { ...conversation, title: clean } : conversation)),
    );
  }, []);

  const history = useMemo(
    () => conversations.filter((conversation) => conversation.id !== currentId),
    [conversations, currentId],
  );

  const value = useMemo<AiPanelContextValue>(
    () => ({
      data: data ?? null,
      open,
      toggle,
      close,
      draft,
      setDraft,
      conversations,
      currentId,
      messages,
      answering,
      ask,
      stop,
      reset,
      resume,
      remove,
      rename,
      history,
      loadHistory,
      scope,
      setScope,
    }),
    [
      data,
      open,
      toggle,
      close,
      draft,
      conversations,
      currentId,
      messages,
      answering,
      ask,
      stop,
      reset,
      resume,
      remove,
      rename,
      history,
      loadHistory,
      scope,
    ],
  );

  return <AiPanelContext.Provider value={value}>{children}</AiPanelContext.Provider>;
}

/** Nulo fora da concha: a tela pública e a vitrine não têm assistente, e quem chama lá não desenha o gatilho. */
export function useAiPanel() {
  return useContext(AiPanelContext);
}
