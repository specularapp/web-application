"use client";

import { WarningCircleIcon, XIcon } from "@phosphor-icons/react";
import { BaseEdge, EdgeLabelRenderer, getBezierPath, Handle, Position, useReactFlow, type EdgeProps, type Node, type NodeProps } from "@xyflow/react";
import { createContext, memo, useContext, type CSSProperties, type ReactNode } from "react";
import { cx } from "@/lib/utils/cx";
import { formatCount, formatRate } from "../email-catalog";
import { flowActions, flowChannels, flowDelayUnits, flowInputFields, flowOperators, flowSteps, flowTriggers, portsOf, variableLabel, type FlowPort } from "../flow-catalog";
import type { FlowStep, FlowStepStats } from "../types";
import { actionIcons, channelIcons, stepIcons } from "./icons";
import styles from "./flow-editor.module.css";

export type FlowNodeData = { step: FlowStep };
export type FlowNodeType = Node<FlowNodeData, "step">;

type FlowCanvasContextValue = {
  stats: Record<string, FlowStepStats>;
  /** "passo:saída" das saídas que já levam a algum lugar. */
  connected: ReadonlySet<string>;
  flowName: (id: string) => string;
};

export const FlowCanvasContext = createContext<FlowCanvasContextValue>({ stats: {}, connected: new Set(), flowName: (id) => id });

/** O texto com as variáveis (`{{primeiro_nome}}`) trocadas pela etiqueta azul. */
export function WithVariables({ text }: { text: string }) {
  const parts = text.split(/(\{\{\w+\}\})/g);
  return (
    <>
      {parts.map((part, index) => {
        const match = part.match(/^\{\{(\w+)\}\}$/);
        return match ? (
          <span key={index} className={styles.variable}>
            {variableLabel(match[1])}
          </span>
        ) : (
          part
        );
      })}
    </>
  );
}

export const delayLabel = (step: FlowStep) => {
  if (step.data.kind !== "delay") return "";
  const { delay } = step.data;
  if (delay.mode === "until") return `Esperar até ${delay.time}`;
  const unit = delay.amount === 1 ? flowDelayUnits[delay.unit].slice(0, -1) : flowDelayUnits[delay.unit];
  return `Esperar ${delay.amount} ${unit}`;
};

/** Uma saída do passo: a caixinha com o rótulo, quantos seguiram por ela e a bolinha de onde sai a ligação. */
function PortRow({ step, port, children }: { step: FlowStep; port: FlowPort; children?: ReactNode }) {
  const { stats, connected } = useContext(FlowCanvasContext);
  const count = stats[step.id]?.ports[port.id];
  const linked = connected.has(`${step.id}:${port.id}`);
  return (
    <div className={styles.port} data-tone={port.tone} data-linked={linked || undefined}>
      {children ?? <span className={styles.portLabel}>{port.label}</span>}
      {count !== undefined && <span className={styles.portCount}>{formatCount(count)}</span>}
      <Handle type="source" position={Position.Right} id={port.id} className={styles.handle} data-tone={port.tone} />
    </div>
  );
}

