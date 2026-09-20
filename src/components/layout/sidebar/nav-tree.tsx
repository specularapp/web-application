"use client";

import {
  BinocularsIcon,
  BuildingsIcon,
  CaretDownIcon,
  FolderSimpleIcon,
  FolderIcon,
  FolderOpenIcon,
  FolderPlusIcon,
  FunnelIcon,
  GlobeIcon,
  HandshakeIcon,
  KanbanIcon,
  ListDashesIcon,
  MegaphoneIcon,
  PaletteIcon,
  PencilSimpleIcon,
  StorefrontIcon,
  TargetIcon,
  TrashIcon,
  TrayIcon,
  type Icon,
} from "@phosphor-icons/react";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type CSSProperties } from "react";
import { useToast } from "@/components/providers/toast-provider";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DropdownMenu, type DropdownSection } from "@/components/ui/dropdown-menu";
import { NameDialog } from "@/components/ui/name-dialog";
import { StagesDialog, type StageOption } from "@/components/ui/stages-dialog";
import { StoredImage } from "@/components/ui/stored-image";
import { deleteCrmFolderAction, deleteFunnelAction, moveFunnelAction, saveCrmFolderAction, saveFunnelAction, setFunnelStagesAction } from "@/features/crm/actions";
import { crmStages, type CrmStage } from "@/features/crm/stages";
import type { CrmTreeItem } from "@/features/crm/tree";
import { deleteFolderAction, moveProjectAction, saveFolderAction, setProjectStagesAction } from "@/features/projects/actions";
import { taskStages, type TaskStage } from "@/features/tasks/stages";
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
 * **O chevron no lugar da contagem** (2026-09-17, a pedido): ao passar o mouse na linha, a contagem dá lugar
 * a um chevron que abre o que se faz com aquele nó. Numa pasta: renomear, criar dentro dela, excluir. Num
 * projeto: editar a ficha e arrumar as etapas do quadro. Num funil: renomear, arrumar as etapas, excluir. É
 * o que deixa a arquitetura ser arrumada de onde ela é vista, em vez de obrigar a ir à página do domínio
 * para mexer numa pasta. No toque, sem hover, o chevron fica sempre à vista.
 *
 * É **uma peça só para os dois domínios**: tarefas e funil têm a mesma arquitetura, e o que muda entre eles é
 * o endereço da folha, o glifo dela, o nome do grupo e as ações que a tabela de cada um recebe. Duas cópias
 * divergiriam no primeiro acerto de cotovelo, que é a parte difícil daqui.
 */

/** A forma que a árvore desenha, sem domínio nenhum: a folha é o que tem endereço. */
export type NavTreeItem =
  | { kind: "folder"; id: string; name: string; open: number; children: NavTreeItem[] }
  | {
      kind: "leaf";
      id: string;
      slug: string;
      name: string;
      open: number;
      glyph: string;
      hue: string;
      /**
       * A cara da folha, quando ela tem uma: a logo do projeto, a do cliente ou o rosto dele. Veste o
       * azulejo no lugar do glifo, que é o que faz a linha ser reconhecida pela marca antes do nome. O funil
       * não tem imagem e segue no glifo.
       */
      imageUrl?: string | null;
      /** As etapas do quadro, na ordem das colunas: é o que a janela de etapas arruma. */
      stages: string[];
      /** O balde do que não tem pasta nem quadro próprio ("Sem funil"): não se edita nem se apaga. */
      bucket?: boolean;
    };

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
      : { kind: "leaf", id: item.id, slug: item.slug, name: item.name, open: item.open, glyph: item.glyph, hue: item.hue, imageUrl: item.imageUrl, stages: item.stages, bucket: item.bucket },
  );

/** A árvore do funil na mesma forma: o funil é a folha. */
export const fromCrmTree = (items: CrmTreeItem[]): NavTreeItem[] =>
  items.map((item) =>
    item.kind === "folder"
      ? { kind: "folder", id: item.id, name: item.name, open: item.open, children: fromCrmTree(item.children) }
      : { kind: "leaf", id: item.id, slug: item.slug, name: item.name, open: item.open, glyph: item.glyph, hue: item.hue, stages: item.stages, bucket: item.bucket },
  );

type Folder = Extract<NavTreeItem, { kind: "folder" }>;
type Leaf = Extract<NavTreeItem, { kind: "leaf" }>;

/** O que está aberto por cima da árvore: uma janela de nome, de etapas ou de confirmação, para um nó. */
type Opened =
  | { kind: "rename-folder"; node: Folder; parentId: string | null }
  | { kind: "new-folder"; parentId: string | null; parentName?: string }
  | { kind: "new-leaf"; parentId: string | null; parentName?: string }
  | { kind: "rename-leaf"; node: Leaf }
  | { kind: "stages"; node: Leaf }
  | { kind: "delete-folder"; node: Folder }
  | { kind: "delete-leaf"; node: Leaf };

