"use client";

import { ArrowClockwiseIcon, PaperPlaneRightIcon, ProhibitIcon } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { useFloatingActionsRegistration } from "@/components/layout/floating-actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { MOBILE_QUERY, useMediaQuery } from "@/hooks/use-media-query";
import { flowActions, flowChannels, flowTriggers, followEdge } from "../flow-catalog";
import type { FlowButton, FlowChannel, FlowEdge, FlowStep } from "../types";
import { delayLabel } from "./flow-step-node";
import styles from "./flow-preview.module.css";

const sample: Record<string, string> = {
  primeiro_nome: "Camila",
  empresa: "Estúdio Aurora",
  servico: "Site institucional",
  link_portfolio: "estudiolinha.com.br/portfolio",
  link_agenda: "estudiolinha.com.br/agenda",
};

const fill = (text: string) => text.replace(/\{\{(\w+)\}\}/g, (_, key: string) => sample[key] ?? key);

type Line = { id: number; from: "bot" | "user" | "system"; text: string };
type Waiting = { step: FlowStep; buttons: FlowButton[]; reply: boolean } | null;
type Run = { lines: Line[]; waiting: Waiting; next: number };

const LOOP_GUARD = 40;

/** Anda pelo fluxo a partir de um passo até precisar da pessoa (botão ou resposta) ou até acabar. */
function walk(steps: FlowStep[], edges: FlowEdge[], startId: string | undefined, firstId: number, flowName: (id: string) => string): Run {
  const lines: Line[] = [];
  let next = firstId;
  const push = (from: Line["from"], text: string) => lines.push({ id: (next += 1), from, text });
  const stepOf = (id: string | undefined) => (id ? steps.find((step) => step.id === id) : undefined);
  let current = stepOf(startId);
  if (!current) push("system", "Esta saída não leva a nenhum passo");
  for (let guard = 0; current && guard < LOOP_GUARD; guard += 1) {
    const { data } = current;
    let to: string | undefined;
    if (data.kind === "message") {
      data.message.texts.filter((text) => text.trim()).forEach((text) => push("bot", fill(text)));
      if (data.message.buttons.length > 0 || data.message.waitReply) return { lines, waiting: { step: current, buttons: data.message.buttons, reply: data.message.waitReply }, next };
      to = followEdge(edges, current.id, "next");
    } else if (data.kind === "input") {
      push("bot", fill(data.question));
      return { lines, waiting: { step: current, buttons: [], reply: true }, next };
    } else if (data.kind === "actions") {
      push("system", data.actions.map((action) => `${flowActions[action.kind].label}${action.value ? `: ${action.value}` : ""}`).join("; "));
      to = followEdge(edges, current.id, "next");
    } else if (data.kind === "delay") {
      push("system", `${delayLabel(current)} (na prévia, segue na hora)`);
      to = followEdge(edges, current.id, "next");
    } else if (data.kind === "condition") {
      push("system", "Condição: na prévia, segue por Sim");
      to = followEdge(edges, current.id, "yes");
    } else if (data.kind === "randomizer") {
      const variant = data.variants[0];
      push("system", `Teste A/B: variante ${variant?.label ?? "A"}`);
      to = variant ? followEdge(edges, current.id, `var:${variant.id}`) : undefined;
    } else if (data.kind === "ai") {
      push("system", `O assistente conduz a conversa: ${data.goal}`);
      to = followEdge(edges, current.id, "done");
    } else if (data.kind === "jump") {
      push("system", data.flowId ? `Segue para “${flowName(data.flowId)}”` : "Falta escolher o fluxo de destino");
      return { lines, waiting: null, next };
    } else {
      to = followEdge(edges, current.id, "next");
    }
    current = stepOf(to);
    if (!current) push("system", "Fim do fluxo");
  }
  return { lines, waiting: null, next };
}

export type FlowPreviewProps = {
  open: boolean;
  steps: FlowStep[];
  edges: FlowEdge[];
  flowName: (id: string) => string;
  onClose: () => void;
};

// A prévia no celular: roda o fluxo como o contato veria, a partir do gatilho. Os botões da mensagem são
// tocáveis e seguem a ligação deles; a espera de resposta abre o campo (e o "não respondeu"); espera, ações,
// condição e teste A/B viram avisos cinzas e seguem na hora. Nada é enviado de verdade.
export function FlowPreview({ open, ...props }: FlowPreviewProps) {
  return (
    <Dialog open={open} onClose={props.onClose} label="Prévia do fluxo" size="sm" surface="solid">
      {open && <PreviewBody {...props} />}
    </Dialog>
  );
}

