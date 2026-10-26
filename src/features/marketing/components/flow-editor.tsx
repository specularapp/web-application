"use client";

import "@xyflow/react/dist/style.css";
import { ArrowClockwiseIcon, ArrowCounterClockwiseIcon, ArrowLeftIcon, CaretDownIcon, CornersOutIcon, EyeIcon, MinusIcon, PauseIcon, PlayIcon, PlusIcon, RocketLaunchIcon } from "@phosphor-icons/react";
import { applyEdgeChanges, applyNodeChanges, Background, BackgroundVariant, ReactFlow, ReactFlowProvider, useReactFlow, useViewport, type Connection, type Edge, type EdgeChange, type NodeChange, type OnConnectEnd } from "@xyflow/react";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { useFloatingActionsRegistration } from "@/components/layout/floating-actions";
import { useToast } from "@/components/providers/toast-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog } from "@/components/ui/dialog";
import { DropdownMenu, type DropdownSection } from "@/components/ui/dropdown-menu";
import { IconButton } from "@/components/ui/icon-button";
import { Text } from "@/components/ui/text";
import { Tooltip } from "@/components/ui/tooltip";
import { MOBILE_QUERY, useMediaQuery } from "@/hooks/use-media-query";
import { formatWhen } from "../email-catalog";
import { flowStatuses, newFlowId, newFlowStep, portsOf } from "../flow-catalog";
import type { Flow, FlowEdge, FlowStatus, FlowStep } from "../types";
import { FlowPreview } from "./flow-preview";
import { FlowStepPanel } from "./flow-step-panel";
import { FlowStepPicker, type FlowStepChoice } from "./flow-step-picker";
import { FlowCanvasContext, FlowEdgeView, FlowStepNode, type FlowNodeType } from "./flow-step-node";
import styles from "./flow-editor.module.css";

const BASE = "/marketing/fluxos";

/** O painel do passo cabe ao lado do quadro a partir daqui; abaixo ele vira gaveta. */
const PANEL_QUERY = "(min-width: 64rem)";

/** O menor zoom em que o cartão ainda se lê; abaixo disso o quadro abre no começo do fluxo. */
const READABLE_ZOOM = 0.7;

const NODE_SIZE = { width: 288, height: 220 };

const HISTORY_LIMIT = 50;

/** Digitação no mesmo passo dentro deste intervalo vira um passo só de desfazer. */
const TYPING_WINDOW = 1200;

type Snapshot = { nodes: FlowNodeType[]; edges: Edge[] };
type Picker = { at: { x: number; y: number }; from?: { source: string; port: string } };

const nodeTypes = { step: FlowStepNode };
const edgeTypes = { flow: FlowEdgeView };

const toNode = (step: FlowStep): FlowNodeType => ({ id: step.id, type: "step", position: { x: step.x, y: step.y }, data: { step }, deletable: step.data.kind !== "trigger" });
const toEdge = (edge: FlowEdge): Edge => ({ id: edge.id, source: edge.from, sourceHandle: edge.port, target: edge.to, type: "flow" });
const toSteps = (nodes: FlowNodeType[]): FlowStep[] => nodes.map((node) => ({ ...node.data.step, x: Math.round(node.position.x), y: Math.round(node.position.y) }));
const toFlowEdges = (edges: Edge[]): FlowEdge[] => edges.map((edge) => ({ id: edge.id, from: edge.source, port: edge.sourceHandle ?? "next", to: edge.target }));
const clean = (nodes: FlowNodeType[]) => nodes.map((node) => ({ ...node, selected: false }));

export type FlowEditorProps = {
  flow: Flow;
  /** Os outros fluxos da conta, para o passo de ir para outro fluxo. */
  flows: { id: string; name: string }[];
};

export function FlowEditor(props: FlowEditorProps) {
  return (
    <ReactFlowProvider>
      <Editor {...props} />
    </ReactFlowProvider>
  );
}

