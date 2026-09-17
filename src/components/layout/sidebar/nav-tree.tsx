"use client";

import {
  BinocularsIcon,
  BuildingsIcon,
  FolderIcon,
  FolderOpenIcon,
  FunnelIcon,
  GlobeIcon,
  HandshakeIcon,
  KanbanIcon,
  MegaphoneIcon,
  PaletteIcon,
  StorefrontIcon,
  TargetIcon,
  TrayIcon,
  type Icon,
} from "@phosphor-icons/react";
import type { Route } from "next";
import Link from "next/link";
import { useState, type CSSProperties } from "react";
import { Badge } from "@/components/ui/badge";
import type { CrmTreeItem } from "@/features/crm/tree";
import type { TaskTreeItem } from "@/features/tasks/tree";
import { squircle } from "@/lib/corners";
import { cx } from "@/lib/utils/cx";
import styles from "./sidebar.module.css";
import tree from "./nav-tree.module.css";

/**
 * A árvore de um domínio dentro do menu (2026-09-10, a pedido, sobre uma referência de árvore do usuário;
 * generalizada em 2026-09-15, quando o funil de vendas ganhou a mesma arquitetura): pastas que abrem e
 * fecham, folhas que levam ao quadro delas, e a contagem do que está em aberto na ponta direita de cada
 * linha. As linhas vestem a pele das linhas do menu, então a árvore não parece outra coisa colada ali; o que
 * ela acrescenta é o degrau de recuo, o cotovelo que liga o filho ao pai e o azulejo de cada folha.
 *
 * Pasta não é destino: ela não tem endereço, e clicar nela abre e fecha o galho. Quem abriu se mostra no
 * próprio glifo, aberto ou fechado, como na referência, e no `aria-expanded` do botão.
 *
 * É **uma peça só para os dois domínios**: tarefas e funil têm a mesma arquitetura, e o que muda entre eles é
 * o endereço da folha, o glifo dela e o nome do grupo. Duas cópias divergiriam no primeiro acerto de
 * cotovelo, que é a parte difícil daqui.
 */

/** A forma que a árvore desenha, sem domínio nenhum: a folha é o que tem endereço. */
export type NavTreeItem =
  | { kind: "folder"; id: string; name: string; open: number; children: NavTreeItem[] }
  | { kind: "leaf"; id: string; slug: string; name: string; open: number; glyph: string; hue: string };

export type NavTreeProps = {
  items: NavTreeItem[];
  /** De onde saem os endereços das folhas: `/tarefas` ou `/crm`. */
  basePath: string;
  /** O slug da folha aberta, para a linha dela ficar marcada. */
  current?: string;
  /** As pastas que nascem abertas: o caminho até onde a pessoa está. */
  openFolders: string[];
  /** O nome do grupo para leitor de tela, como "Pastas e projetos". */
  label: string;
  /** Chamado ao escolher uma folha: na tela cheia do celular, fecha o menu. */
  onNavigate?: () => void;
};

/**
 * A chave do glifo vira o desenho aqui, e não na árvore: ela é montada no servidor e o menu é componente de
 * cliente, então o que atravessa é a chave. Os dois domínios dividem o mapa porque as chaves não se
 * atropelam, e chave desconhecida cai na bandeja, que é o glifo do balde.
 */
const glyphs: Record<string, Icon> = {
  kanban: KanbanIcon,
  palette: PaletteIcon,
  globe: GlobeIcon,
  storefront: StorefrontIcon,
  megaphone: MegaphoneIcon,
  binoculars: BinocularsIcon,
  funnel: FunnelIcon,
  handshake: HandshakeIcon,
  target: TargetIcon,
  buildings: BuildingsIcon,
  tray: TrayIcon,
};

/** A árvore das tarefas na forma que o menu desenha: o projeto é a folha. */
export const fromTaskTree = (items: TaskTreeItem[]): NavTreeItem[] =>
  items.map((item) =>
    item.kind === "folder"
      ? { kind: "folder", id: item.id, name: item.name, open: item.open, children: fromTaskTree(item.children) }
      : { kind: "leaf", id: item.id, slug: item.slug, name: item.name, open: item.open, glyph: item.glyph, hue: item.hue },
  );

/** A árvore do funil na mesma forma: o funil é a folha. */
export const fromCrmTree = (items: CrmTreeItem[]): NavTreeItem[] =>
  items.map((item) =>
    item.kind === "folder"
      ? { kind: "folder", id: item.id, name: item.name, open: item.open, children: fromCrmTree(item.children) }
      : { kind: "leaf", id: item.id, slug: item.slug, name: item.name, open: item.open, glyph: item.glyph, hue: item.hue },
  );

export function NavTree({ items, basePath, current, openFolders, label, onNavigate }: NavTreeProps) {
  // As pastas do caminho até onde a pessoa está nascem abertas, e daí em diante quem manda é o clique. O
  // estado é da sessão de propósito: guardar em cookie faria o menu abrir num galho e o servidor mandar
  // outro, e a árvore piscaria na hidratação.
  const [open, setOpen] = useState<string[]>(openFolders);

  const toggle = (id: string) => setOpen((entries) => (entries.includes(id) ? entries.filter((entry) => entry !== id) : [...entries, id]));

  /* O nó está na rota quando é a folha aberta ou uma pasta que leva até ela. Sai de `openFolders`, que é o
     caminho calculado do endereço, e não do estado de abrir e fechar. */
  const onRoute = (node: NavTreeItem) => (node.kind === "folder" ? openFolders.includes(node.id) : node.slug === current);

  /* Cada filho é um galho, e o último da fila fecha o fio em L em vez de deixá-lo seguir para baixo. */
  const limbs = (nodes: NavTreeItem[]) =>
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

  const folder = (node: Extract<NavTreeItem, { kind: "folder" }>) => {
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

  const link = (node: Extract<NavTreeItem, { kind: "leaf" }>) => {
    const Glyph = glyphs[node.glyph] ?? TrayIcon;
    const hue = { "--project-hue": node.hue } as CSSProperties;

    return (
      <Link
        href={`${basePath}/${node.slug}` as Route}
        className={cx(styles.row, tree.node)}
        data-active={node.slug === current || undefined}
        onClick={onNavigate}
        {...squircle("md")}
      >
        {/* O azulejo no matiz da folha: é o que faz cada quadro ser reconhecido antes de o nome ser lido. A
            pasta segue com o glifo solto, porque ela é o caminho, e não o destino. */}
        <span className={cx(tree.mark, tree.tile)} style={hue} aria-hidden="true" {...squircle("sm", { clip: true })}>
          <Glyph weight="bold" />
        </span>
        <span className={styles.label}>{node.name}</span>
        {/* A contagem no matiz da folha: ela e o azulejo leem como a mesma identidade, e a fila de números
            deixa de ser uma coluna de cinza igual. A pasta segue neutra, porque soma matizes diferentes. */}
        {node.open > 0 && (
          <Badge hue={node.hue} size="sm" className={tree.count}>
            {node.open}
          </Badge>
        )}
      </Link>
    );
  };

  return (
    <div className={tree.tree} role="group" aria-label={label}>
      {/* A raiz não tem cotovelo: ela não pende de ninguém. */}
      {items.map((node) => (
        <div key={node.id} className={tree.root}>
          {node.kind === "folder" ? folder(node) : link(node)}
        </div>
      ))}
    </div>
  );
}
