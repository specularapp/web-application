"use client";

import "@xyflow/react/dist/style.css";
import {
  AddressBookIcon,
  BriefcaseIcon,
  CornersOutIcon,
  FileTextIcon,
  HandCoinsIcon,
  MagnifyingGlassMinusIcon,
  MagnifyingGlassPlusIcon,
  ReceiptIcon,
  TreeStructureIcon,
  TrendUpIcon,
  XIcon,
  type Icon,
} from "@phosphor-icons/react";
import { Background, BackgroundVariant, Handle, Position, ReactFlow, ReactFlowProvider, useEdgesState, useNodesState, useReactFlow, type Edge, type Node, type NodeProps } from "@xyflow/react";
import type { Route } from "next";
import Link from "next/link";
import { memo, useEffect, useMemo, useState, type CSSProperties } from "react";
import { StoredImage } from "@/components/ui/stored-image";
import { useFloatingActionsRegistration } from "@/components/layout/floating-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { IconButton } from "@/components/ui/icon-button";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { usePlanGate } from "@/features/billing/components/plan-gate";
import { rounded } from "@/lib/corners";
import { loadClientRelationsAction, type RelationLoad } from "../actions";
import type { RelationKind, RelationMap, RelationNode } from "../relations";
import styles from "./relation-map-dialog.module.css";

export type RelationMapDialogProps = {
  open: boolean;
  onClose: () => void;
  /** De quem é o mapa. Hoje só cliente tem um; o desenho já serve a qualquer raiz. */
  clientId: string;
  name: string;
};

/** Como cada tipo se mostra no mapa: o glifo e o matiz, os mesmos do azulejo daquele domínio na casa. */
const kinds: Record<RelationKind, { label: string; icon: Icon; hue: string }> = {
  client: { label: "Cliente", icon: AddressBookIcon, hue: "var(--sys-teal)" },
  opportunity: { label: "Oportunidade", icon: TrendUpIcon, hue: "var(--sys-pink)" },
  quote: { label: "Orçamento", icon: ReceiptIcon, hue: "var(--sys-orange)" },
  project: { label: "Projeto", icon: BriefcaseIcon, hue: "var(--sys-indigo)" },
  contract: { label: "Contrato", icon: FileTextIcon, hue: "var(--sys-purple)" },
  charge: { label: "Cobrança", icon: HandCoinsIcon, hue: "var(--sys-green)" },
};

/** A medida de uma coluna do mapa: a largura do card (15,5rem) e o vão por onde a ligação passa. */
const COL = 344;
/** O vão entre dois cards empilhados na mesma coluna. */
const GAP = 36;

/**
 * A altura que o card vai ter, pelo que ele mostra (2026-10-27, correção: "o mapa está deixando os cards tudo
 * grudado"). Com uma altura fixa por linha, o card com campos era mais alto que a linha e encostava no de baixo;
 * agora cada um ocupa o que mede, e o vão entre eles é sempre o mesmo. As medidas são as do CSS do card: o topo
 * com o círculo, o nome e o código, e cada linha de campo depois do fio.
 */
const heightOf = (node: RelationNode) => {
  const base = 24 + 32 + 8 + 20 + (node.reference ? 17 : 0);
  const fields = node.fields?.length ?? 0;
  return base + (fields > 0 ? 16 + 1 + fields * 19 : 0);
};

type MapNodeData = { relation: RelationNode; root: boolean; leaf: boolean };
type MapNodeType = Node<MapNodeData, "record">;

/**
 * O mapa de relação de um cliente: tudo o que se liga a ele, desenhado como mapa mental.
 *
 * É o **mesmo motor** do editor de automação, e não uma segunda biblioteca de diagrama: o React Flow já está
 * na casa, já sabe arrastar, aproximar e enquadrar, e o que muda entre os dois é o nó e o fato de aqui nada
 * se editar. Uma segunda biblioteca só para desenhar caixas ligadas seria peso repetido no pacote.
 *
 * A raiz fica à esquerda e cada nível cresce para a direita; a árvore é arrumada de baixo para cima, com o
 * pai centrado entre o primeiro e o último filho, que é o que dá a leitura de mapa mental em vez de lista.
 */