// O construtor de fluxos, no desenho do ManyChat adaptado à casa: a barra com o voltar, o nome editável, a
// situação, a prévia e o publicar; o quadro pontilhado com os passos ligados por curvas; o painel do passo à
// direita ao clicar num cartão (gaveta abaixo de 64rem); o "escolha o próximo passo" ao soltar uma ligação no
// vazio ou pelo dock; e o dock de adicionar, zoom, enquadrar, desfazer e refazer. Nada é gravado: publicar e
// pausar só mudam esta tela até o domínio existir no banco.
function Editor({ flow, flows }: FlowEditorProps) {
  const router = useRouter();
  const { toast } = useToast();
  const reactFlow = useReactFlow<FlowNodeType, Edge>();
  const mobile = useMediaQuery(MOBILE_QUERY);
  const panelInline = useMediaQuery(PANEL_QUERY);
  const canvasRef = useRef<HTMLDivElement>(null);
  const lastRecord = useRef({ key: "", at: 0 });

  const [name, setName] = useState(flow.name);
  const [status, setStatus] = useState<FlowStatus>(flow.status);
  const [publishedAt, setPublishedAt] = useState(flow.publishedAt);
  const [unpublished, setUnpublished] = useState(flow.publishedAt === null);
  const [nodes, setNodes] = useState<FlowNodeType[]>(() => flow.steps.map(toNode));
  const [edges, setEdges] = useState<Edge[]>(() => flow.edges.map(toEdge));
  const [history, setHistory] = useState<{ past: Snapshot[]; future: Snapshot[] }>({ past: [], future: [] });
  const [editing, setEditing] = useState<string | null>(null);
  const [picker, setPicker] = useState<Picker | null>(null);
  const [preview, setPreview] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  const dirty = () => setUnpublished(true);

  /** Guarda o estado de antes para o desfazer. */
  const record = (key = "") => {
    const now = Date.now();
    if (key && lastRecord.current.key === key && now - lastRecord.current.at < TYPING_WINDOW) {
      lastRecord.current.at = now;
      return;
    }
    lastRecord.current = { key, at: now };
    const snapshot: Snapshot = { nodes: clean(nodes), edges };
    setHistory((current) => ({ past: [...current.past.slice(-(HISTORY_LIMIT - 1)), snapshot], future: [] }));
  };

  const travel = (direction: "undo" | "redo") => {
    const source = direction === "undo" ? history.past : history.future;
    const snapshot = source.at(-1);
    if (!snapshot) return;
    const present: Snapshot = { nodes: clean(nodes), edges };
    setHistory(direction === "undo" ? { past: history.past.slice(0, -1), future: [...history.future, present] } : { past: [...history.past, present], future: history.future.slice(0, -1) });
    lastRecord.current = { key: "", at: 0 };
    setNodes(snapshot.nodes);
    setEdges(snapshot.edges);
    setEditing((current) => (current && snapshot.nodes.some((node) => node.id === current) ? current : null));
    dirty();
  };

  const onShortcut = useEffectEvent((direction: "undo" | "redo") => travel(direction));

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest("input, textarea, [contenteditable]") || !(event.ctrlKey || event.metaKey)) return;
      const key = event.key.toLowerCase();
      if (key === "z") {
        event.preventDefault();
        onShortcut(event.shiftKey ? "redo" : "undo");
      } else if (key === "y") {
        event.preventDefault();
        onShortcut("redo");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const onNodesChange = (changes: NodeChange<FlowNodeType>[]) => {
    const removed = changes.filter((change) => change.type === "remove").map((change) => change.id);
    if (removed.length > 0) {
      record();
      setEditing((current) => (current && removed.includes(current) ? null : current));
      setEdges((current) => current.filter((edge) => !removed.includes(edge.source) && !removed.includes(edge.target)));
    }
    setNodes((current) => applyNodeChanges(changes, current));
    if (removed.length > 0 || changes.some((change) => change.type === "position" && change.dragging === false)) dirty();
  };

  const onEdgesChange = (changes: EdgeChange[]) => {
    const removed = changes.some((change) => change.type === "remove");
    if (removed) record("edges-remove");
    setEdges((current) => applyEdgeChanges(changes, current));
    if (removed) dirty();
  };

  /** Cada saída leva a um passo só: ligar de novo troca a ligação antiga. */
  const link = (source: string, port: string, target: string) =>
    setEdges((current) => [...current.filter((edge) => !(edge.source === source && edge.sourceHandle === port)), { id: `${source}-${port}-${target}-${newFlowId()}`, source, sourceHandle: port, target, type: "flow" }]);

  const onConnect = (connection: Connection) => {
    if (!connection.sourceHandle || connection.source === connection.target) return;
    record();
    link(connection.source, connection.sourceHandle, connection.target);
    dirty();
  };

  const onConnectEnd: OnConnectEnd = (event, state) => {
    if (state.isValid || !state.fromNode || !state.fromHandle?.id || state.fromHandle.type !== "source") return;
    const point = "changedTouches" in event ? event.changedTouches[0] : event;
    setPicker({ at: reactFlow.screenToFlowPosition({ x: point.clientX + 40, y: point.clientY - 30 }), from: { source: state.fromNode.id, port: state.fromHandle.id } });
  };

  const centerSpot = () => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    const center = reactFlow.screenToFlowPosition({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
    return { x: center.x - NODE_SIZE.width / 2, y: center.y - NODE_SIZE.height / 2 };
  };

  const addStep = (choice: FlowStepChoice) => {
    if (!picker) return;
    const count = nodes.filter((node) => node.data.step.data.kind === "message").length + 1;
    const step = newFlowStep(choice.kind, picker.at, count, choice.channel);
    record();
    setNodes((current) => [...current.map((node) => ({ ...node, selected: false })), { ...toNode(step), selected: true }]);
    if (picker.from) link(picker.from.source, picker.from.port, step.id);
    setEditing(step.id);
    setPicker(null);
    dirty();
  };

  const updateStep = (step: FlowStep) => {
    record(`step:${step.id}`);
    const ports = new Set(portsOf(step.data).map((port) => port.id));
    setNodes((current) => current.map((node) => (node.id === step.id ? { ...node, data: { step } } : node)));
    setEdges((current) => current.filter((edge) => edge.source !== step.id || ports.has(edge.sourceHandle ?? "next")));
    dirty();
  };

  const duplicateStep = (id: string) => {
    const node = nodes.find((item) => item.id === id);
    if (!node) return;
    const copy: FlowStep = { ...structuredClone(node.data.step), id: `s-${newFlowId()}`, title: `${node.data.step.title} (cópia)`, x: Math.round(node.position.x + 40), y: Math.round(node.position.y + 60) };
    record();
    setNodes((current) => [...current.map((item) => ({ ...item, selected: false })), { ...toNode(copy), selected: true }]);
    setEditing(copy.id);
    dirty();
  };

  const removeStep = (id: string) => {
    record();
    setNodes((current) => current.filter((node) => node.id !== id));
    setEdges((current) => current.filter((edge) => edge.source !== id && edge.target !== id));
    setEditing(null);
    setRemoving(null);
    dirty();
  };

  const triggerNode = nodes.find((node) => node.data.step.data.kind === "trigger");
  const triggerReady = Boolean(triggerNode && triggerNode.data.step.data.kind === "trigger" && triggerNode.data.step.data.triggers.length > 0);
  const triggerLinked = Boolean(triggerNode && edges.some((edge) => edge.source === triggerNode.id));
  const unchanged = publishedAt !== null && !unpublished;

  const publish = () => {
    if (!triggerReady || !triggerLinked) {
      toast({ title: "Ainda não dá para publicar", description: triggerReady ? "Ligue o gatilho ao primeiro passo do fluxo." : "Escolha no gatilho o que faz o contato entrar.", tone: "warning" });
      return;
    }
    const first = publishedAt === null;
    setStatus("live");
    setPublishedAt(new Date().toISOString());
    setUnpublished(false);
    toast({ title: first ? "Fluxo no ar" : "Mudanças publicadas", description: "Os próximos contatos já seguem esta versão.", tone: "success" });
  };

  const toggleLive = (on: boolean) => {
    setStatus(on ? "live" : "paused");
    toast({ title: on ? "Fluxo no ar" : "Fluxo pausado", description: on ? "Novos contatos voltam a entrar." : "Ninguém novo entra; quem está no meio para onde está.", tone: on ? "success" : "neutral", feedback: false });
  };

  /* O enquadramento inicial: o fluxo inteiro quando cabe legível; quando não cabe, o começo dele em zoom de
     leitura, alinhado à esquerda, porque um fluxo encolhido até caber vira miniatura. */
  const frame = () => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect || nodes.length === 0) return;
    const xs = nodes.map((node) => node.position.x);
    const ys = nodes.map((node) => node.position.y);
    const bounds = { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs) + NODE_SIZE.width, height: Math.max(...ys) - Math.min(...ys) + NODE_SIZE.height };
    const fit = Math.min(1, (rect.width - 96) / bounds.width, (rect.height - 160) / bounds.height);
    if (fit >= READABLE_ZOOM) {
      void reactFlow.fitView({ padding: 0.2, maxZoom: 1 });
      return;
    }
    void reactFlow.setViewport({ x: 48 - bounds.x * READABLE_ZOOM, y: 64 - bounds.y * READABLE_ZOOM, zoom: READABLE_ZOOM });
  };

  const connected = useMemo(() => new Set(edges.map((edge) => `${edge.source}:${edge.sourceHandle}`)), [edges]);
  const others = useMemo(() => flows.filter((item) => item.id !== flow.id), [flows, flow.id]);
  const context = useMemo(() => ({ stats: flow.stats, connected, flowName: (id: string) => flows.find((item) => item.id === id)?.name ?? "Fluxo removido" }), [flow.stats, connected, flows]);
  const editingStep = nodes.find((node) => node.id === editing)?.data.step;
  const statusMeta = flowStatuses[status];

  const openPicker = () => setPicker({ at: centerSpot() });

  useFloatingActionsRegistration(
    mobile && !picker && !preview && !removing && !editingStep
      ? {
          primary: { label: unchanged ? "Publicado" : "Publicar", icon: <RocketLaunchIcon weight="bold" />, disabled: unchanged, onClick: publish },
          extras: [
            { label: "Adicionar passo", icon: <PlusIcon weight="bold" />, onClick: openPicker },
            { label: "Prévia", icon: <EyeIcon weight="bold" />, onClick: () => setPreview(true) },
          ],
          cancel: { label: "Voltar aos fluxos", onClick: () => router.push(BASE as Route) },
        }
      : null,
  );

  const publishSections: DropdownSection[] = [
    { id: "ver", items: [{ id: "previa", label: "Prévia no celular", icon: EyeIcon, onSelect: () => setPreview(true) }] },
    ...(publishedAt ? [{ id: "situacao", items: [status === "live" ? { id: "pausar", label: "Pausar", icon: PauseIcon, onSelect: () => toggleLive(false) } : { id: "ativar", label: "Pôr no ar", icon: PlayIcon, onSelect: () => toggleLive(true) }] }] : []),
  ];

  const panel = editingStep ? (
    <FlowStepPanel
      key={editingStep.id}
      step={editingStep}
      flows={others}
      onChange={updateStep}
      onClose={() => setEditing(null)}
      onDuplicate={() => duplicateStep(editingStep.id)}
      onDelete={() => setRemoving(editingStep.id)}
    />
  ) : null;

  return (
    <FlowCanvasContext.Provider value={context}>
      <div className={styles.editor}>
        <header className={styles.bar}>
          <IconButton label="Voltar aos fluxos" variant="ghost" size="sm" href={BASE}>
            <ArrowLeftIcon />
          </IconButton>
          <nav className={styles.crumbs} aria-label="Onde o fluxo mora">
            <Link href={BASE as Route} className={styles.crumb}>
              Fluxos
            </Link>
            <span className={styles.slash} aria-hidden="true">
              /
            </span>
            <input
              className={styles.nameInput}
              type="text"
              value={name}
              maxLength={80}
              aria-label="Nome do fluxo"
              placeholder="Nome do fluxo"
              onChange={(event) => {
                setName(event.target.value);
                dirty();
              }}
            />
            <span className={styles.statusBadge}>
              <Badge tone={statusMeta.tone} size="sm">
                {statusMeta.label}
              </Badge>
            </span>
          </nav>
          <Text as="span" variant="caption1" tone="secondary" className={styles.saveState} role="status">
            {unchanged ? (publishedAt ? `Publicado em ${formatWhen(publishedAt)}` : "") : publishedAt ? "Mudanças não publicadas" : "Rascunho, ainda fora do ar"}
          </Text>
          <div className={styles.barActions}>
            <Button variant="outline" size="sm" radius="md" iconStart={<EyeIcon />} onClick={() => setPreview(true)}>
              Prévia
            </Button>
            <span className={styles.publish}>
              <Button size="sm" radius="md" iconStart={<RocketLaunchIcon />} disabled={unchanged} onClick={publish}>
                {unchanged ? "Publicado" : publishedAt ? "Publicar mudanças" : "Publicar"}
              </Button>
              <DropdownMenu label="Publicação" triggerLabel="Mais opções de publicação" searchable={false} icon={<CaretDownIcon />} size="sm" trigger={{ variant: "outline", radius: "md" }} sections={publishSections} />
            </span>
          </div>
        </header>

        <div className={styles.work} data-panel={(panelInline && editingStep) || undefined}>
          <section ref={canvasRef} className={styles.canvas} aria-label="Quadro do fluxo">
            <ReactFlow<FlowNodeType, Edge>
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onConnectEnd={onConnectEnd}
              onNodeDragStart={() => record()}
              onNodeClick={(_, node) => {
                setEditing(node.id);
                setPicker(null);
              }}
              onPaneClick={() => setEditing(null)}
              isValidConnection={(connection) => connection.source !== connection.target}
              onInit={frame}
              deleteKeyCode={["Backspace", "Delete"]}
              minZoom={0.2}
              maxZoom={1.5}
              panOnScroll
              zoomOnScroll={false}
              zoomOnDoubleClick={false}
              snapToGrid
              snapGrid={[10, 10]}
              connectionRadius={28}
            >
              <Background variant={BackgroundVariant.Dots} gap={20} size={1.4} />
            </ReactFlow>

            {!triggerLinked && (
              <p className={styles.hint}>
                Arraste da bolinha de <strong>Então</strong>, no gatilho, para criar o primeiro passo.
              </p>
            )}

            <div className={styles.dock} role="toolbar" aria-label="Ferramentas do quadro">
              <Button size="sm" radius="full" iconStart={<PlusIcon />} onClick={openPicker}>
                Adicionar passo
              </Button>
              <span className={styles.dockGroup}>
                <IconButton label="Diminuir o zoom" variant="ghost" size="sm" radius="md" onClick={() => void reactFlow.zoomOut({ duration: 200 })}>
                  <MinusIcon />
                </IconButton>
                <ZoomValue onReset={() => void reactFlow.zoomTo(1, { duration: 200 })} />
                <IconButton label="Aumentar o zoom" variant="ghost" size="sm" radius="md" onClick={() => void reactFlow.zoomIn({ duration: 200 })}>
                  <PlusIcon />
                </IconButton>
                <IconButton label="Enquadrar tudo" variant="ghost" size="sm" radius="md" onClick={() => void reactFlow.fitView({ padding: 0.2, maxZoom: 1, duration: 300 })}>
                  <CornersOutIcon />
                </IconButton>
              </span>
              <span className={styles.dockGroup}>
                <Tooltip content="Desfazer (Ctrl+Z)">
                  <IconButton label="Desfazer" variant="ghost" size="sm" radius="md" disabled={history.past.length === 0} onClick={() => travel("undo")}>
                    <ArrowCounterClockwiseIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip content="Refazer (Ctrl+Shift+Z)">
                  <IconButton label="Refazer" variant="ghost" size="sm" radius="md" disabled={history.future.length === 0} onClick={() => travel("redo")}>
                    <ArrowClockwiseIcon />
                  </IconButton>
                </Tooltip>
              </span>
            </div>
          </section>

          {panelInline && panel && (
            <aside className={styles.side} aria-label="Passo escolhido">
              {panel}
            </aside>
          )}
        </div>

        <Dialog open={!panelInline && Boolean(editingStep)} onClose={() => setEditing(null)} label="Passo escolhido" size="md" placement="end" scrim={mobile} focusOnOpen={false}>
          {!panelInline && panel}
        </Dialog>

        <FlowStepPicker open={picker !== null} linked={Boolean(picker?.from)} onPick={addStep} onClose={() => setPicker(null)} />

        <FlowPreview open={preview} steps={toSteps(nodes)} edges={toFlowEdges(edges)} flowName={context.flowName} onClose={() => setPreview(false)} />

        <ConfirmDialog
          open={removing !== null}
          title="Excluir este passo?"
          description="O passo e as ligações dele saem do quadro. Dá para desfazer com Ctrl+Z."
          onClose={() => setRemoving(null)}
          onConfirm={() => removing && removeStep(removing)}
        />
      </div>
    </FlowCanvasContext.Provider>
  );
}

/* O zoom em vigor mora num componente próprio: assim só ele redesenha a cada movimento do quadro, e não o
   construtor inteiro. */
function ZoomValue({ onReset }: { onReset: () => void }) {
  const { zoom } = useViewport();
  return (
    <button type="button" className={styles.zoomValue} aria-label={`Zoom em ${Math.round(zoom * 100)}%, voltar para 100%`} onClick={onReset}>
      {Math.round(zoom * 100)}%
    </button>
  );
}
