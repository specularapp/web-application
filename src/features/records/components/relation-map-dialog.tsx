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
import { squircle } from "@/lib/corners";
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

/** A medida de uma coluna do mapa e a altura de uma folha: é o que separa os níveis sem deixar fio cruzando.
 *  Cresceram com os campos do registro dentro do nó (2026-09-17): com a lista de campos o cartão ficou mais
 *  alto, e na medida antiga um nó encostava no de baixo. */
const COL = 340;
const ROW = 150;

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
  const [load, setLoad] = useState<RelationLoad | null>(null);
  const { zoomIn, zoomOut, fitView } = useReactFlow<MapNodeType, Edge>();
  const gate = usePlanGate();

  useFloatingActionsRegistration({ cancel: { label: "Fechar", onClick: onClose } });

  useEffect(() => {
    let alive = true;

    void loadClientRelationsAction({ clientId }).then((result) => {
      if (alive) setLoad(result);
    });

    return () => {
      alive = false;
    };
  }, [clientId]);

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

  return (
    <div className={styles.dialog}>
      <header className={styles.head}>
        <div className={styles.heading}>
          <Text as="h2" variant="headline" weight="semibold">
            Mapa de relação
          </Text>
          <Text variant="footnote" tone="secondary" truncate>
            {linked > 0 ? `${name}, com ${linked} ${linked === 1 ? "registro ligado" : "registros ligados"}` : name}
          </Text>
        </div>
        <IconButton label="Fechar" variant="ghost" size="sm" onClick={onClose}>
          <XIcon />
        </IconButton>
      </header>

      <div className={styles.canvas}>
        {load === null ? (
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
              fitViewOptions={{ padding: 0.2, maxZoom: 1 }}
            >
              <Background variant={BackgroundVariant.Dots} gap={22} size={1.5} />
            </ReactFlow>

            <div className={styles.dock} role="toolbar" aria-label="Ferramentas do mapa">
              <IconButton label="Afastar" variant="ghost" size="sm" radius="md" onClick={() => void zoomOut()}>
                <MagnifyingGlassMinusIcon />
              </IconButton>
              <IconButton label="Aproximar" variant="ghost" size="sm" radius="md" onClick={() => void zoomIn()}>
                <MagnifyingGlassPlusIcon />
              </IconButton>
              <IconButton label="Enquadrar o mapa" variant="ghost" size="sm" radius="md" onClick={() => void fitView({ padding: 0.2, maxZoom: 1, duration: 300 })}>
                <CornersOutIcon />
              </IconButton>
            </div>
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

  const placed = new Map<string, { x: number; y: number }>();
  let row = 0;

  const place = (id: string, depth: number): number => {
    /* Trava contra ciclo: o serviço monta árvore, mas um dado torto não pode travar a tela. */
    if (placed.has(id)) return placed.get(id)!.y;

    const children = childrenOf.get(id) ?? [];
    placed.set(id, { x: depth * COL, y: 0 });

    let y: number;
    if (children.length === 0) {
      y = row * ROW;
      row += 1;
    } else {
      const ys = children.map((child) => place(child, depth + 1));
      y = (ys[0] + ys[ys.length - 1]) / 2;
    }

    placed.set(id, { x: depth * COL, y });
    return y;
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

  const edges: Edge[] = map.edges.map((edge) => ({
    id: edge.id,
    source: edge.from,
    target: edge.to,
    label: edge.label,
    type: "smoothstep",
  }));

  return { nodes, edges };
}

// Um registro no mapa: o glifo no matiz do domínio, o identificador que a pessoa lê, o nome, a linha de
// apoio e a etiqueta da situação. O card inteiro é o link para a tela do registro, que é o que faz o mapa
// servir de navegação e não só de desenho. Memorizado porque o React Flow redesenha os nós a cada movimento.
const MapNode = memo(function MapNode({ data }: NodeProps<MapNodeType>) {
  const { relation, root, leaf } = data;
  const kind = kinds[relation.kind];

  const body = (
    <>
      <span className={styles.nodeHead}>
        {/* A imagem do registro quando ele tem uma (a logo da marca, a do projeto, a capa), e o glifo do
            domínio quando não tem: é o que deixa reconhecer o registro antes de ler o nome. */}
        {relation.imageUrl ? (
          <StoredImage src={relation.imageUrl} alt="" width={36} height={36} className={styles.nodePhoto} {...squircle("md", { clip: true })} />
        ) : (
          <span className={styles.nodeGlyph} aria-hidden="true" {...squircle("md")}>
            <kind.icon weight="duotone" />
          </span>
        )}
        <span className={styles.nodeCopy}>
          <span className={styles.nodeTop}>
            <Text as="span" variant="caption1" tone="secondary" truncate>
              {relation.reference ?? kind.label}
            </Text>
            {relation.status && (
              <Badge tone={relation.status.tone} variant="soft" size="sm">
                {relation.status.label}
              </Badge>
            )}
          </span>
          <Text as="span" variant="footnote" weight="semibold" truncate>
            {relation.name}
          </Text>
          <Text as="span" variant="caption2" tone="tertiary" truncate>
            {kind.label}
          </Text>
        </span>
      </span>

      {/* Os campos do registro, nomeados e um por linha: é o que responde "qual destes é o certo" sem abrir
          cada um, que era o que o mapa pedia para servir de ponto de partida (2026-09-17, a pedido). */}
      {relation.fields && relation.fields.length > 0 && (
        <dl className={styles.nodeFields}>
          {relation.fields.map((field) => (
            <div key={field.label} className={styles.nodeField}>
              <dt>
                <Text as="span" variant="caption2" tone="tertiary" truncate>
                  {field.label}
                </Text>
              </dt>
              <dd>
                <Text as="span" variant="caption1" weight="medium" truncate>
                  {field.value}
                </Text>
              </dd>
            </div>
          ))}
        </dl>
      )}
    </>
  );

  return (
    <div className={styles.node} data-root={root || undefined} style={{ "--node-hue": kind.hue } as CSSProperties} {...squircle("lg")}>
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