export function RelationMapDialog({ open, onClose, clientId, name }: RelationMapDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} label={`Mapa de relação de ${name}`} size="xl">
      <ReactFlowProvider>
        <RelationCanvas clientId={clientId} name={name} onClose={onClose} />
      </ReactFlowProvider>
    </Dialog>
  );
}

function RelationCanvas({ clientId, name, onClose }: Omit<RelationMapDialogProps, "open">) {
  /** A queda de rede ou do servidor, à parte da resposta da action: `RelationLoad` é o contrato do
   *  servidor, e "sem acesso" não é o que aconteceu aqui, então não se fabrica um `reason` para isso. */
  const [attempt, setAttempt] = useState(0);
  const requestKey = `${clientId}:${attempt}`;
  const [request, setRequest] = useState<{
    key: string;
    load: RelationLoad | null;
    failed: boolean;
  }>({ key: requestKey, load: null, failed: false });
  const { zoomIn, zoomOut, fitView } = useReactFlow<MapNodeType, Edge>();
  const gate = usePlanGate();

  useFloatingActionsRegistration({ cancel: { label: "Fechar", onClick: onClose } });

  useEffect(() => {
    let alive = true;

    void loadClientRelationsAction({ clientId })
      .then((result) => {
        if (alive) setRequest({ key: requestKey, load: result, failed: false });
      })
      .catch(() => {
        if (alive) setRequest({ key: requestKey, load: null, failed: true });
      });

    return () => {
      alive = false;
    };
  }, [clientId, requestKey]);

  const load = request.key === requestKey ? request.load : null;
  const failed = request.key === requestKey && request.failed;

  const map: RelationMap | null = load?.ok ? load.map : null;
  const graph = useMemo(() => (map ? toFlow(map) : null), [map]);
  const linked = graph ? graph.nodes.length - 1 : 0;

  /* O React Flow só move o nó se quem manda os nós guardar a posição de volta (2026-09-17, a pedido de poder
     arrastar): com a lista vinda direto do `useMemo`, cada movimento era desenhado e desfeito no mesmo quadro.
     O estado nasce da arrumação automática e passa a ser da pessoa a partir do primeiro arraste. */
  const [nodes, setNodes, onNodesChange] = useNodesState<MapNodeType>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  useEffect(() => {
    setNodes(graph?.nodes ?? []);
    setEdges(graph?.edges ?? []);
  }, [graph, setNodes, setEdges]);

  /* Quantos de cada tipo o mapa tem, para a legenda do pé dizer o que está no quadro e em que cor. */
  const legend = map
    ? (Object.keys(kinds) as RelationKind[])
        .map((kind) => ({ kind, count: [map.root, ...map.nodes].filter((node) => node.kind === kind).length }))
        .filter((entry) => entry.count > 0)
    : [];

  return (
    <div className={styles.dialog}>
      {/* A janela inteira é o mapa (2026-10-27, a pedido: "remova esse header e deixe apenas o X"): o título
          fica só para o leitor de tela, e o fechar flutua na quina. */}
      <h2 className={styles.srOnly}>{linked > 0 ? `Mapa de relação de ${name}, com ${linked} ${linked === 1 ? "registro ligado" : "registros ligados"}` : `Mapa de relação de ${name}`}</h2>
      <span className={styles.close}>
        <IconButton label="Fechar o mapa" variant="ghost" size="sm" onClick={onClose}>
          <XIcon />
        </IconButton>
      </span>

      <div className={styles.canvas}>
        {failed ? (
          <div className={styles.center}>
            <EmptyState
              icon={TreeStructureIcon}
              size="sm"
              title="Não deu para carregar o mapa"
              description="Não foi possível falar com o servidor. Confira a conexão e tente de novo."
            >
              <Button size="sm" radius="md" onClick={() => setAttempt((value) => value + 1)}>
                Tentar de novo
              </Button>
            </EmptyState>
          </div>
        ) : load === null ? (
          <div className={styles.center}>
            <Spinner label="Montando o mapa" />
          </div>
        ) : !load.ok ? (
          <div className={styles.center}>
            <EmptyState
              icon={TreeStructureIcon}
              size="sm"
              title={load.reason === "plan" ? "O mapa de relação é do plano Pro" : "Sem acesso a este mapa"}
              description={
                load.reason === "plan"
                  ? "Ele cruza orçamentos, projetos, contratos e cobranças de uma vez para mostrar o que se liga ao quê."
                  : "Peça a quem administra o time para liberar o seu acesso a este cliente."
              }
            >
              {load.reason === "plan" && (
                <Button size="sm" radius="md" onClick={() => gate.require("pro")}>
                  Ver planos
                </Button>
              )}
            </EmptyState>
          </div>
        ) : !graph || graph.nodes.length <= 1 ? (
          <div className={styles.center}>
            <EmptyState
              icon={TreeStructureIcon}
              size="sm"
              title="Nada ligado a este cliente ainda"
              description="Orçamentos, projetos, contratos e cobranças feitos para ele aparecem aqui, ligados entre si."
            />
          </div>
        ) : (
          <>
            <ReactFlow<MapNodeType, Edge>
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              nodeTypes={nodeTypes}
              /* Arrastar o nó é da pessoa (2026-09-17, a pedido): a arrumação automática é um ponto de
                 partida, e quem lê o mapa quer aproximar o que compara. Ligar um nó a outro continua fora:
                 a ligação é do dado, e não do desenho. */
              nodesDraggable
              nodesConnectable={false}
              elementsSelectable
              minZoom={0.2}
              maxZoom={1.6}
              zoomOnDoubleClick={false}
              fitView
              fitViewOptions={{ padding: 0.18, maxZoom: 1 }}
            >
              <Background variant={BackgroundVariant.Dots} gap={20} size={1.25} />
            </ReactFlow>

            {/* Aproximar, afastar e enquadrar numa coluna na borda direita, como nos quadros de referência. */}
            <div className={styles.dock} role="toolbar" aria-label="Ferramentas do mapa">
              <IconButton label="Aproximar" variant="ghost" size="sm" radius="md" onClick={() => void zoomIn()}>
                <MagnifyingGlassPlusIcon />
              </IconButton>
              <IconButton label="Afastar" variant="ghost" size="sm" radius="md" onClick={() => void zoomOut()}>
                <MagnifyingGlassMinusIcon />
              </IconButton>
              <IconButton label="Enquadrar o mapa" variant="ghost" size="sm" radius="md" onClick={() => void fitView({ padding: 0.18, maxZoom: 1, duration: 300 })}>
                <CornersOutIcon />
              </IconButton>
            </div>

            {/* A legenda no pé: cada tipo que está no quadro, na cor dele, com quantos há. */}
            <ul className={styles.legend} aria-label="O que está no mapa">
              {legend.map(({ kind, count }) => {
                const meta = kinds[kind];
                return (
                  <li key={kind} style={{ "--node-hue": meta.hue } as CSSProperties}>
                    <span className={styles.legendDot} aria-hidden="true" />
                    {meta.label}
                    <span className={styles.legendCount}>{count}</span>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * A árvore arrumada: cada folha ocupa uma linha, e cada pai fica centrado entre o primeiro e o último filho.
 * É a arrumação clássica de mapa mental, e a razão de o serviço garantir **um pai por nó**: com dois pais a
 * conta não fecha e o desenho vira teia.
 */
function toFlow(map: RelationMap) {
  const all = [map.root, ...map.nodes];
  const childrenOf = new Map<string, string[]>();

  for (const edge of map.edges) {
    const list = childrenOf.get(edge.from);
    if (list) list.push(edge.to);
    else childrenOf.set(edge.from, [edge.to]);
  }

  const byId = new Map(all.map((node) => [node.id, node]));
  const placed = new Map<string, { x: number; y: number }>();
  /* Onde a próxima folha começa: cada uma desce o que mede mais o vão. */
  let cursor = 0;

  /* Devolve o centro do card na vertical, que é o que o pai usa para se centrar entre os filhos. */
  const place = (id: string, depth: number): number => {
    const height = heightOf(byId.get(id) ?? map.root);
    /* Trava contra ciclo: o serviço monta árvore, mas um dado torto não pode travar a tela. */
    const seen = placed.get(id);
    if (seen) return seen.y + height / 2;

    const children = childrenOf.get(id) ?? [];
    placed.set(id, { x: depth * COL, y: 0 });

    let center: number;
    if (children.length === 0) {
      center = cursor + height / 2;
      cursor += height + GAP;
    } else {
      const centers = children.map((child) => place(child, depth + 1));
      center = (centers[0] + centers[centers.length - 1]) / 2;
    }

    placed.set(id, { x: depth * COL, y: center - height / 2 });
    return center;
  };

  place(map.root.id, 0);

  const nodes: MapNodeType[] = all
    .filter((node) => placed.has(node.id))
    .map((node) => ({
      id: node.id,
      type: "record" as const,
      position: placed.get(node.id)!,
      data: { relation: node, root: node.id === map.root.id, leaf: (childrenOf.get(node.id) ?? []).length === 0 },
    }));

  const kindOf = new Map(all.map((node) => [node.id, node.kind]));

  /* A ligação pontilhada e de curva arredondada, na cor do registro a que ela chega, com o nome da ligação numa
     pílula no meio, como nos quadros de referência (2026-10-27). */
  const edges: Edge[] = map.edges.map((edge) => {
    const hue = kinds[kindOf.get(edge.to) ?? "client"].hue;
    return {
      id: edge.id,
      source: edge.from,
      target: edge.to,
      label: edge.label,
      type: "smoothstep",
      pathOptions: { borderRadius: 20, offset: 24 },
      style: { stroke: `color-mix(in oklab, ${hue} 75%, var(--color-label-tertiary))`, strokeWidth: 2, strokeDasharray: "0.5 6", strokeLinecap: "round" },
      labelStyle: { fill: "var(--color-label)", fontWeight: 600 },
      labelBgStyle: { fill: `color-mix(in oklab, ${hue} 22%, var(--color-bg-grouped-secondary))`, stroke: `color-mix(in oklab, ${hue} 45%, transparent)`, strokeWidth: 1 },
      labelBgPadding: [8, 4] as [number, number],
      labelBgBorderRadius: 6,
    };
  });

  return { nodes, edges };
}

// Um registro no mapa (refeito em 2026-10-27, a pedido: "melhore os cards e deixe mais otimizado", sobre os
// quadros de referência): no topo a imagem ou o glifo num círculo no matiz do domínio, o tipo em caixa alta e a
// situação na ponta; o nome e o código embaixo; e os campos do registro em linhas curtas, separados por um fio. A
// borda é a do matiz do domínio, cheia na raiz; as alças são os pontos onde a ligação encosta. O card inteiro é o
// link para a tela do registro. Memorizado porque o React Flow redesenha os nós a cada movimento.
const MapNode = memo(function MapNode({ data }: NodeProps<MapNodeType>) {
  const { relation, root, leaf } = data;
  const kind = kinds[relation.kind];

  const body = (
    <>
      <span className={styles.nodeHead}>
        {relation.imageUrl ? (
          <StoredImage src={relation.imageUrl} alt="" width={32} height={32} className={styles.nodePhoto} />
        ) : (
          <span className={styles.nodeGlyph} aria-hidden="true">
            <kind.icon weight="duotone" />
          </span>
        )}
        <span className={styles.nodeKind}>{kind.label}</span>
        {relation.status && (
          <Badge tone={relation.status.tone} variant="soft" size="sm">
            {relation.status.label}
          </Badge>
        )}
      </span>

      <span className={styles.nodeCopy}>
        <Text as="span" variant="subheadline" weight="semibold" truncate>
          {relation.name}
        </Text>
        {relation.reference && <span className={styles.nodeReference}>{relation.reference}</span>}
      </span>

      {relation.fields && relation.fields.length > 0 && (
        <dl className={styles.nodeFields}>
          {relation.fields.map((field) => (
            <div key={field.label} className={styles.nodeField}>
              <dt>{field.label}</dt>
              <dd>{field.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </>
  );

  return (
    <div className={styles.node} data-root={root || undefined} style={{ "--node-hue": kind.hue } as CSSProperties} {...rounded("lg")}>
      {!root && <Handle type="target" position={Position.Left} className={styles.handle} isConnectable={false} />}

      {relation.href ? (
        <Link href={relation.href as Route} className={styles.nodeLink} aria-label={`Abrir ${kind.label.toLowerCase()} ${relation.name}`}>
          {body}
        </Link>
      ) : (
        <span className={styles.nodeLink}>{body}</span>
      )}

      {!leaf && <Handle type="source" position={Position.Right} className={styles.handle} isConnectable={false} />}
    </div>
  );
});

/* Declarado depois do nó, e não junto dos tipos: é um objeto montado na carga do módulo, e citar `MapNode`
   antes da linha que o define daria erro de zona morta. */
const nodeTypes = { record: MapNode };
