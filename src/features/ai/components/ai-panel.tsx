"use client";

import {
  ArrowsOutSimpleIcon,
  ChartDonutIcon,
  ChatsCircleIcon,
  ClockCounterClockwiseIcon,
  NotePencilIcon,
  XIcon,
} from "@phosphor-icons/react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { navLocation } from "@/components/layout/nav";
import { Dialog } from "@/components/ui/dialog";
import { DropdownMenu, type DropdownSection } from "@/components/ui/dropdown-menu";
import { IconButton } from "@/components/ui/icon-button";
import { Text } from "@/components/ui/text";
import { isTopLayer, useLayer } from "@/hooks/use-layer";
import { MOBILE_QUERY, useMediaQuery } from "@/hooks/use-media-query";
import { usePresence } from "@/hooks/use-presence";
import { firstName } from "../summary";
import { AiComposer } from "./ai-composer";
import { AiMark } from "./ai-mark";
import { useAiPanel } from "./ai-panel-context";
import { AiThread } from "./ai-thread";
import { AiUsageDialog } from "./ai-usage-dialog";
import styles from "./ai-panel.module.css";

/**
 * O assistente como **coluna da concha**, e não como janela por cima: ele entra na grade ao lado do
 * conteúdo e empurra a página, do mesmo jeito que o menu lateral faz do outro lado. É o desenho do Gemini
 * dentro das aplicações do Google, e o motivo é prático: quem pergunta está olhando a tela sobre a qual
 * pergunta, e uma janela em cima esconderia justamente o assunto.
 *
 * Em tela de notebook estreita a coluna deixa de empurrar e passa a flutuar sobre o conteúdo: empurrando,
 * sobrariam duzentos pixels de página, que não servem para ler nada. No celular ela vira a bandeja da casa,
 * com as ações na barra flutuante.
 */
export function AiPanel() {
  const panel = useAiPanel();
  const sheet = useMediaQuery(MOBILE_QUERY);
  const open = panel?.open ?? false;
  const column = open && !sheet;
  const { present, state, onAnimationEnd } = usePresence(column);
  const layer = useLayer(column);
  const close = panel?.close;

  // Escape fecha a coluna, como fecha qualquer camada da casa. A fila de camadas é quem decide: com a
  // janela do uso aberta por dentro, quem responde ao Escape é ela, e a coluna fica.
  useEffect(() => {
    if (!column || !close) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isTopLayer(layer)) close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [column, close, layer]);

  if (!panel) return null;

  if (sheet) {
    return (
      <Dialog open={open} onClose={panel.close} label="SpeculAI" focusOnOpen={false}>
        <AiBody sheet onClose={panel.close} />
      </Dialog>
    );
  }

  if (!present) return null;

  return (
    <aside className={styles.panel} data-state={state} aria-label="SpeculAI" onAnimationEnd={onAnimationEnd}>
      {/* A caixa de dentro tem largura fixa e desliza; quem abre espaço na grade é a coluna de fora, que
          anda na largura. As duas andam no mesmo tempo, então a coluna parece entrar empurrando. */}
      <div className={styles.inner}>
        <AiBody sheet={false} onClose={panel.close} />
      </div>
    </aside>
  );
}

