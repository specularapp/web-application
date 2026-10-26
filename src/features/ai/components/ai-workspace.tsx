"use client";

import {
  ArrowUpRightIcon,
  CurrencyCircleDollarIcon,
  FunnelIcon,
  ListChecksIcon,
  NotePencilIcon,
  ReceiptIcon,
  SidebarSimpleIcon,
  type Icon,
} from "@phosphor-icons/react";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Dialog } from "@/components/ui/dialog";
import { IconButton } from "@/components/ui/icon-button";
import { Text } from "@/components/ui/text";
import { Tooltip } from "@/components/ui/tooltip";
import { VisuallyHidden } from "@/components/ui/visually-hidden";
import { useMediaQuery } from "@/hooks/use-media-query";
import { rounded } from "@/lib/corners";
import { aiStarters, type AiStarterId } from "../starters";
import { firstName } from "../summary";
import { AiComposer } from "./ai-composer";
import { AiHistory } from "./ai-history";
import { AiMark } from "./ai-mark";
import { useAiPanel } from "./ai-panel-context";
import { AiThread } from "./ai-thread";
import styles from "./ai-workspace.module.css";

/* Abaixo disto o histórico sai do fluxo e vira gaveta: com o menu de 16rem e a coluna de 16.5, sobraria pouco
   para a conversa. */
const RAIL_QUERY = "(max-width: 63.9375rem)";

const starterLook: Record<AiStarterId, { icon: Icon; hue: string }> = {
  funil: { icon: FunnelIcon, hue: "var(--sys-blue)" },
  orcamentos: { icon: ReceiptIcon, hue: "var(--sys-teal)" },
  cobrancas: { icon: CurrencyCircleDollarIcon, hue: "var(--sys-green)" },
  prazos: { icon: ListChecksIcon, hue: "var(--sys-orange)" },
};

/**
 * O SpeculAI em tela cheia. À esquerda o histórico, numa coluna que recolhe (ou numa gaveta em tela estreita);
 * à direita a conversa, em duas telas no mesmo componente: a de abertura, com a marca viva, a saudação, o
 * compositor e os começos de conversa no meio, e a da conversa, com as mensagens rolando e o compositor preso
 * no pé. O compositor é o mesmo elemento nas duas, para o foco e o que já foi escrito sobreviverem à primeira
 * pergunta. Atrás da conversa, o brilho nas quinas nas cores da marca.
 *
 * É a mesma conversa da coluna lateral, no mesmo provedor da concha.
 */
