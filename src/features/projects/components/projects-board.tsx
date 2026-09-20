"use client";

import { ArrowCounterClockwiseIcon, BriefcaseIcon, PlusIcon } from "@phosphor-icons/react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import { useFloatingPagerRegistration } from "@/components/layout/floating-actions";
import { PageToolbar } from "@/components/layout/page-toolbar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import type { DropdownSection } from "@/components/ui/dropdown-menu";
import { IconButton } from "@/components/ui/icon-button";
import { Pagination } from "@/components/ui/pagination";
import { Text } from "@/components/ui/text";
import { MOBILE_QUERY, useMediaQuery } from "@/hooks/use-media-query";
import { callAction } from "@/lib/action";
import { SCROLL_CONTAINER } from "@/lib/scroll";
import { saveProjectsGridSize } from "../grid-cookie";
import { projectStatuses } from "../labels";
import {
  DEFAULT_TAG,
  DUE_PARAM,
  GRID_PER_PAGE_DEFAULT,
  MOBILE_PER_PAGE,
  PAGE_PARAM,
  PAGE_SIZE_PARAM,
  QUERY_PARAM,
  STATUS_PARAM,
  TAG_PARAM,
  activeProjectsFilters,
  clearedFilters,
  defaultQuery,
  dueFilterLabels,
  dueFilterValues,
  gridPageSize,
  remapPage,
  statusFilterLabels,
  statusFilterValues,
  type ProjectsListPage,
  type ProjectsQuery,
} from "../list-options";
import type { Project, ProjectClient, ProjectOwnerOption } from "../summary";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/providers/toast-provider";
import { deleteProjectAction } from "../actions";
import { ProjectCard } from "./project-card";
import { ProjectDialog } from "./project-dialog";
import type { ProjectEditor } from "./project-form-dialog";
import styles from "./projects-board.module.css";

export type ProjectsBoardProps = {
  page: ProjectsListPage;
  query: ProjectsQuery;
  /** O projeto que a URL pede aberto na janela (`/projetos/<id>`); nada para só listar. */
  viewing?: Project | null;
  /** A ficha que a URL pede na gaveta: um projeto para editar (`/projetos/<id>/editar`), `"new"` para criar. */
  editing?: ProjectEditor;
  /** Os clientes e a equipe, para os seletores da ficha. */
  clients: ProjectClient[];
  owners: ProjectOwnerOption[];
};

/** Quanto o campo espera parar de digitar antes de refazer a busca no servidor. */
const TYPING_PAUSE = 320;

/** Quanto a grade espera a janela parar de mudar de largura antes de pedir outro tamanho de página. */
const RESIZE_PAUSE = 200;

const numberFormat = new Intl.NumberFormat("pt-BR");

/**
 * O endereço da tela conforme o que está aberto: a gaveta manda, porque abre por cima da janela
 * (`/projetos/novo`, `/projetos/<id>/editar`); depois a janela (`/projetos/<id>`); e a lista nua.
 */
const pathOf = (viewing: Project | null, editing: ProjectEditor) =>
  editing === "new" ? "/projetos/novo" : editing ? `/projetos/${editing.id}/editar` : viewing ? `/projetos/${viewing.id}` : "/projetos";

