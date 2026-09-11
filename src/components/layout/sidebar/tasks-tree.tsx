"use client";

import {
  BinocularsIcon,
  FolderIcon,
  FolderOpenIcon,
  GlobeIcon,
  KanbanIcon,
  MegaphoneIcon,
  PaletteIcon,
  StorefrontIcon,
  TrayIcon,
  type Icon,
} from "@phosphor-icons/react";
import type { Route } from "next";
import Link from "next/link";
import { useState, type CSSProperties } from "react";
import { Badge } from "@/components/ui/badge";
import type { ProjectGlyph, TaskTreeItem } from "@/features/tasks/tree";
import { squircle } from "@/lib/corners";
import { cx } from "@/lib/utils/cx";
import styles from "./sidebar.module.css";
import tree from "./tasks-tree.module.css";

export type TasksTreeProps = {
  items: TaskTreeItem[];
  /** O slug do projeto aberto, para a linha dele ficar marcada. */
  current?: string;
  /** As pastas que nascem abertas: o caminho até onde a pessoa está. */
  openFolders: string[];
  /** Chamado ao escolher um projeto: na tela cheia do celular, fecha o menu. */
  onNavigate?: () => void;
};

/**
 * A chave do glifo vira o desenho aqui, e não na árvore: ela é montada no servidor e o menu é componente de
 * cliente, então o que atravessa é a chave. Mesma receita do mapa de tipos de anexo.
 */
const glyphs: Record<ProjectGlyph, Icon> = {
  kanban: KanbanIcon,
  palette: PaletteIcon,
  globe: GlobeIcon,
  storefront: StorefrontIcon,
  megaphone: MegaphoneIcon,
  binoculars: BinocularsIcon,
  tray: TrayIcon,
};

// A arquitetura das tarefas dentro do menu (2026-09-10, a pedido, sobre uma referência de árvore do usuário):
// pastas que abrem e fecham, projetos que levam ao quadro deles, e a contagem do que está em aberto na ponta
// direita de cada linha. As linhas vestem a pele das linhas do menu, então a árvore não parece outra coisa
// colada ali; o que ela acrescenta é o degrau de recuo, o cotovelo que liga o filho ao pai e o azulejo de
// cada projeto.
//
// Pasta não é destino: ela não tem endereço, e clicar nela abre e fecha o galho. Quem abriu se mostra no
// próprio glifo, aberto ou fechado, como na referência, e no `aria-expanded` do botão: seta de abrir separada
// não entrou porque roubava o lugar em que o cotovelo encosta.
export function TasksTree({ items, current, openFolders, onNavigate }: TasksTreeProps) {
  // As pastas do caminho até onde a pessoa está nascem abertas, e daí em diante quem manda é o clique. O
  // estado é da sessão de propósito: guardar em cookie faria o menu abrir num galho e o servidor mandar
  // outro, e a árvore piscaria na hidratação.
  const [open, setOpen] = useState<string[]>(openFolders);

  const toggle = (id: string) => setOpen((current) => (current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]));

  /* O nó está na rota quando é o projeto aberto ou uma pasta que leva até ele. Sai de `openFolders`, que é o
     caminho calculado do endereço, e não do estado de abrir e fechar: a rota é a mesma esteja o galho aberto
     ou não. */
  const onRoute = (node: TaskTreeItem) => (node.kind === "folder" ? openFolders.includes(node.id) : node.slug === current);

  /* Cada filho é um galho, e o último da fila fecha o fio em L em vez de deixá-lo seguir para baixo. */
  const limbs = (nodes: TaskTreeItem[]) =>
    nodes.map((node, index) => (
      <div
        key={node.id}
        className={tree.limb}
        data-last={index === nodes.length - 1 || undefined}
        data-route={onRoute(node) || undefined}
      >
        {node.kind === "folder" ? folder(node) : link(node)}
      </div>
    ));

  const folder = (node: Extract<TaskTreeItem, { kind: "folder" }>) => {
    const expanded = open.includes(node.id);
    const Glyph = expanded ? FolderOpenIcon : FolderIcon;

    return (
      <>
        <button
          type="button"
          className={cx(styles.row, tree.node)}
          aria-expanded={expanded}
          onClick={() => toggle(node.id)}
          {...squircle("md")}
        >
          <span className={tree.mark} aria-hidden="true">
            <Glyph />
          </span>
          <span className={styles.label}>{node.name}</span>
          {node.open > 0 && (
            <Badge tone="neutral" size="sm" className={tree.count}>
              {node.open}
            </Badge>
          )}
        </button>
        {expanded && node.children.length > 0 && <div className={tree.children}>{limbs(node.children)}</div>}
      </>
    );
  };

  const link = (node: Extract<TaskTreeItem, { kind: "project" }>) => {
    const Glyph = glyphs[node.glyph];
    const hue = { "--project-hue": node.hue } as CSSProperties;

    return (
      <Link
        href={`/tarefas/${node.slug}` as Route}
        className={cx(styles.row, tree.node)}
        data-active={node.slug === current || undefined}
        onClick={onNavigate}
        {...squircle("md")}
      >
        {/* O azulejo no matiz do projeto: é o que faz cada quadro ser reconhecido antes de o nome ser lido.
            A pasta segue com o glifo solto, porque ela é o caminho, e não o destino. */}
        <span className={cx(tree.mark, tree.tile)} style={hue} aria-hidden="true" {...squircle("sm", { clip: true })}>
          <Glyph weight="bold" />
        </span>
        <span className={styles.label}>{node.name}</span>
        {/* A contagem no matiz do projeto (2026-09-10, a pedido): ela e o azulejo passam a ler como a mesma
            identidade, e a fila de números deixa de ser uma coluna de cinza igual. A pasta segue neutra,
            porque ela soma projetos de matizes diferentes e não tem cor própria. */}
        {node.open > 0 && (
          <Badge hue={node.hue} size="sm" className={tree.count}>
            {node.open}
          </Badge>
        )}
      </Link>
    );
  };

  return (
    <div className={tree.tree} role="group" aria-label="Pastas e projetos">
      {/* A raiz não tem cotovelo: ela não pende de ninguém. */}
      {items.map((node) => (
        <div key={node.id} className={tree.root}>
          {node.kind === "folder" ? folder(node) : link(node)}
        </div>
      ))}
    </div>
  );
}
