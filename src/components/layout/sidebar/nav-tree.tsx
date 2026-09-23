"use client";

import { CrmAppearanceDialog, CrmAppearancePopover, type CrmAppearance } from "@/features/crm/components/crm-appearance-dialog";
import { TaskAppearanceDialog, TaskAppearancePopover } from "@/features/tasks/components/appearance-dialog";
import { StagesDialog as TaskStagesDialog } from "@/features/tasks/components/stages-dialog";
import { setProjectAppearanceAction } from "@/features/projects/actions";
import type { ProjectHue } from "@/features/projects/summary";
import type { ProjectGlyph } from "@/features/tasks/tree";
import { FunnelStagesDialog } from "@/features/crm/components/funnel-stages-dialog";
import type { CrmStageDefinition, CrmHue } from "@/features/crm/stages";
import type { FunnelGlyph } from "@/features/crm/tree";

import {
  BinocularsIcon,
  BuildingsIcon,
  CaretDownIcon,
  CaretUpDownIcon,
  FileIcon,
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
import { deleteCrmFolderAction, deleteFunnelAction, moveFunnelAction, saveCrmFolderAction, saveFunnelAction } from "@/features/crm/actions";
import type { CrmTreeItem } from "@/features/crm/tree";
import { deleteFolderAction, moveProjectAction, saveFolderAction } from "@/features/projects/actions";
import type { TaskStage } from "@/features/tasks/stages";
import type { TaskTreeItem } from "@/features/tasks/tree";
import { rounded } from "@/lib/corners";
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
  | { kind: "folder"; hue?: string; paletteHue?: string; glyph?: string; id: string; name: string; open: number; children: NavTreeItem[] }
  | {
      kind: "leaf";
      id: string;
      slug: string;
      name: string;
      open: number;
      glyph: string;
      hue: string;
      /** O nome do matiz como está no banco; o `hue` é o token que a linha usa para se tingir. */
      paletteHue?: string;
      /** As etapas do quadro, na ordem das colunas: é o que a janela de etapas arruma. */
      stages: string[];
      stageDefinitions?: CrmStageDefinition[];
      taskStageDefinitions?: TaskStage[];
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
const hueOf = (value?: string): CrmHue => (value?.match(/--sys-([a-z]+)/)?.[1] as CrmHue) ?? "blue";

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
      ? { kind: "folder", id: item.id, name: item.name, open: item.open, hue: item.hue, paletteHue: item.paletteHue, glyph: item.glyph, children: fromTaskTree(item.children) }
      : { kind: "leaf", id: item.id, slug: item.slug, name: item.name, open: item.open, glyph: item.glyph, hue: item.hue, paletteHue: item.paletteHue, stages: item.stages.map((stage) => stage.id), taskStageDefinitions: item.stages, bucket: item.bucket },
  );

/** A árvore do funil na mesma forma: o funil é a folha. */
export const fromCrmTree = (items: CrmTreeItem[]): NavTreeItem[] =>
  items.map((item) =>
    item.kind === "folder"
      ? { kind: "folder", id: item.id, name: item.name, open: item.open, hue: item.hue, children: fromCrmTree(item.children) }
      : { kind: "leaf", id: item.id, slug: item.slug, name: item.name, open: item.open, glyph: item.glyph, hue: item.hue, stages: item.stages, stageDefinitions: item.stageDefinitions, bucket: item.bucket },
  );

type Folder = Extract<NavTreeItem, { kind: "folder" }>;
type Leaf = Extract<NavTreeItem, { kind: "leaf" }>;

/** O que está aberto por cima da árvore: uma janela de nome, de etapas ou de confirmação, para um nó. */
type Opened =
  | { kind: "new-folder"; parentId: string | null; parentName?: string }
  | { kind: "new-leaf"; parentId: string | null; parentName?: string }
  | { kind: "rename-leaf"; node: Leaf }
  | { kind: "stages"; node: Leaf }
  | { kind: "look"; node: Leaf; anchor: { current: HTMLElement | null } }
  | { kind: "delete-folder"; node: Folder }
  | { kind: "delete-leaf"; node: Leaf };

export function NavTree({ items, basePath, current, openFolders, label, onNavigate }: NavTreeProps) {
  const router = useRouter();
  const { toast } = useToast();
  const domain = basePath === "/tarefas" ? "tarefas" : "funis";
  const files = domain === "tarefas";

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

  const saveFolder = async (input: { id?: string; name: string; parentId: string | null; hue?: string; glyph?: string }) => {
    const result = domain === "tarefas" ? await saveFolderAction(input) : await saveCrmFolderAction(input);
    if (!result.ok) return result.error;
    /* Editar a pasta não avisa: o próprio menu já mostra o nome e a cor novos. */
    if (!input.id) done("Pasta criada", `${input.name} já está na árvore.`);
    router.refresh();
    return undefined;
  };

  const saveLeaf = async (input: { id?: string; name: string; folderId: string | null; glyph?: FunnelGlyph; hue?: CrmHue }) => {
    /* Projeto novo nasce na página dele, com a ficha inteira; aqui só o funil, que precisa de um nome. */
    const result = await saveFunnelAction(input);
    if (!result.ok) return result.error;
    done(input.id ? "Funil renomeado" : "Funil criado", input.id ? `Agora ele se chama ${input.name}.` : `${input.name} já está na árvore.`);
    if (!input.id) router.push(`/crm/${result.slug}` as Route);
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

  const folderSections = (node: Folder, closeEditor: () => void): DropdownSection[] => [
    {
      id: "create",
      label: "Criar dentro",
      items: [
        {
          id: "folder",
          label: "Nova pasta",
          icon: FolderPlusIcon,
          onSelect: () => {
            closeEditor();
            setOpened({ kind: "new-folder", parentId: node.id, parentName: node.name });
          },
        },
        domain === "tarefas"
          ? { id: "leaf", label: "Novo projeto", icon: KanbanIcon, href: "/projetos/novo" as Route, onSelect: closeEditor }
          : {
              id: "leaf",
              label: "Novo funil",
              icon: FunnelIcon,
              onSelect: () => {
                closeEditor();
                setOpened({ kind: "new-leaf", parentId: node.id, parentName: node.name });
              },
            },
      ],
    },
    {
      id: "danger",
      items: [
        {
          id: "delete",
          label: "Excluir pasta",
          icon: TrashIcon,
          tone: "danger",
          onSelect: () => {
            closeEditor();
            setOpened({ kind: "delete-folder", node });
          },
        },
      ],
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
              {
                id: "look",
                label: "Cor do quadro",
                icon: PaletteIcon,
                /* Abre por cima do leque, colada na linha do quadro, como a edição da pasta: o leque fica aberto
                   por baixo e volta a valer quando a cor fecha. */
                keepOpen: true,
                onSelect: () => setOpened({ kind: "look", node, anchor: { current: document.querySelector<HTMLElement>(`[data-leaf="${node.id}"]`) } }),
              },
            ],
          },
          ...moveSection(node, parentId),
        ]
      : [
          {
            id: "edit",
            items: [
              { id: "rename", label: "Editar funil e ícone", icon: PencilSimpleIcon, onSelect: () => setOpened({ kind: "rename-leaf", node }) },
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

  const folderEditor = (node: Folder, parentId: string | null) => {
    const headerAction = (closeEditor: () => void) => (
      <DropdownMenu
        label={`Outras ações de ${node.name}`}
        triggerLabel={`Outras ações de ${node.name}`}
        sections={folderSections(node, closeEditor)}
        icon={<CaretUpDownIcon weight="bold" />}
        size="sm"
      />
    );

    return (
      <span className={tree.actions}>
        {domain === "tarefas" ? (
          <TaskAppearancePopover
            title="Editar pasta"
            triggerLabel={`Editar nome e cor de ${node.name}`}
            initial={{
              name: node.name,
              hue: (node.paletteHue ?? "gray") as ProjectHue,
              glyph: (node.glyph ?? "tray") as ProjectGlyph,
            }}
            labels={{ hue: "Cor da pasta", glyph: "Ícone da pasta" }}
            renderHeaderAction={headerAction}
            onSave={(value) =>
              saveFolder({ id: node.id, name: value.name, hue: value.hue, glyph: value.glyph, parentId })
            }
          />
        ) : (
          <CrmAppearancePopover
            folder
            title="Editar pasta"
            triggerLabel={`Editar nome e cor de ${node.name}`}
            initial={{ name: node.name, hue: hueOf(node.hue) }}
            renderHeaderAction={headerAction}
            onSave={(value) => saveFolder({ id: node.id, name: value.name, hue: value.hue, parentId })}
          />
        )}
      </span>
    );
  };

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
    /* A pasta com glifo próprio o mantém aberta ou fechada: ele é a identidade dela, e trocar o desenho ao
       abrir faria a mesma pasta parecer duas. Sem glifo, vale a pasta que abre e fecha, como sempre. */
    const own = node.glyph ? glyphs[node.glyph] : undefined;
    const Glyph = own ?? (expanded ? FolderOpenIcon : FolderIcon);

    return (
      <>
        <div className={tree.item}>
          <button
            type="button"
            className={cx(styles.row, tree.node)}
            aria-expanded={expanded}
            onClick={() => toggle(node.id)}
            {...rounded("md")}
          >
            <span className={tree.mark} style={node.hue ? { color: node.hue } : undefined} aria-hidden="true">
              <Glyph />
            </span>
            <span className={styles.label}>{node.name}</span>
            {node.open > 0 && (
              <Badge tone="neutral" size="sm" className={tree.count}>
                {node.open}
              </Badge>
            )}
          </button>
          {folderEditor(node, parentId)}
        </div>
        {expanded && node.children.length > 0 && <div className={tree.children}>{limbs(node.children, node.id)}</div>}
      </>
    );
  };

  const link = (node: Leaf, parentId: string | null) => {
    const Glyph = glyphs[node.glyph] ?? TrayIcon;
    const hue = { "--project-hue": node.hue } as CSSProperties;

    return (
      <div className={tree.item} data-leaf={node.id}>
        <Link
          href={`${basePath}/${node.slug}` as Route}
          className={cx(styles.row, tree.node)}
          data-active={node.slug === current || undefined}
          onClick={onNavigate}
          {...rounded("md")}
        >
          {/* O projeto é um arquivo genérico, sem logo nem matiz (2026-09-22, a pedido): a árvore lê como
              pastas e arquivos, mais sóbria. O funil segue com o azulejo no matiz dele. */}
          {files ? (
            <span className={tree.mark} aria-hidden="true">
              <FileIcon />
            </span>
          ) : (
            <span className={cx(tree.mark, tree.tile)} style={hue} aria-hidden="true">
              <Glyph weight="bold" />
            </span>
          )}
          <span className={styles.label}>{node.name}</span>
          {node.open > 0 && (
            <Badge hue={files ? undefined : node.hue} size="sm" className={tree.count}>
              {node.open}
            </Badge>
          )}
        </Link>
        {/* O balde não se edita: ele é o que sobra, e não um quadro que alguém criou. */}
        {!node.bucket && actions(node, leafSections(node, parentId))}
      </div>
    );
  };

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
      {domain === "tarefas" && opened?.kind === "new-folder" && (
        <TaskAppearanceDialog
          open
          title="Nova pasta"
          initial={{ hue: "gray" as ProjectHue, glyph: "tray" as ProjectGlyph }}
          onClose={() => setOpened(null)}
          onSave={(value: { name: string; hue: string; glyph: string }) =>
            saveFolder({
              name: value.name,
              hue: value.hue,
              glyph: value.glyph,
              parentId: opened.parentId,
            })
          }
        />
      )}
      {domain === "funis" && opened?.kind === "new-folder" && <CrmAppearanceDialog
        folder title="Nova pasta" onClose={() => setOpened(null)}
        onSave={(value) => saveFolder({ name: value.name, hue: value.hue, parentId: opened.parentId })}
      />}
      {(opened?.kind === "rename-leaf" || opened?.kind === "new-leaf") && <CrmAppearanceDialog
        title={opened.kind === "rename-leaf" ? "Editar funil" : "Novo funil"} onClose={() => setOpened(null)}
        initial={opened.kind === "rename-leaf" ? { name: opened.node.name, hue: hueOf(opened.node.hue), glyph: opened.node.glyph as FunnelGlyph } : undefined}
        onSave={(value: CrmAppearance) => saveLeaf({ ...value, folderId: opened.kind === "new-leaf" ? opened.parentId : null, ...(opened.kind === "rename-leaf" && { id: opened.node.id }) })}
      />}
      {opened?.kind === "stages" && (domain === "funis" ? <FunnelStagesDialog
        id={opened.node.id} name={opened.node.name} stages={opened.node.stages} definitions={opened.node.stageDefinitions} onClose={() => setOpened(null)} onSaved={() => router.refresh()}
      /> : <TaskStagesDialog open name={opened.node.name} stages={opened.node.taskStageDefinitions ?? []} projectId={opened.node.bucket ? null : opened.node.id} onClose={() => setOpened(null)} onSaved={() => router.refresh()} />)}
      {opened?.kind === "look" && domain === "tarefas" && (
        <TaskAppearancePopover
          anchor={opened.anchor}
          withName={false}
          title="Cor do quadro"
          initial={{ hue: opened.node.paletteHue ?? "blue", glyph: opened.node.glyph }}
          onClose={() => setOpened(null)}
          onSave={async (value: { hue: string; glyph: string }) => {
            const result = await setProjectAppearanceAction({ id: opened.node.id, hue: value.hue, glyph: value.glyph });
            if (!result.ok) return result.error;
            router.refresh();
            return undefined;
          }}
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