// A prancha de projetos: a barra de busca e filtros em cima, a grade de cartões no meio e a paginação
// embaixo, na mesma estrutura da base de clientes e do catálogo. O filtro vive na URL e quem faz o trabalho
// é o servidor, então a página é compartilhável e volta igual pelo histórico; aqui ficam a espera do campo
// de busca, o filtro adiantado, o projeto aberto na janela e a ficha aberta na gaveta. Trocar qualquer filtro
// leva de volta para a primeira página.
export function ProjectsBoard({ page, query, viewing: initialViewing, editing: initialEditing }: ProjectsBoardProps) {
  const router = useRouter();
  const { toast } = useToast();
  const mobile = useMediaQuery(MOBILE_QUERY);
  const [search, setSearch] = useState(query.search);
  // O filtro em vigor na tela, adiantado: a escolha marca na hora e a URL vai atrás. Quando a resposta
  // chega, o que veio da URL passa a valer, ajustado durante o render, como o React pede para prop nova.
  const [live, setLive] = useState(query);
  const [seen, setSeen] = useState(query);
  if (seen !== query) {
    setSeen(query);
    setLive(query);
  }
  const typing = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(typing.current), []);

  // A janela do projeto e a gaveta da ficha têm endereço, no contrato da ficha do cliente e do catálogo:
  // nascem do que a URL pediu e daí em diante trocam só a URL, sem sair da tela, por `pushState`; o voltar do
  // navegador fecha, ou reabre quem estava aberto, pelo `popstate`. Uma janela e uma gaveta para a grade
  // inteira. Quando uma resposta nova do servidor chega, o que veio na URL passa a valer nas duas, ajustado
  // durante o render: é assim que salvar devolve o projeto editado à janela, já com os dados novos.
  const [viewing, setViewing] = useState<Project | null>(initialViewing ?? null);

  /* A exclusão, no desenho da base de clientes e do catálogo: o menu pede, a janela da casa pergunta, e só
     então a action grava. Projeto com tarefa ou contrato ligado é recusado pelo banco, e a mensagem que
     volta é a que aparece. */
  const [deleting, setDeleting] = useState<Project | null>(null);
  const [removing, setRemoving] = useState(false);

  const removeProject = async () => {
    if (!deleting) return;
    setRemoving(true);
    const result = await callAction(deleteProjectAction(deleting.id));
    setRemoving(false);

    if (!result.ok) {
      toast({ title: "Não deu para excluir", description: result.error, tone: "danger" });
      return;
    }

    setDeleting(null);
    setViewing((current) => (current?.id === deleting.id ? null : current));
    toast({ title: "Projeto excluído", description: `${deleting.name} saiu da lista.`, tone: "success" });
    router.refresh();
  };
  const [editing, setEditing] = useState<ProjectEditor>(initialEditing ?? null);
  const [seenPage, setSeenPage] = useState(page);
  if (seenPage !== page) {
    setSeenPage(page);
    setViewing(initialViewing ?? null);
    setEditing(initialEditing ?? null);
  }

  // O ouvinte é refeito a cada página de itens, porque é entre eles que o endereço do voltar é procurado:
  // um id que não está na página em vigor fecha a janela em vez de abrir a ficha errada.
  useEffect(() => {
    const onPopState = () => {
      const [, , first, second] = window.location.pathname.split("/");
      if (first === "novo") {
        setViewing(null);
        setEditing("new");
        return;
      }
      const project = first ? (page.items.find((entry) => entry.id === first) ?? null) : null;
      setViewing(project);
      setEditing(second === "editar" ? project : null);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [page.items]);

  const show = (nextViewing: Project | null, nextEditing: ProjectEditor) => {
    setViewing(nextViewing);
    setEditing(nextEditing);
    window.history.pushState(null, "", `${pathOf(nextViewing, nextEditing)}${window.location.search}`);
  };

  /* Criar e editar são a tela do editor, em página inteira e com a prévia ao lado (2026-09-17, a pedido, na
     moldura do editor de contrato): montar um projeto é trabalho de tela, e a gaveta sobre a lista disputava
     altura com a própria lista. A prancha só leva até lá. */
  const create = () => router.push("/projetos/novo");
  const edit = (project: Project) => router.push(`/projetos/${project.id}/editar` as Route);

  const go = useCallback(
    (next: Partial<ProjectsQuery>) => {
      const merged = { ...live, ...next };
      setLive(merged);
      const params = new URLSearchParams();
      if (merged.search) params.set(QUERY_PARAM, merged.search);
      if (merged.status !== defaultQuery.status) params.set(STATUS_PARAM, merged.status);
      if (merged.due !== defaultQuery.due) params.set(DUE_PARAM, merged.due);
      if (merged.tag !== defaultQuery.tag) params.set(TAG_PARAM, merged.tag);
      if (merged.page > 1) params.set(PAGE_PARAM, String(merged.page));
      if (merged.pageSize !== GRID_PER_PAGE_DEFAULT) params.set(PAGE_SIZE_PARAM, String(merged.pageSize));

      const search = params.toString();
      const base = pathOf(viewing, editing);
      startTransition(() => router.replace((search ? `${base}?${search}` : base) as Route, { scroll: false }));
    },
    [live, viewing, editing, router],
  );

  // Cada tecla refaz a página no servidor, então o campo espera a pessoa parar de digitar.
  const onSearch = (value: string) => {
    setSearch(value);
    window.clearTimeout(typing.current);
    typing.current = window.setTimeout(() => go({ search: value, page: 1 }), TYPING_PAUSE);
  };

  // Trocar de página leva de volta ao começo da lista: no desktop quem rola é a área da grade, e no celular
  // a coluna de conteúdo da concha, e não o documento, então o `scroll` do roteador não os alcança. Macio,
  // salvo com movimento reduzido.
  const scrollArea = useRef<HTMLDivElement>(null);
  const changePage = (next: number) => {
    go({ page: next });
    const area = scrollArea.current;
    const column = (area && area.scrollHeight > area.clientHeight ? area : null) ?? document.querySelector<HTMLElement>(`[${SCROLL_CONTAINER}]`) ?? document.documentElement;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    column.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
  };

  // A grade mede quantas colunas formou e pede ao servidor a página que cabe em três linhas, sempre par, na
  // receita do catálogo. A medida entra no cookie para a próxima visita já vir do tamanho certo, e só pede
  // outra página quando o tamanho muda de verdade, depois de a janela parar de mudar.
  const gridRef = useRef<HTMLUListElement>(null);
  const showing = page.items.length;
  const currentSize = live.pageSize;
  const currentPage = live.page;
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    let timer: number | undefined;
    const observer = new ResizeObserver(() => {
      // No celular a página é sempre doze, e não o que a grade mede: numa ou duas colunas a medida daria
      // três ou seis, e a pessoa passaria página o tempo todo.
      const columns = getComputedStyle(grid).gridTemplateColumns.split(" ").filter(Boolean).length;
      const size = mobile ? MOBILE_PER_PAGE : gridPageSize(columns);
      // O cookie guarda só a medida do desktop: o doze fixo do celular gravado ali faria o desktop abrir
      // curto antes de medir.
      if (!mobile) saveProjectsGridSize(size);
      window.clearTimeout(timer);
      if (size === currentSize) return;
      timer = window.setTimeout(() => go({ pageSize: size, page: remapPage(currentPage, currentSize, size) }), RESIZE_PAUSE);
    });
    observer.observe(grid);
    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
    };
  }, [mobile, showing, currentSize, currentPage, go]);

  const pages = Math.max(1, Math.ceil(page.total / live.pageSize));
  const from = (live.page - 1) * live.pageSize + 1;
  const to = Math.min(live.page * live.pageSize, page.total);
  const active = activeProjectsFilters(live);
  /* Sem busca e sem filtro, uma lista vazia quer dizer base vazia. */
  const filtering = Boolean(live.search) || active.length > 0;
  const clearAll = () => {
    setSearch("");
    go({ ...clearedFilters, search: "", page: 1 });
  };

  // No celular a paginação mora na barra flutuante do menu, no mesmo lugar de salvar e sair de uma janela,
  // em vez de uma segunda barra no pé da lista. Passando de uma página; com uma só, a barra volta a ser
  // busca e sino.
  useFloatingPagerRegistration(mobile && pages > 1 ? { page: live.page, pageCount: pages, onPageChange: changePage, label: "Páginas de projetos" } : null);

  /* O menu de filtros, no desenho do da base de clientes e do catálogo: situação em escolha única com a
     contagem da base inteira em cada uma, entrega em escolha única e etiqueta em escolha única com as
     etiquetas da base inteira. Cada escolha vale na hora e não fecha o menu. */
  const filterSections: DropdownSection[] = [
    {
      id: "status",
      label: "Situação",
      items: statusFilterValues.map((value) => ({
        id: `status-${value}`,
        label: statusFilterLabels[value],
        icon: value === "todos" ? undefined : projectStatuses[value].icon,
        count: value === "todos" ? undefined : page.counts[value],
        selected: live.status === value,
        keepOpen: true,
        onSelect: () => go({ status: value, page: 1 }),
      })),
    },
    {
      id: "due",
      label: "Entrega",
      items: dueFilterValues.map((value) => ({
        id: `due-${value}`,
        label: dueFilterLabels[value],
        selected: live.due === value,
        keepOpen: true,
        onSelect: () => go({ due: value, page: 1 }),
      })),
    },
    {
      id: "tag",
      label: "Etiqueta",
      items: [
        {
          id: "tag-all",
          label: "Todas as etiquetas",
          selected: live.tag === DEFAULT_TAG,
          keepOpen: true,
          onSelect: () => go({ tag: DEFAULT_TAG, page: 1 }),
        },
        ...page.tags.map((tag) => ({
          id: `tag-${tag}`,
          label: tag,
          selected: live.tag === tag,
          keepOpen: true,
          onSelect: () => go({ tag, page: 1 }),
        })),
      ],
    },
    ...(active.length > 0
      ? [
          {
            id: "reset",
            items: [
              {
                id: "reset",
                label: "Limpar filtros",
                icon: ArrowCounterClockwiseIcon,
                onSelect: () => go(clearedFilters),
              },
            ],
          },
        ]
      : []),
  ];

  return (
    <div className={styles.board}>
      <PageToolbar
        search={{
          value: search,
          onChange: onSearch,
          placeholder: "Buscar projetos",
          label: "Buscar projeto por nome, cliente, site ou etiqueta",
        }}
        filters={filterSections}
        activeFilters={active.map((filter) => ({
          id: filter.id,
          label: filter.label,
          icon: filter.icon,
          onClear: () => go({ ...filter.clear, page: 1 }),
        }))}
        action={
          /* Texto no desktop e só o ícone no celular, por CSS e não por media query em JS, para a marcação
             não saltar na hidratação: os dois existem e cada largura mostra um. */
          <>
            <span className={styles.wide}>
              <Button size="sm" radius="md" iconStart={<PlusIcon />} onClick={create}>
                Novo projeto
              </Button>
            </span>
            <span className={styles.narrow}>
              <IconButton label="Novo projeto" size="sm" radius="md" onClick={create}>
                <PlusIcon />
              </IconButton>
            </span>
          </>
        }
      />

      {page.items.length === 0 ? (
        <EmptyState
          icon={BriefcaseIcon}
          title={filtering ? "Nenhum projeto encontrado" : "Nenhum projeto ainda"}
          description={
            filtering
              ? "Nada bateu com o que você procurou. Tente outro nome, cliente, site ou etiqueta, ou limpe a busca."
              : "Cadastre o primeiro projeto e ele vira base do seu portfólio e do seu currículo."
          }
        >
          {filtering && (
            <Button variant="secondary" size="sm" radius="md" iconStart={<ArrowCounterClockwiseIcon />} onClick={clearAll}>
              Limpar busca
            </Button>
          )}
          <Button size="sm" radius="md" iconStart={<PlusIcon />} onClick={create}>
            Novo projeto
          </Button>
        </EmptyState>
      ) : (
        <div ref={scrollArea} className={styles.scrollArea}>
          <ul ref={gridRef} className={styles.grid}>
            {page.items.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onOpen={() => show(project, null)}
                onEdit={() => edit(project)}
                onDelete={() => setDeleting(project)}
              />
            ))}
          </ul>
        </div>
      )}

      {/* O pé da grade, preso embaixo e à direita no desktop, como no catálogo: a contagem e, passando de uma
          página, a barra. No celular a barra mora na barra flutuante do menu. */}
      {page.items.length > 0 && (
        <div className={styles.foot}>
          <Text as="span" variant="footnote" tone="secondary">
            Mostrando {numberFormat.format(from)} a {numberFormat.format(to)} de {numberFormat.format(page.total)}
          </Text>
          {pages > 1 && !mobile && <Pagination page={live.page} pageSize={live.pageSize} total={page.total} onPageChange={changePage} label="Páginas de projetos" />}
        </div>
      )}

      <ProjectDialog
        project={viewing}
        onClose={() => show(null, null)}
        onEdit={edit}
        onDelete={setDeleting}
      />
      <ConfirmDialog
        open={deleting !== null}
        pending={removing}
        title={`Excluir ${deleting?.name ?? "projeto"}?`}
        description="O projeto sai da lista e do portfólio, com o quadro de tarefas dele. Os orçamentos e contratos do cliente ficam."
        onClose={() => setDeleting(null)}
        onConfirm={() => void removeProject()}
      />
    </div>
  );
}