export function NavTree({ items, basePath, current, openFolders, label, onNavigate }: NavTreeProps) {
  const router = useRouter();
  const { toast } = useToast();
  const domain = basePath === "/tarefas" ? "tarefas" : "funis";

  // As pastas do caminho até onde a pessoa está nascem abertas, e daí em diante quem manda é o clique. O
  // estado é da sessão de propósito: guardar em cookie faria o menu abrir num galho e o servidor mandar
  // outro, e a árvore piscaria na hidratação.
  const [open, setOpen] = useState<string[]>(openFolders);
  const [opened, setOpened] = useState<Opened | null>(null);
  const [working, setWorking] = useState(false);

  const toggle = (id: string) => setOpen((entries) => (entries.includes(id) ? entries.filter((entry) => entry !== id) : [...entries, id]));

  /* O nó está na rota quando é a folha aberta ou uma pasta que leva até ela. Sai de `openFolders`, que é o
     caminho calculado do endereço, e não do estado de abrir e fechar. */
  const onRoute = (node: NavTreeItem) => (node.kind === "folder" ? openFolders.includes(node.id) : node.slug === current);

  /* Cada escrita derruba o cache do domínio, que leva a concha junto na cascata; refazer a rota é o que traz
     a árvore nova para o menu sem recarregar a página. */
  const done = (title: string, description: string) => {
    toast({ title, description, tone: "success" });
  };

  /* --------------------------------------------- as ações --------------------------------------------- */

  const saveFolder = async (input: { id?: string; name: string; parentId: string | null }) => {
    const result = domain === "tarefas" ? await saveFolderAction(input) : await saveCrmFolderAction(input);
    if (!result.ok) return result.error;
    done(input.id ? "Pasta renomeada" : "Pasta criada", input.id ? `Agora ela se chama ${input.name}.` : `${input.name} já está na árvore.`);
    return undefined;
  };

  const saveLeaf = async (input: { id?: string; name: string; folderId: string | null }) => {
    /* Projeto novo nasce na página dele, com a ficha inteira; aqui só o funil, que precisa de um nome. */
    const result = await saveFunnelAction(input);
    if (!result.ok) return result.error;
    done(input.id ? "Funil renomeado" : "Funil criado", input.id ? `Agora ele se chama ${input.name}.` : `${input.name} já está na árvore.`);
    if (!input.id) router.push(`/crm/${result.slug}` as Route);
    return undefined;
  };

  const saveStages = async (node: Leaf, stages: string[]) => {
    const result =
      domain === "tarefas"
        ? await setProjectStagesAction({ id: node.id, stages: stages as TaskStage[] })
        : await setFunnelStagesAction({ id: node.id, stages: stages as CrmStage[] });
    if (!result.ok) return result.error;
    done("Etapas salvas", `O quadro de ${node.name} já está com as colunas novas.`);
    return undefined;
  };

  const remove = async () => {
    if (!opened || (opened.kind !== "delete-folder" && opened.kind !== "delete-leaf")) return;
    setWorking(true);
    const result =
      opened.kind === "delete-folder"
        ? domain === "tarefas"
          ? await deleteFolderAction(opened.node.id)
          : await deleteCrmFolderAction(opened.node.id)
        : await deleteFunnelAction(opened.node.id);
    setWorking(false);
    setOpened(null);

    if (!result.ok) {
      toast({ title: "Não deu para excluir", description: result.error, tone: "danger" });
      return;
    }

    done(
      opened.kind === "delete-folder" ? "Pasta excluída" : "Funil excluído",
      opened.kind === "delete-folder" ? "O que estava dentro voltou para a raiz." : "As oportunidades dele foram para o balde Sem funil.",
    );
  };

  /* Todas as pastas da árvore, achatadas com o caminho: é a lista do "Mover para". A árvore já as tem, então
     não há segunda leitura; e quem está numa pasta vê a raiz como destino também. */
  const folders = (nodes: NavTreeItem[], trail: string[] = []): { id: string; path: string }[] =>
    nodes.flatMap((node) =>
      node.kind === "folder" ? [{ id: node.id, path: [...trail, node.name].join(" / ") }, ...folders(node.children, [...trail, node.name])] : [],
    );
  const allFolders = folders(items);

  const moveLeaf = async (node: Leaf, folderId: string | null, where: string) => {
    const result = domain === "tarefas" ? await moveProjectAction({ id: node.id, folderId }) : await moveFunnelAction({ id: node.id, folderId });
    if (!result.ok) {
      toast({ title: "Não deu para mover", description: result.error, tone: "danger" });
      return;
    }
    done(domain === "tarefas" ? "Projeto movido" : "Funil movido", `${node.name} agora está em ${where}.`);
  };

  /* A seção "Mover para", igual para projeto e funil: as pastas da árvore mais a raiz. Só aparece quando há
     para onde: sem pasta nenhuma, a raiz é o único lugar e o nó já está lá. */
  const moveSection = (node: Leaf, parentId: string | null): DropdownSection[] =>
    allFolders.length > 0
      ? [
          {
            id: "move",
            label: "Mover para",
            items: [
              { id: "move-root", label: "Raiz", icon: FolderSimpleIcon, selected: parentId === null, onSelect: () => void moveLeaf(node, null, "raiz") },
              ...allFolders.map((folder) => ({
                id: `move-${folder.id}`,
                label: folder.path,
                icon: FolderIcon,
                selected: parentId === folder.id,
                onSelect: () => void moveLeaf(node, folder.id, folder.path),
              })),
            ],
          },
        ]
      : [];

  /* --------------------------------------------- os leques -------------------------------------------- */

  const folderSections = (node: Folder, parentId: string | null): DropdownSection[] => [
    {
      id: "edit",
      items: [{ id: "rename", label: "Renomear pasta", icon: PencilSimpleIcon, onSelect: () => setOpened({ kind: "rename-folder", node, parentId }) }],
    },
    {
      id: "create",
      label: "Criar dentro",
      items: [
        { id: "folder", label: "Nova pasta", icon: FolderPlusIcon, onSelect: () => setOpened({ kind: "new-folder", parentId: node.id, parentName: node.name }) },
        domain === "tarefas"
          ? { id: "leaf", label: "Novo projeto", icon: KanbanIcon, href: "/projetos/novo" as Route }
          : { id: "leaf", label: "Novo funil", icon: FunnelIcon, onSelect: () => setOpened({ kind: "new-leaf", parentId: node.id, parentName: node.name }) },
      ],
    },
    {
      id: "danger",
      items: [{ id: "delete", label: "Excluir pasta", icon: TrashIcon, tone: "danger", onSelect: () => setOpened({ kind: "delete-folder", node }) }],
    },
  ];

  const leafSections = (node: Leaf, parentId: string | null): DropdownSection[] =>
    domain === "tarefas"
      ? [
          {
            id: "edit",
            items: [
              { id: "edit", label: "Editar projeto", icon: PencilSimpleIcon, href: `/projetos/${node.id}/editar` as Route },
              { id: "stages", label: "Etapas do quadro", icon: ListDashesIcon, onSelect: () => setOpened({ kind: "stages", node }) },
            ],
          },
          ...moveSection(node, parentId),
        ]
      : [
          {
            id: "edit",
            items: [
              { id: "rename", label: "Renomear funil", icon: PencilSimpleIcon, onSelect: () => setOpened({ kind: "rename-leaf", node }) },
              { id: "stages", label: "Etapas do funil", icon: ListDashesIcon, onSelect: () => setOpened({ kind: "stages", node }) },
            ],
          },
          ...moveSection(node, parentId),
          {
            id: "danger",
            items: [{ id: "delete", label: "Excluir funil", icon: TrashIcon, tone: "danger", onSelect: () => setOpened({ kind: "delete-leaf", node }) }],
          },
        ];

  /* O chevron mora **ao lado** da linha, e não dentro dela: a linha é um botão ou um link, e botão dentro de
     botão não é HTML. Ele ocupa a mesma ponta da contagem e a substitui no hover, por CSS. */
  const actions = (node: NavTreeItem, sections: DropdownSection[]) => (
    <span className={tree.actions}>
      <DropdownMenu
        label={`Opções de ${node.name}`}
        triggerLabel={`Opções de ${node.name}`}
        sections={sections}
        icon={<CaretDownIcon weight="bold" />}
        size="sm"
      />
    </span>
  );

  /* Cada filho é um galho, e o último da fila fecha o fio em L em vez de deixá-lo seguir para baixo. */
  const limbs = (nodes: NavTreeItem[], parentId: string | null) =>
    nodes.map((node, index) => (
      <div
        key={node.id}
        className={tree.limb}
        data-last={index === nodes.length - 1 || undefined}
        data-route={onRoute(node) || undefined}
      >
        {node.kind === "folder" ? folder(node, parentId) : link(node, parentId)}
      </div>
    ));

  const folder = (node: Folder, parentId: string | null) => {
    const expanded = open.includes(node.id);
    const Glyph = expanded ? FolderOpenIcon : FolderIcon;

    return (
      <>
        <div className={tree.item}>
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
          {actions(node, folderSections(node, parentId))}
        </div>
        {expanded && node.children.length > 0 && <div className={tree.children}>{limbs(node.children, node.id)}</div>}
      </>
    );
  };

  const link = (node: Leaf, parentId: string | null) => {
    const Glyph = glyphs[node.glyph] ?? TrayIcon;
    const hue = { "--project-hue": node.hue } as CSSProperties;

    return (
      <div className={tree.item}>
        <Link
          href={`${basePath}/${node.slug}` as Route}
          className={cx(styles.row, tree.node)}
          data-active={node.slug === current || undefined}
          onClick={onNavigate}
          {...squircle("md")}
        >
          {/* O azulejo no matiz da folha: é o que faz cada quadro ser reconhecido antes de o nome ser lido. A
              pasta segue com o glifo solto, porque ela é o caminho, e não o destino.

              Com imagem, ela cobre o azulejo (2026-09-20, a pedido): a marca do projeto ou a de quem
              contratou diz de relance o que o glifo genérico não dizia. O matiz continua no fundo e na
              contagem, então a linha segue lendo como a mesma identidade, e o véu por baixo é o que segura
              a logo vazada ou de fundo claro. */}
          <span className={cx(tree.mark, tree.tile)} style={hue} aria-hidden="true" {...squircle("sm", { clip: true })}>
            {node.imageUrl ? (
              <StoredImage src={node.imageUrl} alt="" width={20} height={20} className={tree.photo} />
            ) : (
              <Glyph weight="bold" />
            )}
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
        {/* O balde não se edita: ele é o que sobra, e não um quadro que alguém criou. */}
        {!node.bucket && actions(node, leafSections(node, parentId))}
      </div>
    );
  };

  const catalog = domain === "tarefas" ? taskStages : crmStages;

  return (
    <>
      <div className={tree.tree} role="group" aria-label={label}>
        {/* A raiz não tem cotovelo: ela não pende de ninguém. */}
        {items.map((node) => (
          <div key={node.id} className={tree.root}>
            {node.kind === "folder" ? folder(node, null) : link(node, null)}
          </div>
        ))}
      </div>

      {/* As janelas, uma de cada vez, montadas só enquanto algo está aberto. */}
      {(opened?.kind === "rename-folder" || opened?.kind === "new-folder") && (
        <NameDialog
          open
          onClose={() => setOpened(null)}
          title={opened.kind === "rename-folder" ? "Renomear pasta" : "Nova pasta"}
          description={opened.kind === "new-folder" && opened.parentName ? `Dentro de ${opened.parentName}` : undefined}
          placeholder="Clientes, Interno, 2026"
          initialValue={opened.kind === "rename-folder" ? opened.node.name : ""}
          onSubmit={(name) =>
            saveFolder(opened.kind === "rename-folder" ? { id: opened.node.id, name, parentId: opened.parentId } : { name, parentId: opened.parentId })
          }
        />
      )}
      {(opened?.kind === "rename-leaf" || opened?.kind === "new-leaf") && (
        <NameDialog
          open
          onClose={() => setOpened(null)}
          title={opened.kind === "rename-leaf" ? "Renomear funil" : "Novo funil"}
          description={opened.kind === "new-leaf" && opened.parentName ? `Dentro de ${opened.parentName}` : "Ele nasce com as etapas padrão, que você arruma depois."}
          placeholder="Indicações, Licitações, Loja"
          initialValue={opened.kind === "rename-leaf" ? opened.node.name : ""}
          onSubmit={(name) => saveLeaf(opened.kind === "rename-leaf" ? { id: opened.node.id, name, folderId: null } : { name, folderId: opened.parentId })}
        />
      )}
      {opened?.kind === "stages" && (
        <StagesDialog
          open
          onClose={() => setOpened(null)}
          name={opened.node.name}
          catalog={catalog as readonly StageOption<string>[]}
          value={opened.node.stages as string[]}
          onSave={(stages) => saveStages(opened.node, stages)}
        />
      )}
      <ConfirmDialog
        open={opened?.kind === "delete-folder" || opened?.kind === "delete-leaf"}
        pending={working}
        title={opened?.kind === "delete-leaf" ? `Excluir o funil ${opened.node.name}?` : `Excluir a pasta ${opened?.kind === "delete-folder" ? opened.node.name : ""}?`}
        description={
          opened?.kind === "delete-leaf"
            ? "As oportunidades dele não somem: vão para o balde Sem funil e continuam contando."
            : "O que está dentro dela não some: volta para a raiz da árvore. Pasta é só organização."
        }
        onClose={() => setOpened(null)}
        onConfirm={() => void remove()}
      />
    </>
  );
}
