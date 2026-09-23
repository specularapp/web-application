"use client";

import "@xyflow/react/dist/style.css";
import { ArrowLeftIcon, ClockCounterClockwiseIcon, CornersOutIcon, LightningIcon, MagnifyingGlassMinusIcon, MagnifyingGlassPlusIcon, PlayIcon, PlusIcon, SlidersHorizontalIcon, TrashIcon, XIcon } from "@phosphor-icons/react";
import { Background, BackgroundVariant, ReactFlow, ReactFlowProvider, addEdge, useEdgesState, useNodesState, useReactFlow, type Connection, type Edge, type EdgeChange, type IsValidConnection, type NodeChange, type OnSelectionChangeParams } from "@xyflow/react";
import { format } from "date-fns";
import type { Route } from "next";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from "react";
import { useFloatingActionsRegistration } from "@/components/layout/floating-actions";
import { useToast } from "@/components/providers/toast-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Text } from "@/components/ui/text";
import { Textarea } from "@/components/ui/textarea";
import { MOBILE_QUERY, useMediaQuery } from "@/hooks/use-media-query";
import { useOpenedOnce } from "@/hooks/use-opened-once";
import { callAction } from "@/lib/action";
import { cx } from "@/lib/utils/cx";
import { saveAutomationAction, setAutomationStatusAction, testAutomationAction } from "../actions";
import { isTrigger, nodeCatalog } from "../catalog";
import { agoLabel, automationStatuses, runsLabel } from "../labels";
import { automationLimits, type SaveAutomationInput } from "../schemas";
import type { Automation, AutomationEdge, AutomationNode, AutomationRun, AutomationStatus, NodeConfig, NodeKind } from "../summary";
import { EditorActionsContext, type Branch, type EditorActions } from "./editor-context";
import { FlowNode, type FlowNodeType, type NodeRunState } from "./flow-node";
import { NODE_DRAG_TYPE, NodePalette } from "./node-palette";
import { NodeConfigPanel } from "./node-config-panel";
import styles from "./automation-editor.module.css";

/* O registro de execuções entra por importação dinâmica, montado só na primeira abertura, como o mesmo
   componente já faz em `automations-board.tsx` (varredura de peso de 2026-09-22). */
const RunLogDialog = dynamic(() => import("./run-log-dialog").then((module) => module.RunLogDialog));

export type AutomationEditorProps = {
  automation: Automation;
};

/** Quanto o editor espera a pessoa parar de mexer antes de salvar. */
const SAVE_PAUSE = 900;

/** As colunas só cabem ao lado do quadro a partir daqui; abaixo elas viram gavetas. */
const PANELS_QUERY = "(min-width: 64rem)";

/** A distância entre um nó e o próximo que nasce ligado a ele, e o desvio de cada ramo da condição. */
const NEXT_GAP = 400;
const BRANCH_GAP = 170;

/** Metade da medida do card, para o nó nascer centrado onde a pessoa soltou ou olhou. */
const NODE_HALF = { x: 144, y: 96 };

/** O menor zoom em que o nó ainda se lê; abaixo disso o quadro mostra só o começo do fluxo. */
const READABLE_ZOOM = 0.8;

const nodeTypes = { step: FlowNode };

const toFlowNodes = (nodes: AutomationNode[]): FlowNodeType[] => nodes.map((node) => ({ id: node.id, type: "step", position: { x: node.x, y: node.y }, data: { kind: node.kind, config: node.config, title: node.title } }));

const toFlowEdges = (edges: AutomationEdge[]): Edge[] => edges.map((edge) => ({ id: edge.id, source: edge.from, target: edge.to, sourceHandle: edge.branch ?? "next" }));

const fromFlow = (nodes: FlowNodeType[], edges: Edge[]): Pick<SaveAutomationInput, "nodes" | "edges"> => ({
  nodes: nodes.map((node) => ({ id: node.id, kind: node.data.kind, ...(node.data.title?.trim() ? { title: node.data.title.trim() } : {}), x: Math.round(node.position.x), y: Math.round(node.position.y), config: node.data.config })),
  edges: edges.map((edge) => ({ id: edge.id, from: edge.source, to: edge.target, branch: edge.sourceHandle === "yes" || edge.sourceHandle === "no" ? edge.sourceHandle : null })),
});