export function AiWorkspace() {
  const panel = useAiPanel();
  const compact = useMediaQuery(RAIL_QUERY);
  const [railOpen, setRailOpen] = useState(true);
  const [drawer, setDrawer] = useState(false);
  /* As fixadas valem nesta sessão: o banco ainda não guarda a marca, e a casa não guarda conteúdo no navegador. */
  const [pinned, setPinned] = useState<readonly string[]>([]);
  const field = useRef<HTMLTextAreaElement>(null);
  const close = panel?.close;
  const loadHistory = panel?.loadHistory;

  useEffect(() => {
    loadHistory?.();
  }, [loadHistory]);

  /* Entrar aqui fecha a coluna lateral: são o mesmo assistente, e os dois abertos seriam a mesma coisa duas
     vezes na tela. */
  useEffect(() => {
    close?.();
  }, [close]);

  if (!panel) return null;

  const data = panel.data;
  const messages = panel.messages;
  const empty = messages.length === 0;
  const current = panel.conversations.find((conversation) => conversation.id === panel.currentId);
  const greetingName = data ? firstName(data.viewer) : "";
  const showRail = !compact && railOpen;

  const togglePin = (id: string) =>
    setPinned((list) => (list.includes(id) ? list.filter((entry) => entry !== id) : [id, ...list]));

  const showHistory = () => (compact ? setDrawer(true) : setRailOpen(true));

  const startNew = () => {
    panel.reset();
    field.current?.focus();
  };

  const suggest = (prompt: string) => {
    panel.setDraft(prompt);
    field.current?.focus();
  };

  return (
    <div className={styles.workspace} data-history={showRail ? "open" : "closed"}>
      {!compact && (
        <div className={styles.rail} inert={!railOpen || undefined}>
          <aside className={styles.railInner} aria-label="Histórico de conversas">
            <AiHistory
              hideLabel="Recolher o histórico"
              onHide={() => setRailOpen(false)}
              onPick={() => field.current?.focus()}
              pinned={pinned}
              onTogglePin={togglePin}
            />
          </aside>
        </div>
      )}

      <div className={styles.main} data-view={empty ? "empty" : "chat"}>
        <div className={styles.glow} aria-hidden="true" />

        <div className={styles.top}>
          {!showRail && (
            <span className={styles.topTools}>
              <Tooltip content="Mostrar o histórico" align="start">
                <IconButton label="Mostrar o histórico" variant="ghost" size="sm" radius="md" onClick={showHistory}>
                  <SidebarSimpleIcon />
                </IconButton>
              </Tooltip>
              <Tooltip content="Nova conversa">
                <IconButton label="Nova conversa" variant="ghost" size="sm" radius="md" disabled={empty} onClick={startNew}>
                  <NotePencilIcon />
                </IconButton>
              </Tooltip>
            </span>
          )}
          {!empty && (
            <Text as="p" variant="footnote" weight="medium" tone="secondary" truncate className={styles.topTitle}>
              {current?.title ?? "Conversa nova"}
            </Text>
          )}
        </div>

        <div className={styles.scroller} data-ai-scroller="">
          <div className={styles.stage}>
            {empty ? (
              <div className={styles.hero}>
                <span className={styles.aura} aria-hidden="true">
                  <AiMark size={56} motion="idle" />
                </span>
                <Text as="h1" variant="largeTitle" weight="regular" font="display" align="center" className={styles.greeting}>
                  Em que posso ajudar{greetingName ? `, ${greetingName}` : ""}?
                </Text>
                <Text as="p" variant="callout" tone="secondary" align="center" className={styles.lead}>
                  Eu leio a sua conta para responder: funil, orçamentos, contratos, clientes, projetos e tarefas.
                </Text>
              </div>
            ) : (
              <>
                <VisuallyHidden as="h1">{current?.title ?? "Conversa com o SpeculAI"}</VisuallyHidden>
                <AiThread messages={messages} onRetry={(question) => panel.ask(question)} onFollowUp={(prompt) => panel.ask(prompt)} />
              </>
            )}
          </div>

          <div className={styles.dock}>
            <AiComposer
              value={panel.draft}
              onChange={panel.setDraft}
              onSend={(question, carried) => panel.ask(question, carried)}
              onStop={panel.stop}
              answering={panel.answering}
              sheet={false}
              onClose={panel.close}
              scope={{ chosen: panel.scope, onChange: panel.setScope }}
              usage={data?.usage}
              fieldRef={field}
            />

            {empty && (
              <ul className={styles.starters} aria-label="Ideias para começar">
                {aiStarters.map((starter) => {
                  const { icon: Glyph, hue } = starterLook[starter.id];
                  return (
                    <li key={starter.id}>
                      <button type="button" className={styles.starter} onClick={() => suggest(starter.prompt)} {...rounded("xl")}>
                        <span className={styles.starterGlyph} style={{ "--starter-hue": hue } as CSSProperties} {...rounded("md")}>
                          <Glyph weight="duotone" aria-hidden="true" />
                        </span>
                        <span className={styles.starterText}>
                          <Text as="span" variant="footnote" weight="medium">
                            {starter.label}
                          </Text>
                          <Text as="span" variant="caption1" tone="secondary">
                            {starter.description}
                          </Text>
                        </span>
                        <ArrowUpRightIcon aria-hidden="true" className={styles.starterArrow} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>

      {compact && (
        <Dialog open={drawer} onClose={() => setDrawer(false)} label="Histórico de conversas" size="sm" placement="end" surface="page">
          <div className={styles.drawer}>
            <AiHistory
              hideLabel="Fechar o histórico"
              onHide={() => setDrawer(false)}
              onPick={() => setDrawer(false)}
              pinned={pinned}
              onTogglePin={togglePin}
            />
          </div>
        </Dialog>
      )}
    </div>
  );
}
