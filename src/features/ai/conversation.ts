import type { AiAttachment, AiVoice } from "./summary";

/** Quem falou: a pessoa ou o assistente. */
export type AiRole = "person" | "assistant";

/** Um registro da conta que a resposta leu, para dar para conferir de onde saiu o que ela diz. */
export type AiSource = { id: string; label: string };

/**
 * O andar de uma resposta. `thinking` é antes de a primeira palavra sair, `writing` enquanto ela sai,
 * `stopped` quando a pessoa interrompeu no meio. A pergunta da pessoa não tem andar nenhum: ela nasce pronta.
 */
export type AiAnswerState = "thinking" | "writing" | "done" | "stopped";

export type AiMessage = {
  id: string;
  role: AiRole;
  text: string;
  /** O que foi junto da pergunta e **fica** nela: o anexo some do compositor ao enviar, mas não da conversa,
   *  senão não dá para saber depois sobre o que a resposta falava. */
  files?: readonly AiAttachment[];
  voice?: AiVoice;
  /** Os registros lidos, quando a resposta buscou na conta. */
  sources?: readonly AiSource[];
  /** O que ela está fazendo antes da primeira palavra sair, um passo por vez. */
  steps?: readonly string[];
  state?: AiAnswerState;
};

/** Uma conversa fechada, guardada para a pessoa poder voltar nela. */
export type AiConversation = {
  id: string;
  /** A primeira pergunta, que é como uma conversa se chama em toda aplicação de assistente. */
  title: string;
  messages: readonly AiMessage[];
};

/** O nome de uma conversa pela primeira coisa que foi perguntada nela. */
export function aiTitle(messages: readonly AiMessage[]) {
  const first = messages.find((message) => message.role === "person");
  return first?.text.trim() || "Conversa sem pergunta";
}

/** O que uma resposta simulada devolve enquanto não existe modelo do outro lado. */
export type AiReply = { text: string; sources: readonly AiSource[]; steps: readonly string[] };

/**
 * O texto de uma resposta em blocos, para a tela desenhar parágrafo e lista em vez de um bloco cru. É o
 * mínimo de marcação que uma resposta precisa: linha começando em `- ` vira item de lista, `**assim**` vira
 * negrito, e o resto é parágrafo. Biblioteca de markdown inteira não entra por causa disso.
 */
export type AiBlock = { kind: "paragraph"; text: string } | { kind: "list"; items: string[] };

export function aiBlocks(text: string): AiBlock[] {
  return text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const lines = block.split("\n").map((line) => line.trim());
      if (lines.every((line) => line.startsWith("- "))) {
        return { kind: "list" as const, items: lines.map((line) => line.slice(2)) };
      }
      return { kind: "paragraph" as const, text: lines.join(" ") };
    });
}

/** Os pedaços de uma linha separando o que é negrito do que não é, na ordem em que aparecem. */
export function aiSpans(text: string) {
  return text
    .split(/(\*\*[^*]+\*\*)/g)
    .filter(Boolean)
    .map((piece) =>
      piece.startsWith("**") && piece.endsWith("**")
        ? { strong: true, text: piece.slice(2, -2) }
        : { strong: false, text: piece },
    );
}

/** Um pedaço da resposta: uma palavra, com o negrito que ela herda do trecho de onde saiu, ou o espaço
 *  entre duas. O espaço vem na lista, e não recolocado na hora de desenhar: o trecho em negrito acaba
 *  colado no que vem depois (`**Aurora**: parado`), e devolver espaço a cada palavra separava os dois. */
export type AiWord = { text: string; strong: boolean; space: boolean };

/**
 * A linha quebrada em palavras, cada uma sabendo se está em negrito. É o que deixa a resposta **surgir
 * palavra por palavra**: cada palavra é um elemento próprio, então a que chega agora anima a entrada e as
 * que já estavam na tela não se mexem.
 */
export function aiWords(text: string): AiWord[] {
  return aiSpans(text).flatMap((span) =>
    span.text
      .split(/(\s+)/)
      .filter(Boolean)
      .map((piece) => ({ text: piece, strong: span.strong, space: /^\s+$/.test(piece) })),
  );
}

/** Quanto cada passo do pensamento fica na tela antes de dar lugar ao seguinte. O provedor usa isto para
 *  saber quanto o pensar inteiro dura, e a conversa, para trocar o passo no mesmo compasso. */
export const AI_STEP_MS = 700;