function Body({ step }: { step: FlowStep }) {
  const { flowName } = useContext(FlowCanvasContext);
  const { data } = step;
  const ports = portsOf(data);
  const portOf = (id: string): FlowPort => ports.find((port) => port.id === id) ?? { id, label: id };

  switch (data.kind) {
    case "trigger":
      return (
        <>
          {data.triggers.length === 0 ? (
            <p className={styles.placeholder}>Clique para escolher o que inicia o fluxo.</p>
          ) : (
            <ul className={styles.triggers}>
              {data.triggers.map((trigger) => (
                <li key={trigger.id}>
                  <strong>{flowTriggers[trigger.kind].label}</strong>
                  {trigger.value ? <span>{trigger.value}</span> : trigger.kind !== "ig-story-reply" && trigger.kind !== "ig-story-mention" && <span data-missing="">Falta o detalhe</span>}
                  {trigger.publicReplies.length > 0 && (
                    <span className={styles.publicReply}>
                      Responde em público, {trigger.publicReplies.length} {trigger.publicReplies.length === 1 ? "variação" : "variações"}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
          <PortRow step={step} port={portOf("next")} />
        </>
      );
    case "message": {
      const { message } = data;
      return (
        <>
          {message.channel === "email" && message.subject && (
            <p className={styles.subject}>
              <small>Assunto</small> <WithVariables text={message.subject} />
            </p>
          )}
          <div className={styles.bubbles}>
            {message.texts.map((text, index) => (
              <p key={index} className={styles.bubble}>
                {text.trim() ? <WithVariables text={text} /> : <span className={styles.missing}>Mensagem vazia</span>}
              </p>
            ))}
          </div>
          {message.buttons.length > 0 && (
            <div className={styles.buttons}>
              {message.buttons.map((button) => (
                <PortRow key={button.id} step={step} port={portOf(`btn:${button.id}`)}>
                  <span className={styles.buttonLabel}>{button.label || "Botão sem nome"}</span>
                </PortRow>
              ))}
            </div>
          )}
          {message.waitReply && (
            <div className={styles.waiting}>
              <span className={styles.waitingTitle}>Esperando resposta</span>
              <PortRow step={step} port={portOf("reply")} />
              <PortRow step={step} port={portOf("noreply")} />
            </div>
          )}
          <PortRow step={step} port={portOf("next")} />
        </>
      );
    }
    case "input":
      return (
        <>
          <p className={styles.bubble}>
            <WithVariables text={data.question || "Escreva a pergunta"} />
          </p>
          <p className={styles.saveAs}>
            Guarda {flowInputFields[data.field].toLowerCase()} em <b>{data.saveAs || "campo"}</b>
          </p>
          <PortRow step={step} port={portOf("reply")} />
          <PortRow step={step} port={portOf("noreply")} />
        </>
      );
    case "ai":
      return (
        <>
          <p className={styles.goal}>
            <small>Objetivo</small>
            {data.goal || "Descreva o que o assistente deve conseguir"}
          </p>
          <PortRow step={step} port={portOf("done")} />
          <PortRow step={step} port={portOf("handoff")} />
        </>
      );
    case "actions":
      return (
        <>
          <ul className={styles.actionList}>
            {data.actions.map((action) => {
              const Glyph = actionIcons[action.kind];
              return (
                <li key={action.id}>
                  <Glyph aria-hidden="true" />
                  <span>
                    {flowActions[action.kind].label}
                    {action.value && <strong>{action.value}</strong>}
                  </span>
                </li>
              );
            })}
          </ul>
          <PortRow step={step} port={portOf("next")} />
        </>
      );
    case "condition":
      return (
        <>
          <p className={styles.rulesHead}>{data.match === "all" ? "Todas as regras" : "Qualquer regra"}</p>
          <ul className={styles.rules}>
            {data.rules.map((rule) => (
              <li key={rule.id}>
                {rule.field} <em>{flowOperators[rule.operator]}</em> <strong>{rule.value || "valor"}</strong>
              </li>
            ))}
          </ul>
          <PortRow step={step} port={portOf("yes")} />
          <PortRow step={step} port={portOf("no")} />
        </>
      );
    case "randomizer":
      return (
        <>
          {data.variants.map((variant) => (
            <PortRow key={variant.id} step={step} port={portOf(`var:${variant.id}`)}>
              <span className={styles.variant}>
                <b>{variant.label}</b>
                <span className={styles.variantBar}>
                  <i style={{ width: `${Math.min(100, Math.max(0, variant.weight))}%` }} />
                </span>
                <small>{variant.weight}%</small>
              </span>
            </PortRow>
          ))}
        </>
      );
    case "delay":
      return (
        <>
          <p className={styles.delay}>{delayLabel(step)}</p>
          <PortRow step={step} port={portOf("next")} />
        </>
      );
    case "jump":
      return <p className={styles.delay}>{data.flowId ? `Vai para “${flowName(data.flowId)}”` : "Escolha o fluxo de destino"}</p>;
  }
}

// Um passo no quadro, no desenho do ManyChat: o cabeçalho com o glifo no tom do tipo (a mensagem leva a cor do
// canal), o conteúdo resumido (balões com as variáveis em etiqueta, botões, regras) e as saídas, cada uma com
// a bolinha à direita e quantos seguiram por ela. A entrada é a bolinha à esquerda do cabeçalho. Em cima, os
// números da mensagem nos últimos 30 dias. Memorizado porque o React Flow redesenha a cada movimento.
export const FlowStepNode = memo(function FlowStepNode({ data, selected }: NodeProps<FlowNodeType>) {
  const { stats } = useContext(FlowCanvasContext);
  const { step } = data;
  const spec = flowSteps[step.data.kind];
  const Glyph = step.data.kind === "message" ? channelIcons[step.data.message.channel] : stepIcons[step.data.kind];
  const hue = step.data.kind === "message" ? flowChannels[step.data.message.channel].hue : spec.hue;
  const kicker = step.data.kind === "message" ? flowChannels[step.data.message.channel].label : spec.label;
  const numbers = stats[step.id];
  const showClicks = step.data.kind === "message" && (step.data.message.buttons.length > 0 || (numbers?.clicked ?? 0) > 0);
  const missingJump = step.data.kind === "jump" && !step.data.flowId;

  return (
    <div className={styles.node} data-kind={step.data.kind} data-selected={selected || undefined} style={{ "--hue": hue } as CSSProperties}>
      {numbers && numbers.sent > 0 && step.data.kind === "message" && (
        <div className={styles.nodeStats}>
          <span>
            Enviadas <b>{formatCount(numbers.sent)}</b>
          </span>
          {showClicks && (
            <>
              <span>
                Cliques <b>{formatCount(numbers.clicked)}</b>
              </span>
              <span>
                CTR <b>{formatRate(numbers.clicked, numbers.sent)}</b>
              </span>
            </>
          )}
        </div>
      )}
      <div className={styles.nodeHead}>
        {step.data.kind !== "trigger" && <Handle type="target" position={Position.Left} className={cx(styles.handle, styles.target)} />}
        <span className={styles.nodeIcon} aria-hidden="true">
          <Glyph weight="fill" />
        </span>
        <span className={styles.nodeTitle}>
          <small>{kicker}</small>
          <strong>{step.data.kind === "trigger" ? "Quando" : step.title}</strong>
        </span>
        {numbers && numbers.sent > 0 && step.data.kind !== "message" && <span className={styles.nodeCount}>{formatCount(numbers.sent)}</span>}
        {missingJump && <WarningCircleIcon weight="fill" className={styles.nodeWarn} aria-label="Falta escolher o fluxo de destino" />}
      </div>
      <div className={styles.nodeBody}>
        <Body step={step} />
      </div>
    </div>
  );
});

// A ligação entre dois passos: curva suave; escolhida, fica no acento e mostra o × para desfazer.
export function FlowEdgeView({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, selected, markerEnd }: EdgeProps) {
  const { deleteElements } = useReactFlow();
  const [path, labelX, labelY] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, curvature: 0.35 });
  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} className={styles.edge} data-selected={selected || undefined} interactionWidth={18} />
      {selected && (
        <EdgeLabelRenderer>
          <button
            type="button"
            className={cx(styles.edgeRemove, "nodrag", "nopan")}
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
            aria-label="Desfazer a ligação"
            title="Desfazer a ligação"
            onClick={() => void deleteElements({ edges: [{ id }] })}
          >
            <XIcon weight="bold" aria-hidden="true" />
          </button>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