/** O conteúdo do SpeculAI, igual nos dois formatos: cabeçalho, a conversa e o compositor no pé. */
function AiBody({ sheet, onClose }: { sheet: boolean; onClose: () => void }) {
  const panel = useAiPanel();
  const pathname = usePathname();
  const field = useRef<HTMLTextAreaElement>(null);
  const [usageOpen, setUsageOpen] = useState(false);
  const data = panel?.data ?? null;
  const location = navLocation(pathname);
  const messages = panel?.messages ?? [];
  const history = panel?.history ?? [];

  /* As conversas guardadas no menu da casa: a primeira pergunta é o nome de cada uma, e escolher traz ela de
     volta para a coluna, guardando a de agora no lugar dela. */
  const historySections: DropdownSection[] = [
    {
      id: "conversas",
      label: "Conversas anteriores",
      items: history.map((conversation) => ({
        id: conversation.id,
        label: conversation.title,
        icon: ChatsCircleIcon,
        count: conversation.messages.filter((message) => message.role === "person").length,
        onSelect: () => panel?.resume(conversation.id),
      })),
    },
  ];

  return (
    <div className={styles.body}>
      <header className={styles.head}>
        {/* A marca da casa, e não a de quem responde: a conversa é da Specular, e o motor por trás dela é
            assunto da janela de uso, onde o plano é o que está em jogo. */}
        <AiMark size={20} />
        <Text as="h2" variant="subheadline" weight="semibold" truncate className={styles.name}>
          SpeculAI
        </Text>
        <span className={styles.headEnd}>
          {history.length > 0 && (
            <DropdownMenu
              label="Conversas anteriores"
              triggerLabel="Ver conversas anteriores"
              sections={historySections}
              icon={<ClockCounterClockwiseIcon />}
              size="sm"
            />
          )}
          {messages.length > 0 && (
            <IconButton label="Começar uma conversa nova" variant="ghost" size="sm" onClick={() => panel?.reset()}>
              <NotePencilIcon />
            </IconButton>
          )}
          {/* O caminho para a página cheia, que é esta mesma conversa com espaço para a trilha de conversas
              e para escolher o que a IA lê. Fecha a coluna ao sair, porque as duas abertas ao mesmo tempo
              seriam o mesmo assistente duas vezes na tela. */}
          <IconButton label="Abrir o SpeculAI em tela cheia" variant="ghost" size="sm" href="/ia" onClick={onClose}>
            <ArrowsOutSimpleIcon />
          </IconButton>
          {/* O resumo do ciclo virou atalho daqui de dentro (a pedido): o widget do topo agora abre a
              coluna, e a IA inteira passa a morar num lugar só. */}
          {data && (
            <IconButton label="Uso da IA neste ciclo" variant="ghost" size="sm" onClick={() => setUsageOpen(true)}>
              <ChartDonutIcon />
            </IconButton>
          )}
          <IconButton label="Fechar o SpeculAI" variant="ghost" size="sm" onClick={onClose}>
            <XIcon />
          </IconButton>
        </span>
      </header>

      {/* A conversa cresce de baixo para cima, encostada no compositor; sem conversa nenhuma, a saudação
          fica no meio, que é onde mora tela de abertura. */}
      <div className={styles.scroller}>
        {messages.length > 0 ? (
          <AiThread messages={messages} onRetry={(question) => panel?.ask(question)} />
        ) : (
          <div className={styles.empty}>
            <AiMark size={34} className={styles.greetingMark} />
            <Text as="p" variant="title2" weight="semibold" font="display" className={styles.greeting}>
              Pode falar{data ? ", " + firstName(data.viewer) : ""}
            </Text>
            <Text as="p" variant="footnote" tone="secondary" className={styles.greetingLine}>
              Eu leio o que está na sua conta: orçamentos, clientes, projetos e tarefas.
            </Text>
          </div>
        )}
      </div>

      <AiComposer
        value={panel?.draft ?? ""}
        onChange={(value) => panel?.setDraft(value)}
        onSend={(question, carried) => panel?.ask(question, carried)}
        onStop={() => panel?.stop()}
        answering={panel?.answering ?? false}
        sheet={sheet}
        onClose={onClose}
        context={
          location?.page
            ? {
                /* A rota do menu por extenso ("Área de trabalho/Projetos"), e não só o nome da página (a
                   pedido, 2026-09-14): é ela que diz onde a pessoa está, e é o mesmo caminho que o topo da
                   página mostra do outro lado. */
                trail: [location.group.label, ...(location.folder ? [location.folder.label] : []), location.page.label].join("/"),
                icon: location.page.icon,
              }
            : undefined
        }
        usage={data?.usage}
        fieldRef={field}
      />

      {data && <AiUsageDialog usage={data.usage} open={usageOpen} onClose={() => setUsageOpen(false)} />}
    </div>
  );
}