function PreviewBody({ steps, edges, flowName, onClose }: Omit<FlowPreviewProps, "open">) {
  const mobile = useMediaQuery(MOBILE_QUERY);
  const scroller = useRef<HTMLDivElement>(null);
  const trigger = steps.find((step) => step.data.kind === "trigger");
  const firstTrigger = trigger?.data.kind === "trigger" ? trigger.data.triggers[0] : undefined;
  const channel: FlowChannel = steps.flatMap((step) => (step.data.kind === "message" ? [step.data.message.channel] : []))[0] ?? (firstTrigger ? (flowTriggers[firstTrigger.kind].channel ?? "instagram") : "instagram");

  const start = (): Run => {
    const intro: Line[] = [
      { id: 0, from: "system", text: firstTrigger ? `Gatilho: ${flowTriggers[firstTrigger.kind].label}${firstTrigger.value ? ` (${firstTrigger.value})` : ""}` : "O fluxo ainda não tem gatilho" },
      ...(firstTrigger?.publicReplies.find((reply) => reply.trim()) ? [{ id: -1, from: "system" as const, text: `Resposta pública no comentário: “${firstTrigger.publicReplies.find((reply) => reply.trim())}”` }] : []),
    ];
    const run = trigger ? walk(steps, edges, followEdge(edges, trigger.id, "next"), 1, flowName) : { lines: [], waiting: null, next: 1 };
    return { lines: [...intro, ...run.lines], waiting: run.waiting, next: run.next };
  };

  const [state, setState] = useState<Run>(start);
  const [reply, setReply] = useState("");

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [state.lines]);

  const answer = (text: string, port: string) => {
    if (!state.waiting) return;
    const from = state.waiting.step.id;
    const said: Line = { id: state.next + 1, from: port === "noreply" ? "system" : "user", text };
    const run = walk(steps, edges, followEdge(edges, from, port), state.next + 1, flowName);
    setState((current) => ({ lines: [...current.lines, said, ...run.lines], waiting: run.waiting, next: run.next }));
    setReply("");
  };

  const restart = () => setState(start());

  useFloatingActionsRegistration(
    mobile
      ? {
          primary: { label: "Recomeçar", icon: <ArrowClockwiseIcon weight="bold" />, onClick: restart },
          extras: state.waiting?.reply ? [{ label: "Simular sem resposta", icon: <ProhibitIcon weight="bold" />, onClick: () => answer("O contato não respondeu", "noreply") }] : [],
          cancel: { label: "Fechar", onClick: onClose },
        }
      : null,
  );

  return (
    <div className={styles.preview}>
      <DialogHeader title="Prévia" description={`Como o contato vê no ${flowChannels[channel].label}. Nada é enviado.`} onClose={onClose} />
      <div className={styles.phone} data-channel={channel}>
        <div className={styles.phoneTop}>
          <span className={styles.avatar} aria-hidden="true">
            EL
          </span>
          <span className={styles.who}>
            <strong>{channel === "instagram" ? "@estudiolinha" : "Estúdio Linha"}</strong>
            <small>{channel === "instagram" ? "Instagram, direct" : channel === "whatsapp" ? "Conta comercial" : "contato@estudiolinha.com.br"}</small>
          </span>
        </div>
        <div className={styles.chat} ref={scroller} role="log" aria-live="polite" aria-label="Conversa da prévia">
          {state.lines.map((line) => (
            <p key={line.id} className={styles.line} data-from={line.from}>
              {line.text}
            </p>
          ))}
          {state.waiting && state.waiting.buttons.length > 0 && (
            <div className={styles.choices}>
              {state.waiting.buttons.map((button) => (
                <button key={button.id} type="button" className={styles.choice} onClick={() => answer(button.label || "Botão", `btn:${button.id}`)}>
                  {button.label || "Botão sem nome"}
                </button>
              ))}
            </div>
          )}
        </div>
        {state.waiting?.reply ? (
          <form
            className={styles.compose}
            onSubmit={(event) => {
              event.preventDefault();
              if (reply.trim()) answer(reply.trim(), "reply");
            }}
          >
            <span className={styles.field}>
              <Input size="sm" value={reply} placeholder="Responder como o contato" aria-label="Resposta do contato" maxLength={300} onChange={(event) => setReply(event.target.value)} />
            </span>
            <IconButton type="submit" label="Enviar resposta" size="sm" radius="full" disabled={!reply.trim()}>
              <PaperPlaneRightIcon weight="fill" />
            </IconButton>
          </form>
        ) : (
          <p className={styles.idle}>{state.waiting ? "Toque num botão para seguir" : "Fim da prévia"}</p>
        )}
      </div>
      <DialogFooter>
        {state.waiting?.reply && (
          <Button size="sm" variant="ghost" radius="md" onClick={() => answer("O contato não respondeu", "noreply")}>
            Simular sem resposta
          </Button>
        )}
        <Button size="sm" variant="outline" radius="md" iconStart={<ArrowClockwiseIcon />} onClick={restart}>
          Recomeçar
        </Button>
      </DialogFooter>
    </div>
  );
}
