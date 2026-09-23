"use client";

import { CheckCircleIcon, HourglassMediumIcon, MinusCircleIcon, PlusIcon, XCircleIcon } from "@phosphor-icons/react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { memo, type CSSProperties } from "react";
import { Spinner } from "@/components/ui/spinner";
import { rounded } from "@/lib/corners";
import { cx } from "@/lib/utils/cx";
import { categories, nodeCatalog } from "../catalog";
import { automationLimits } from "../schemas";
import type { NodeConfig, NodeKind, RunStepStatus } from "../summary";
import { useEditorActions } from "./editor-context";
import { NodeFields } from "./node-fields";
import styles from "./automation-editor.module.css";

/** O estado do nó enquanto a execução passa pelo quadro: rodando agora, ou como terminou. */
export type NodeRunState = RunStepStatus | "running";

export type FlowNodeData = { kind: NodeKind; config: NodeConfig; title?: string; run?: NodeRunState };

export type FlowNodeType = Node<FlowNodeData, "step">;

const outputLabels = { next: "Próximo passo", yes: "Sim", no: "Não" } as const;

const runGlyphs = {
  done: { icon: CheckCircleIcon, label: "Feito" },
  failed: { icon: XCircleIcon, label: "Falhou" },
  skipped: { icon: MinusCircleIcon, label: "Pulado" },
  waiting: { icon: HourglassMediumIcon, label: "Em espera" },
} as const;

// O nó do quadro como um card, no desenho da referência de editor de fluxo do usuário (2026-09-15, segunda
// rodada): o cabeçalho com o glifo no matiz da categoria e **o nome editável no próprio card** (sem a
// categoria escrita, a pedido: o glifo e a cor já dizem o que é); o corpo com **os campos do passo dentro do
// card**, os mesmos do painel; e o rodapé com uma linha por saída, rotulada, com a alça na borda direita e o
// "+" ao lado que abre o "O que acontece depois?". A entrada fica à esquerda, na altura do cabeçalho (menos
// no gatilho, que é começo). Durante o teste o card mostra por onde a execução passou: girando enquanto roda
// e, depois, o glifo de feito, falhou, pulado ou em espera, com o fio na cor do resultado. Memorizado porque
// o React Flow redesenha os nós a cada movimento do quadro. Tudo o que se clica dentro leva `nodrag`, senão
// o React Flow entende como arrasto.
export const FlowNode = memo(function FlowNode({ id, data, selected }: NodeProps<FlowNodeType>) {
  const spec = nodeCatalog[data.kind];
  const category = categories[spec.category];
  const { pickNext, rename, configure } = useEditorActions();
  const title = data.title ?? "";
  const run = data.run;
  const runGlyph = run && run !== "running" ? runGlyphs[run] : null;

  return (
    <div className={styles.node} data-category={spec.category} data-selected={selected || undefined} data-run={run} style={{ "--node-hue": category.hue } as CSSProperties} {...rounded("xl")}>
      {spec.category !== "trigger" && <Handle type="target" position={Position.Left} className={cx(styles.handle, styles.handleIn)} />}

      <header className={styles.nodeHead}>
        <span className={styles.nodeGlyph} aria-hidden="true" {...rounded("md")}>
          <spec.icon weight="duotone" />
        </span>
        <span className={styles.nodeNaming}>
          <input
            className={cx(styles.nodeTitle, "nodrag")}
            type="text"
            value={title}
            maxLength={automationLimits.title}
            placeholder={spec.label}
            aria-label={`Nome do passo ${spec.label}`}
            onChange={(event) => rename(id, event.target.value)}
          />
          {title.trim() && title.trim() !== spec.label && <span className={styles.nodeKind}>{spec.label}</span>}
        </span>
        {run === "running" && <Spinner size="sm" label="Rodando" className={styles.nodeRun} />}
        {runGlyph && (
          <span className={styles.nodeRun} role="img" aria-label={runGlyph.label}>
            <runGlyph.icon weight="fill" />
          </span>
        )}
      </header>

      <div className={cx(styles.nodeBody, "nodrag", "nopan")}>
        {spec.fields.length === 0 ? <span className={styles.nodeNote}>{spec.description}</span> : <NodeFields spec={spec} config={data.config} onChange={(patch) => configure(id, patch)} compact className={styles.nodeFields} />}
      </div>

      <footer className={styles.nodeFoot}>
        {spec.outputs.map((output) => {
          const branch = output === "next" ? null : output;
          return (
            <div key={output} className={styles.nodeOut} data-branch={branch ?? undefined}>
              <span className={styles.nodeOutLabel}>{outputLabels[output]}</span>
              <button
                type="button"
                className={cx(styles.add, "nodrag", "nopan")}
                aria-label={branch ? `Adicionar um passo na saída ${outputLabels[output]}` : "Adicionar o próximo passo"}
                onClick={(event) => {
                  event.stopPropagation();
                  pickNext(id, branch);
                }}
              >
                <PlusIcon weight="bold" aria-hidden="true" />
              </button>
              <Handle type="source" position={Position.Right} id={output} className={cx(styles.handle, styles.handleOut)} />
            </div>
          );
        })}
      </footer>
    </div>
  );
});
