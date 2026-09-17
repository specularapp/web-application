"use client";

import { ClockCounterClockwiseIcon, NotePencilIcon, XIcon } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { IconButton } from "@/components/ui/icon-button";
import { Text } from "@/components/ui/text";
import { VisuallyHidden } from "@/components/ui/visually-hidden";
import { useMediaQuery } from "@/hooks/use-media-query";
import { firstName } from "../summary";
import { AiComposer } from "./ai-composer";
import { AiHistory } from "./ai-history";
import { AiMark } from "./ai-mark";
import { useAiPanel } from "./ai-panel-context";
import { AiThread } from "./ai-thread";
import styles from "./ai-workspace.module.css";

/* Abaixo disto a trilha de conversas sai do fluxo e vira gaveta. É o mesmo corte em que a coluna lateral
   deixa de empurrar a página: com o menu de 16rem e a trilha de 17rem, sobrariam menos de trezentos pixels
   para a conversa, que é o que a pessoa veio ler. */
const RAIL_QUERY = "(max-width: 63.9375rem)";

/**
 * O SpeculAI em tela cheia. É a mesma conversa da coluna lateral, no mesmo provedor, com o espaço que a
 * coluna não tem: a trilha de conversas à vista o tempo todo, com busca, renomear e excluir, e a escolha do
 * que o assistente pode ler ao lado do modo de resposta.
 *
 * A conversa fica numa coluna de leitura no meio, e não esticada de ponta a ponta: linha de texto larga
 * demais faz o olho perder a linha seguinte, e numa tela de 1600px a resposta viraria uma faixa de cento e
 * poucos caracteres por linha.
 *
 * **Sem o topo da aplicação** (a pedido, 2026-09-15): a rota e o nome da página no alto servem a tela que é
 * lista ou cadastro, e aqui a tela é a conversa inteira. Como toda página precisa de um `h1`, ele fica só
 * na voz: o nome do assistente, lido por quem navega por leitor de tela e invisível para quem enxerga.
 */
export function AiWorkspace() {
  const panel = useAiPanel();

  const compact = useMediaQuery(RAIL_QUERY);
  const [railOpen, setRailOpen] = useState(false);
  const field = useRef<HTMLTextAreaElement>(null);
  const close = panel?.close;
  const loadHistory = panel?.loadHistory;

  /* A página cheia é a coluna sempre aberta: o histórico que a coluna busca ao abrir, ela busca ao montar. */
  useEffect(() => {
    loadHistory?.();
  }, [loadHistory]);

  /* Entrar aqui fecha a coluna lateral: são o mesmo assistente e a mesma conversa, e os dois abertos ao
     mesmo tempo seriam a mesma coisa duas vezes na tela, uma delas espremida. */
  useEffect(() => {
    close?.();
  }, [close]);

  if (!panel) return null;

  const data = panel.data;
  const messages = panel.messages;
  const current = panel.conversations.find((conversation) => conversation.id === panel.currentId);

  return (
    <div className={styles.workspace}>
      <VisuallyHidden as="h1">SpeculAI</VisuallyHidden>

      {!compact && (
        <aside className={styles.rail} aria-label="Conversas com o SpeculAI">
          <AiHistory />
        </aside>
      )}

      <div className={styles.main}>
        {/* Sem a trilha à vista, o que abre as conversas e começa uma nova vem para cá, com o nome da que
            está aberta no meio: sem ele não há como saber em qual conversa se está. */}
        {compact && (
          <div className={styles.bar}>
            <IconButton label="Ver as conversas" variant="ghost" size="sm" onClick={() => setRailOpen(true)}>
              <ClockCounterClockwiseIcon />
            </IconButton>
            <Text as="p" variant="footnote" tone="secondary" truncate className={styles.barName}>
              {current?.title ?? "Conversa nova"}
            </Text>
            <IconButton label="Começar uma conversa nova" variant="ghost" size="sm" onClick={() => panel.reset()}>
              <NotePencilIcon />
            </IconButton>
          </div>
        )}

        <div className={styles.scroller}>
          <div className={styles.column}>
            {messages.length > 0 ? (
              <AiThread messages={messages} onRetry={(question) => panel.ask(question)} />
            ) : (
              <div className={styles.empty}>
                <AiMark size={44} className={styles.greetingMark} />
                <Text as="p" variant="title1" weight="semibold" font="display" className={styles.greeting}>
                  Pode falar{data ? ", " + firstName(data.viewer) : ""}
                </Text>
                <Text as="p" variant="callout" tone="secondary" className={styles.greetingLine}>
                  Eu leio o que está na sua conta para responder: funil, orçamentos, contratos, clientes, projetos e tarefas.
                </Text>
              </div>
            )}
          </div>
        </div>

        <div className={styles.foot}>
          <div className={styles.column}>
            <AiComposer
              value={panel.draft}
              onChange={panel.setDraft}
              onSend={(question, carried) => panel.ask(question, carried)}
              onStop={panel.stop}
              answering={panel.answering}
              /* Nunca em modo bandeja: aqui não há barra flutuante para onde mandar o clipe e o enviar, e o
                 compositor fica inteiro no cartão em qualquer largura. */
              sheet={false}
              onClose={panel.close}
              scope={{ chosen: panel.scope, onChange: panel.setScope }}
              usage={data?.usage}
              fieldRef={field}
            />
          </div>
        </div>
      </div>

      {compact && (
        <Dialog open={railOpen} onClose={() => setRailOpen(false)} label="Conversas com o SpeculAI" size="sm" placement="end" surface="page">
          <div className={styles.drawer}>
            <header className={styles.drawerHead}>
              <Text as="h2" variant="subheadline" weight="semibold">
                Conversas
              </Text>
              <IconButton label="Fechar as conversas" variant="ghost" size="sm" onClick={() => setRailOpen(false)}>
                <XIcon />
              </IconButton>
            </header>
            <AiHistory onPick={() => setRailOpen(false)} />
          </div>
        </Dialog>
      )}
    </div>
  );
}