const edgeId = (source: string, target: string, handle: string | null | undefined) => `${source}-${target}-${handle ?? "next"}`;

const newId = () => `n${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

type SaveState = "idle" | "saving" | "saved" | "error";

type Picking = { from: string | null; branch: Branch };

/** Por onde a execução passou no quadro: o estado de cada nó e de cada ligação enquanto o teste é encenado. */
type EdgeRunState = "active" | "done" | "failed";
type Replay = { nodes: Record<string, NodeRunState>; edges: Record<string, EdgeRunState> };

/** Quanto cada passo fica aceso, e a pausa até o seguinte, na encenação do teste. */
const STEP_PAUSE = 750;
const STEP_GAP = 260;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// O editor de automação (2026-09-15, sobre as referências n8n e Make do usuário, adaptadas aos padrões da
// casa): a barra em cima com o nome, a situação, o salvamento, o interruptor de ativar, o histórico e o
// Testar; à esquerda a paleta de passos (clicar adiciona, arrastar solta no lugar); no centro o quadro do
// React Flow com os nós da casa, o fundo pontilhado e o dock flutuante de zoom, excluir e testar; à direita o
// painel do passo escolhido, ou a ficha da automação quando nada está escolhido. O "+" na saída de cada nó
// abre o "O que acontece depois?", que liga o passo novo no lugar certo. Abaixo de 64rem a paleta e o painel
// viram gavetas. Tudo salva sozinho depois de uma pausa; Testar salva antes e roda o fluxo com dados de
// exemplo, mandando os e-mails para quem testa.
export function AutomationEditor({ automation }: AutomationEditorProps) {
  return (
    <ReactFlowProvider>
      <Editor automation={automation} />
    </ReactFlowProvider>
  );
}

function Editor({ automation }: AutomationEditorProps) {
  const router = useRouter();
  const { toast } = useToast();
  const mobile = useMediaQuery(MOBILE_QUERY);
  const panelsInline = useMediaQuery(PANELS_QUERY);
  const { screenToFlowPosition, deleteElements, zoomIn, zoomOut, fitView, setViewport } = useReactFlow<FlowNodeType, Edge>();
  const canvasRef = useRef<HTMLDivElement>(null);

  const [name, setName] = useState(automation.name);
  const [description, setDescription] = useState(automation.description);
  const [status, setStatus] = useState<AutomationStatus>(automation.status);
  const [runs, setRuns] = useState<AutomationRun[]>(automation.runs);
  const [runCount, setRunCount] = useState(automation.runCount);
  const [lastRunAt, setLastRunAt] = useState(automation.lastRunAt);
  const [nodes, setNodes, onNodesChangeBase] = useNodesState<FlowNodeType>(toFlowNodes(automation.nodes));
  const [edges, setEdges, onEdgesChangeBase] = useEdgesState<Edge>(toFlowEdges(automation.edges));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [picking, setPicking] = useState<Picking | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  const logReady = useOpenedOnce(logOpen);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [replay, setReplay] = useState<Replay | null>(null);
  const replayToken = useRef(0);

  // O que mudou desde o último salvamento: cada mexida soma um, e o efeito de salvar espera a pausa. Mexer
  // também apaga a encenação do último teste, que já não vale para o fluxo novo.
  const [version, setVersion] = useState(0);
  const touch = useCallback(() => {
    setVersion((current) => current + 1);
    setReplay(null);
  }, []);
  const dirty = useRef(false);

  const hasTrigger = nodes.some((node) => isTrigger(node.data.kind));
  const selected = nodes.find((node) => node.id === selectedId) ?? null;

  const payload = useCallback((): SaveAutomationInput => ({ id: automation.id, name, description, ...fromFlow(nodes, edges) }), [automation.id, name, description, nodes, edges]);

  const save = useCallback(async () => {
    setSaveState("saving");
    const result = await callAction(saveAutomationAction(payload()));
    if (!result.ok) {
      setSaveState("error");
      toast({ title: "Não deu para salvar", description: result.error, tone: "danger" });
      return false;
    }
    dirty.current = false;
    setStatus(result.automation.status);
    setSaveState("saved");
    setSavedAt(format(new Date(), "HH:mm"));
    return true;
  }, [payload, toast]);

  useEffect(() => {
    if (version === 0) return;
    dirty.current = true;
    const timer = window.setTimeout(() => void save(), SAVE_PAUSE);
    return () => window.clearTimeout(timer);
  }, [version, save]);

  /* Mover, remover e ligar mexem no fluxo; escolher e medir, não. */
  const onNodesChange = useCallback(
    (changes: NodeChange<FlowNodeType>[]) => {
      onNodesChangeBase(changes);
      if (changes.some((change) => change.type === "remove" || (change.type === "position" && change.dragging === false))) touch();
    },
    [onNodesChangeBase, touch],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange<Edge>[]) => {
      onEdgesChangeBase(changes);
      if (changes.some((change) => change.type === "remove" || change.type === "add")) touch();
    },
    [onEdgesChangeBase, touch],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      setEdges((current) => addEdge({ ...connection, id: edgeId(connection.source, connection.target, connection.sourceHandle) }, current));
      touch();
    },
    [setEdges, touch],
  );

  const isValidConnection: IsValidConnection<Edge> = useCallback((connection) => connection.source !== connection.target, []);

  /* O enquadramento inicial: o fluxo inteiro quando cabe legível; quando é comprido demais para o quadro, o
     começo dele em tamanho de leitura, alinhado à esquerda, porque um fluxo encolhido até caber vira miniatura
     (medido em 2026-09-15: seis colunas cabiam a 0,3 de zoom, ilegíveis). */
  const frame = useCallback(() => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect || nodes.length === 0) return;
    const xs = nodes.map((node) => node.position.x);
    const ys = nodes.map((node) => node.position.y);
    const bounds = { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs) + NODE_HALF.x * 2, height: Math.max(...ys) - Math.min(...ys) + NODE_HALF.y * 2 };
    const fit = Math.min(1, (rect.width - 96) / bounds.width, (rect.height - 160) / bounds.height);
    if (fit >= READABLE_ZOOM) {
      void fitView({ padding: 0.35, maxZoom: 1 });
      return;
    }
    const zoom = READABLE_ZOOM;
    setViewport({ x: 48 - bounds.x * zoom, y: rect.height / 2 - (bounds.y + bounds.height / 2) * zoom, zoom });
  }, [nodes, fitView, setViewport]);

  const onSelectionChange = useCallback(({ nodes: picked }: OnSelectionChangeParams<FlowNodeType, Edge>) => setSelectedId(picked[0]?.id ?? null), []);

  /* Um lugar livre para o nó nascer: onde foi pedido, descendo uma linha enquanto houver outro nó em cima. */
  const freeSpot = useCallback(
    (wanted: { x: number; y: number }) => {
      const spot = { ...wanted };
      const taken = () => nodes.some((node) => Math.abs(node.position.x - spot.x) < 300 && Math.abs(node.position.y - spot.y) < 200);
      let guard = 0;
      while (taken() && guard < 20) {
        spot.y += 260;
        guard += 1;
      }
      return spot;
    },
    [nodes],
  );

  const centerSpot = useCallback(() => {
    const rect = canvasRef.current?.getBoundingClientRect();
    const center = rect ? screenToFlowPosition({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }) : { x: 0, y: 0 };
    return { x: center.x - NODE_HALF.x, y: center.y - NODE_HALF.y };
  }, [screenToFlowPosition]);

  /** Adiciona um nó: solto no lugar pedido, ou ligado à saída de outro, à direita dele. */
  const addNode = useCallback(
    (kind: NodeKind, at?: { x: number; y: number }, from?: Picking) => {
      if (isTrigger(kind) && hasTrigger) {
        toast({ title: "O fluxo já tem um gatilho", description: "Remova o gatilho atual para trocar por outro.", tone: "warning" });
        return;
      }
      const source = from?.from ? nodes.find((node) => node.id === from.from) : null;
      const wanted = source ? { x: source.position.x + NEXT_GAP, y: source.position.y + (from?.branch === "yes" ? -BRANCH_GAP : from?.branch === "no" ? BRANCH_GAP : 0) } : (at ?? centerSpot());
      const id = newId();
      const node: FlowNodeType = { id, type: "step", position: freeSpot(wanted), data: { kind, config: { ...nodeCatalog[kind].defaults } }, selected: true };
      setNodes((current) => [...current.map((entry) => ({ ...entry, selected: false })), node]);
      if (source) setEdges((current) => addEdge({ id: edgeId(source.id, id, from?.branch ?? "next"), source: source.id, target: id, sourceHandle: from?.branch ?? "next" }, current));
      setSelectedId(id);
      setPicking(null);
      setPaletteOpen(false);
      if (!panelsInline) setPanelOpen(true);
      touch();
    },
    [hasTrigger, nodes, centerSpot, freeSpot, setNodes, setEdges, panelsInline, toast, touch],
  );

  const updateConfig = useCallback(
    (id: string, patch: NodeConfig) => {
      setNodes((current) => current.map((node) => (node.id === id ? { ...node, data: { ...node.data, config: { ...node.data.config, ...patch } } } : node)));
      touch();
    },
    [setNodes, touch],
  );

  const renameNode = useCallback(
    (id: string, title: string) => {
      setNodes((current) => current.map((node) => (node.id === id ? { ...node, data: { ...node.data, title } } : node)));
      touch();
    },
    [setNodes, touch],
  );

  const removeNode = (id: string) => {
    void deleteElements({ nodes: [{ id }] });
    setSelectedId(null);
    setPanelOpen(false);
  };

  const removeSelected = () => {
    if (selectedId) removeNode(selectedId);
  };

  const editorActions = useMemo<EditorActions>(() => ({ pickNext: (from, branch) => setPicking({ from, branch }), rename: renameNode, configure: updateConfig }), [renameNode, updateConfig]);

  /* O quadro recebe os nós e as ligações vestidos com o estado da encenação; fora dela, os próprios. */
  const edgeClasses: Record<EdgeRunState, string> = { active: styles.edgeActive, done: styles.edgeDone, failed: styles.edgeFailed };
  const shownNodes = useMemo(() => (replay ? nodes.map((node) => (replay.nodes[node.id] ? { ...node, data: { ...node.data, run: replay.nodes[node.id] } } : node)) : nodes), [nodes, replay]);
  const shownEdges = useMemo(
    () =>
      replay
        ? edges.map((edge) => {
            const state = replay.edges[edge.id];
            return { ...edge, className: cx(styles.edge, state ? edgeClasses[state] : styles.edgeIdle), animated: state === "active" };
          })
        : edges,
    // eslint-disable-next-line react-hooks/exhaustive-deps -- as classes são constantes do módulo de estilo
    [edges, replay],
  );

  const onDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (!event.dataTransfer.types.includes(NODE_DRAG_TYPE)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    const kind = event.dataTransfer.getData(NODE_DRAG_TYPE) as NodeKind | "";
    if (!kind || !(kind in nodeCatalog)) return;
    event.preventDefault();
    const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
    addNode(kind, { x: position.x - NODE_HALF.x, y: position.y - NODE_HALF.y });
  };

  const changeMeta = (next: { name?: string; description?: string }) => {
    if (next.name !== undefined) setName(next.name);
    if (next.description !== undefined) setDescription(next.description);
    touch();
  };

  const toggle = async () => {
    setToggling(true);
    if (dirty.current && !(await save())) {
      setToggling(false);
      return;
    }
    const result = await callAction(setAutomationStatusAction({ id: automation.id, status: status === "active" ? "paused" : "active" }));
    setToggling(false);
    if (!result.ok) {
      toast({ title: "Não deu para ativar", description: result.error, tone: "danger" });
      return;
    }
    setStatus(result.automation.status);
    toast({ title: result.automation.status === "active" ? "Automação ativa" : "Automação pausada", description: result.automation.status === "active" ? "Ela roda sozinha a partir de agora." : "O fluxo fica guardado, mas não roda.", tone: result.automation.status === "active" ? "success" : "neutral" });
  };

  /* A execução encenada no quadro (a pedido): cada passo acende o card por um instante, a ligação que levou
     até ele muda de cor, e o card fica com o resultado (feito, falhou, pulado, em espera). Outro teste no meio
     cancela a encenação anterior. */
  const animateRun = useCallback(
    async (run: AutomationRun) => {
      const token = ++replayToken.current;
      const visited: string[] = [];
      let state: Replay = { nodes: {}, edges: {} };
      setReplay(state);
      for (const step of run.steps) {
        if (!step.nodeId) continue;
        const incoming = edges.filter((edge) => edge.target === step.nodeId && visited.includes(edge.source)).map((edge) => edge.id);
        state = { nodes: { ...state.nodes, [step.nodeId]: "running" }, edges: { ...state.edges, ...Object.fromEntries(incoming.map((id) => [id, "active" as EdgeRunState])) } };
        setReplay(state);
        await sleep(STEP_PAUSE);
        if (replayToken.current !== token) return;
        const settled: EdgeRunState = step.status === "failed" ? "failed" : "done";
        state = { nodes: { ...state.nodes, [step.nodeId]: step.status }, edges: { ...state.edges, ...Object.fromEntries(incoming.map((id) => [id, settled])) } };
        setReplay(state);
        visited.push(step.nodeId);
        await sleep(STEP_GAP);
        if (replayToken.current !== token) return;
      }
    },
    [edges],
  );

  const test = async () => {
    setTesting(true);
    if (dirty.current && !(await save())) {
      setTesting(false);
      return;
    }
    const result = await callAction(testAutomationAction({ id: automation.id }));
    if (!result.ok) {
      setTesting(false);
      toast({ title: "Não deu para testar", description: result.error, tone: "danger" });
      return;
    }
    setRuns(result.automation.runs);
    setRunCount(result.automation.runCount);
    setLastRunAt(result.automation.lastRunAt);
    setHighlight(result.run.id);
    setPanelOpen(false);
    await animateRun(result.run);
    setTesting(false);
    setLogOpen(true);
    toast({
      title: result.run.status === "failed" ? "O teste parou num passo" : "Teste concluído",
      description: result.run.status === "failed" ? "Veja no registro qual passo falhou e por quê." : "Os e-mails do fluxo foram para você, e não para o cliente.",
      tone: result.run.status === "failed" ? "warning" : "success",
    });
  };

  useFloatingActionsRegistration(
    mobile
      ? {
          primary: { label: testing ? "Testando" : "Testar", icon: <PlayIcon weight="bold" />, loading: testing, onClick: () => void test() },
          extras: [
            { label: "Adicionar passo", icon: <PlusIcon weight="bold" />, onClick: () => setPaletteOpen(true) },
            { label: selected ? "Configurar passo" : "Ajustes da automação", icon: <SlidersHorizontalIcon weight="bold" />, onClick: () => setPanelOpen(true) },
          ],
          cancel: { label: "Voltar às automações", onClick: () => router.push("/automacoes" as Route) },
        }
      : null,
  );

  const statusMeta = automationStatuses[status];
  const saveLabel = saveState === "saving" ? "Salvando" : saveState === "error" ? "Não salvou" : saveState === "saved" && savedAt ? `Salvo às ${savedAt}` : "Salvo";

  const details = (
    <div className={styles.details}>
      <Field label="Nome" required>
        <Input type="text" size="sm" value={name} maxLength={automationLimits.name} placeholder="Nome da automação" onChange={(event) => changeMeta({ name: event.target.value })} />
      </Field>
      <Field label="Descrição">
        <Textarea size="sm" rows={3} value={description} maxLength={automationLimits.description} placeholder="O que ela faz, em uma frase" onChange={(event) => changeMeta({ description: event.target.value })} />
      </Field>
      <div className={styles.facts}>
        <span className={styles.fact}>
          <Text as="span" variant="caption1" tone="secondary">
            Situação
          </Text>
          <Badge tone={statusMeta.tone} size="sm" icon={<statusMeta.icon />}>
            {statusMeta.label}
          </Badge>
        </span>
        <span className={styles.fact}>
          <Text as="span" variant="caption1" tone="secondary">
            Execuções
          </Text>
          <Text as="span" variant="footnote" weight="semibold">
            {runsLabel(runCount)}
            {lastRunAt ? `, última ${agoLabel(lastRunAt)}` : ""}
          </Text>
        </span>
      </div>
      <Button variant="outline" size="sm" radius="md" iconStart={<ClockCounterClockwiseIcon />} onClick={() => setLogOpen(true)}>
        Ver execuções
      </Button>
      <Text variant="caption1" tone="tertiary">
        {hasTrigger ? "Clique num passo do quadro para configurá-lo. O que muda aqui salva sozinho." : "Comece pelo gatilho: é ele que diz quando o fluxo roda."}
      </Text>
    </div>
  );

  const panel = selected ? <NodeConfigPanel key={selected.id} node={selected} onChange={(patch) => updateConfig(selected.id, patch)} onRename={(title) => renameNode(selected.id, title)} onRemove={() => removeNode(selected.id)} /> : details;

  const palette = <NodePalette onPick={(kind) => addNode(kind)} hasTrigger={hasTrigger} draggable={panelsInline} searchable />;

  return (
    <EditorActionsContext.Provider value={editorActions}>
      <div className={styles.editor}>
        <header className={styles.bar}>
          <IconButton label="Voltar às automações" variant="ghost" size="sm" href="/automacoes">
            <ArrowLeftIcon />
          </IconButton>
          <nav className={styles.crumbs} aria-label="Onde a automação mora">
            <Link href="/automacoes" className={styles.crumb}>
              Automações
            </Link>
            <span className={styles.slash} aria-hidden="true">
              /
            </span>
            <input className={styles.nameInput} type="text" value={name} maxLength={automationLimits.name} aria-label="Nome da automação" placeholder="Nome da automação" onChange={(event) => changeMeta({ name: event.target.value })} />
            <Badge tone={statusMeta.tone} size="sm" icon={<statusMeta.icon />} className={styles.statusBadge}>
              {statusMeta.label}
            </Badge>
          </nav>
          <Text as="span" variant="caption1" tone={saveState === "error" ? "danger" : "secondary"} className={styles.saveState} role="status">
            {saveLabel}
          </Text>
          <div className={styles.barActions}>
            <Switch size="sm" checked={status === "active"} disabled={toggling} onChange={() => void toggle()}>
              <span className={styles.switchLabel}>Ativa</span>
            </Switch>
            <IconButton label="Execuções" variant="outline" size="sm" radius="md" onClick={() => setLogOpen(true)}>
              <ClockCounterClockwiseIcon />
            </IconButton>
            <span className={styles.wide}>
              <Button size="sm" radius="md" iconStart={<PlayIcon />} loading={testing} onClick={() => void test()}>
                {testing ? "Testando" : "Testar"}
              </Button>
            </span>
          </div>
        </header>

        <div className={styles.work}>
          {panelsInline && (
            <aside className={styles.side} aria-label="Passos disponíveis">
              <Text as="h2" variant="subheadline" weight="semibold">
                Passos
              </Text>
              <Text variant="caption1" tone="secondary">
                Clique para adicionar, ou arraste até o quadro.
              </Text>
              {palette}
            </aside>
          )}

          <section ref={canvasRef} className={styles.canvas} aria-label="Quadro do fluxo">
            <ReactFlow<FlowNodeType, Edge>
              onDragOver={onDragOver}
              onDrop={onDrop}
              nodes={shownNodes}
              edges={shownEdges}
              nodeTypes={nodeTypes}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onSelectionChange={onSelectionChange}
              onNodeClick={() => !panelsInline && setPanelOpen(true)}
              onPaneClick={() => setReplay(null)}
              isValidConnection={isValidConnection}
              onInit={frame}
              minZoom={0.3}
              maxZoom={1.6}
              snapToGrid
              snapGrid={[10, 10]}
              deleteKeyCode={["Backspace", "Delete"]}
              defaultEdgeOptions={{ type: "default" }}
              connectionRadius={28}
              zoomOnDoubleClick={false}
            >
              <Background variant={BackgroundVariant.Dots} gap={22} size={1.5} />
            </ReactFlow>

            {nodes.length === 0 && (
              <div className={styles.emptyCanvas}>
                <LightningIcon className={styles.emptyGlyph} weight="duotone" aria-hidden="true" />
                <Text variant="callout" weight="semibold">
                  Comece pelo gatilho
                </Text>
                <Text variant="footnote" tone="secondary">
                  É ele que diz quando a automação roda: um contrato assinado, uma cobrança perto de vencer, um horário.
                </Text>
                <Button size="sm" radius="md" iconStart={<PlusIcon />} onClick={() => setPicking({ from: null, branch: null })}>
                  Escolher o gatilho
                </Button>
              </div>
            )}

            <div className={styles.dock} role="toolbar" aria-label="Ferramentas do quadro">
              <IconButton label="Afastar" variant="ghost" size="sm" radius="md" onClick={() => void zoomOut()}>
                <MagnifyingGlassMinusIcon />
              </IconButton>
              <IconButton label="Aproximar" variant="ghost" size="sm" radius="md" onClick={() => void zoomIn()}>
                <MagnifyingGlassPlusIcon />
              </IconButton>
              <IconButton label="Enquadrar o fluxo" variant="ghost" size="sm" radius="md" onClick={() => void fitView({ padding: 0.3, maxZoom: 1, duration: 300 })}>
                <CornersOutIcon />
              </IconButton>
              <span className={styles.dockRule} aria-hidden="true" />
              <IconButton label="Adicionar passo" variant="ghost" size="sm" radius="md" onClick={() => (panelsInline ? setPicking({ from: null, branch: null }) : setPaletteOpen(true))}>
                <PlusIcon />
              </IconButton>
              <IconButton label="Remover o passo escolhido" variant="ghost" size="sm" radius="md" disabled={!selected} onClick={removeSelected}>
                <TrashIcon />
              </IconButton>
            </div>
          </section>

          {panelsInline && (
            <aside className={styles.side} aria-label={selected ? "Passo escolhido" : "A automação"}>
              {panel}
            </aside>
          )}
        </div>

        {/* Abaixo de 64rem a paleta e o painel são gavetas. */}
        <Dialog open={!panelsInline && paletteOpen} onClose={() => setPaletteOpen(false)} label="Adicionar passo" size="md" placement="end" scrim={mobile} focusOnOpen={false}>
          <PanelSheet title="Adicionar passo" onClose={() => setPaletteOpen(false)}>
            {palette}
          </PanelSheet>
        </Dialog>
        <Dialog open={!panelsInline && panelOpen} onClose={() => setPanelOpen(false)} label={selected ? "Passo escolhido" : "A automação"} size="md" placement="end" scrim={mobile} focusOnOpen={false}>
          <PanelSheet title={selected ? selected.data.title?.trim() || nodeCatalog[selected.data.kind].label : "A automação"} onClose={() => setPanelOpen(false)}>
            {panel}
          </PanelSheet>
        </Dialog>

        {/* "O que acontece depois?": o passo novo já nasce ligado à saída de onde veio. */}
        <Dialog open={picking !== null} onClose={() => setPicking(null)} label="O que acontece depois?" size="md" focusOnOpen={false}>
          <PanelSheet title={picking?.from ? "O que acontece depois?" : hasTrigger ? "Adicionar passo" : "Como o fluxo começa?"} onClose={() => setPicking(null)}>
            <NodePalette onPick={(kind) => addNode(kind, undefined, picking ?? undefined)} only={picking?.from ? "steps" : hasTrigger ? undefined : "trigger"} hasTrigger={hasTrigger} searchable />
          </PanelSheet>
        </Dialog>

        {logReady && (
          <RunLogDialog open={logOpen} onClose={() => setLogOpen(false)} name={name} runs={runs} highlight={highlight} />
        )}
      </div>
    </EditorActionsContext.Provider>
  );
}

/* Um painel virado gaveta: o título com o X e o conteúdo rolando. */
function PanelSheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useFloatingActionsRegistration({ cancel: { label: "Fechar", onClick: onClose } });
  return (
    <div className={styles.drawer}>
      <header className={styles.drawerHead}>
        <Text as="h2" variant="headline" weight="semibold">
          {title}
        </Text>
        <IconButton label="Fechar" variant="ghost" size="sm" onClick={onClose}>
          <XIcon />
        </IconButton>
      </header>
      <div className={styles.drawerBody}>{children}</div>
    </div>
  );
}
