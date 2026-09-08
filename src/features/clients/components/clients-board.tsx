"use client";

import {
  ArrowCounterClockwiseIcon,
  EnvelopeSimpleIcon,
  MinusCircleIcon,
  PhoneIcon,
  PlusIcon,
  StarIcon,
  TrashIcon,
} from "@phosphor-icons/react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { startTransition, useEffect, useRef, useState } from "react";
import { PageToolbar } from "@/components/layout/page-toolbar";
import { Button } from "@/components/ui/button";
import type { DropdownSection } from "@/components/ui/dropdown-menu";
import { IconButton } from "@/components/ui/icon-button";
import { Pagination } from "@/components/ui/pagination";
import { Text } from "@/components/ui/text";
import { useToast } from "@/components/providers/toast-provider";
import { SCROLL_CONTAINER } from "@/lib/scroll";
import { deleteClientsAction } from "../actions";
import {
  CLIENTS_PER_PAGE,
  EMAIL_PARAM,
  FAVORITE_PARAM,
  PAGE_PARAM,
  PERIOD_PARAM,
  PHONE_PARAM,
  QUERY_PARAM,
  STATUS_PARAM,
  clearedFilters,
  countActiveFilters,
  defaultQuery,
  periodOptions,
  type ClientListItem,
  type ClientsListPage,
  type ClientsQuery,
} from "../list-options";
import type { Client } from "../summary";
import { ClientCard } from "./client-card";
import { ClientDrawer } from "./client-drawer";
import { ClientFormDialog, type ClientEditor } from "./client-form-dialog";
import { DeleteClientsDialog } from "./delete-clients-dialog";
import styles from "./clients-board.module.css";

export type ClientsBoardProps = { page: ClientsListPage; query: ClientsQuery; editing?: Client | "new" };

/** Quanto o campo espera parar de digitar antes de refazer a busca no servidor. */
const TYPING_PAUSE = 320;

// A tela de clientes: a barra de busca e filtros em cima, a grade de cartões no meio e a paginação
// embaixo. O filtro vive na URL e quem faz o trabalho é o servidor, então a página é compartilhável e
// volta igual pelo histórico do navegador; aqui ficam só a seleção dos cartões, que é da sessão, a
// espera do campo de busca e o filtro adiantado. Trocar qualquer filtro leva de volta para a primeira
// página, senão a pessoa cairia numa página que o novo filtro nem tem.
export function ClientsBoard({ page, query, editing }: ClientsBoardProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [search, setSearch] = useState(query.search);
  // O filtro em vigor na tela, adiantado: a escolha marca na hora e a URL vai atrás, senão o check só
  // aparecia quando o servidor devolvia a página, e a lista parecia lenta. Quando a resposta chega, o que
  // veio da URL passa a valer, ajustado durante o render, que é como o React pede para reagir a prop nova.
  const [live, setLive] = useState(query);
  const [seen, setSeen] = useState(query);
  if (seen !== query) {
    setSeen(query);
    setLive(query);
  }
  // Quem está marcado na grade, para excluir de uma vez. A seleção é desta página: trocar filtro ou
  // página a limpa, senão a pessoa excluiria alguém que já não está vendo.
  const [selected, setSelected] = useState<string[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // Uma gaveta só para a tela inteira, guardando quem está aberto: assim vinte e quatro cartões não
  // montam vinte e quatro janelas. Fica montada e vazia depois de fechar, para a saída animar.
  const [open, setOpen] = useState<ClientListItem | null>(null);
  // A ficha em edição na janela. Nasce do que a URL pediu (`/clientes/novo` ou `/clientes/<id>`), e daí em
  // diante troca só a URL, sem sair da tela: `pushState` conversa com o roteador sem refazer nada no
  // servidor, e o botão de voltar do navegador fecha a janela pelo `popstate`.
  const [editor, setEditor] = useState<ClientEditor>(editing ?? null);
  const typing = useRef<number | undefined>(undefined);

  useEffect(() => {
    const onPopState = () => {
      const [, , segment] = window.location.pathname.split("/");
      if (!segment) setEditor(null);
      else if (segment === "novo") setEditor("new");
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const editorPath = (next: ClientEditor) => (next === null ? "/clientes" : next === "new" ? "/clientes/novo" : `/clientes/${next.id}`);

  // Editar quem já está na tela abre no lugar, com a ficha completa chegando dentro da gaveta: sem ida
  // ao servidor pela página, o que era o que deixava o clique sem resposta.
  const editClient = (item: ClientListItem) => {
    setOpen(null);
    openEditor(item);
  };

  const openEditor = (next: ClientEditor) => {
    setEditor(next);
    window.history.pushState(null, "", `${editorPath(next)}${window.location.search}`);
  };

  useEffect(() => () => window.clearTimeout(typing.current), []);

  const go = (next: Partial<ClientsQuery>) => {
    const merged = { ...live, ...next };
    setLive(merged);
    setSelected([]);
    const params = new URLSearchParams();
    if (merged.search) params.set(QUERY_PARAM, merged.search);
    if (merged.favorite !== defaultQuery.favorite) params.set(FAVORITE_PARAM, merged.favorite);
    if (merged.status !== defaultQuery.status) params.set(STATUS_PARAM, merged.status);
    if (merged.period !== defaultQuery.period) params.set(PERIOD_PARAM, merged.period);
    if (merged.withEmail) params.set(EMAIL_PARAM, "1");
    if (merged.withPhone) params.set(PHONE_PARAM, "1");
    if (merged.page > 1) params.set(PAGE_PARAM, String(merged.page));

    const search = params.toString();
    const base = editorPath(editor);
    startTransition(() => router.replace((search ? `${base}?${search}` : base) as Route, { scroll: false }));
  };

  // Cada tecla refaz a página no servidor, então o campo espera a pessoa parar de digitar: sem isso
  // seria uma ida ao servidor por letra.
  const onSearch = (value: string) => {
    setSearch(value);
    window.clearTimeout(typing.current);
    typing.current = window.setTimeout(() => go({ search: value, page: 1 }), TYPING_PAUSE);
  };

  const toggle = (id: string, on: boolean) =>
    setSelected((current) => (on ? [...current, id] : current.filter((entry) => entry !== id)));

  // Trocar de página leva de volta ao começo da lista: quem rola é a coluna de conteúdo da concha, e não o
  // documento, então o `scroll` do roteador não a alcança. Macio, salvo com movimento reduzido.
  const changePage = (next: number) => {
    go({ page: next });
    const column = document.querySelector<HTMLElement>(`[${SCROLL_CONTAINER}]`) ?? document.documentElement;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    column.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
  };

  const pages = Math.max(1, Math.ceil(page.total / CLIENTS_PER_PAGE));
  const active = countActiveFilters(live);
  const selectedClients = page.items.filter((client) => selected.includes(client.id));
  const count = selectedClients.length;

  // Excluir de uma vez: a action valida no servidor e devolve a contagem; a tela avisa, limpa a marcação
  // e refaz a lista. Hoje a base é a prévia, então nada some de verdade; com a tabela, some.
  const removeSelected = async () => {
    setDeleting(true);
    const result = await deleteClientsAction(selectedClients.map((client) => client.id));
    setDeleting(false);
    setConfirming(false);

    if (!result.ok) {
      toast({ title: "Não deu para excluir", description: result.error, tone: "danger" });
      return;
    }

    toast({
      title: result.deleted === 1 ? "Cliente excluído" : `${result.deleted} clientes excluídos`,
      description: "A base já está sem eles.",
      tone: "success",
    });
    setSelected([]);
    router.refresh();
  };

  /* O menu de filtros, tudo num lugar só e só o que é útil (a pedido, 2026-09-08): período em escolha
     única, marcada pelo check; favorito e inativo em interruptor, porque são sim ou não; e-mail e
     telefone também. Ordem e "só ativos" saíram por não mudarem nada no dia a dia. Cada escolha vale na hora e não fecha o menu, porque a pessoa costuma ajustar mais
     de uma coisa antes de sair; limpar volta tudo ao padrão e só aparece com algo em vigor. */
  const filterSections: DropdownSection[] = [
    {
      id: "period",
      label: "Período de entrada",
      items: periodOptions.map((option) => ({
        id: `period-${option.value}`,
        label: option.label,
        selected: live.period === option.value,
        keepOpen: true,
        onSelect: () => go({ period: option.value, page: 1 }),
      })),
    },
    {
      id: "client",
      label: "Cliente",
      items: [
        {
          kind: "toggle",
          id: "favorite",
          label: "Só favoritos",
          icon: StarIcon,
          checked: live.favorite === "favoritos",
          onChange: (on) => go({ favorite: on ? "favoritos" : "todos", page: 1 }),
        },
        /* Só o que muda a lista de verdade: quase todo mundo é ativo, então o filtro útil é o de inativos. */
        {
          kind: "toggle",
          id: "inactive",
          label: "Só inativos",
          icon: MinusCircleIcon,
          checked: live.status === "inativos",
          onChange: (on) => go({ status: on ? "inativos" : "todos", page: 1 }),
        },
      ],
    },
    {
      id: "contact",
      label: "Contato",
      items: [
        {
          kind: "toggle",
          id: "email",
          label: "Com e-mail",
          icon: EnvelopeSimpleIcon,
          checked: live.withEmail,
          onChange: (withEmail) => go({ withEmail, page: 1 }),
        },
        {
          kind: "toggle",
          id: "phone",
          label: "Com telefone",
          icon: PhoneIcon,
          checked: live.withPhone,
          onChange: (withPhone) => go({ withPhone, page: 1 }),
        },
      ],
    },
    ...(active > 0
      ? [{ id: "reset", items: [{ id: "reset", label: "Limpar filtros", icon: ArrowCounterClockwiseIcon, onSelect: () => go(clearedFilters) }] }]
      : []),
  ];

  return (
    <div className={styles.board}>
      <PageToolbar
        search={{
          value: search,
          onChange: onSearch,
          placeholder: "Buscar clientes",
          label: "Buscar cliente",
        }}
        filters={filterSections}
        activeFilters={active}
        selection={
          /* Só existe com algo marcado: botão que não faz nada é pior que botão nenhum. Texto com a
             contagem no desktop e só o ícone no celular, com a contagem no nome. */
          count > 0 && (
            <>
              <span className={styles.wide}>
                <Button variant="danger" size="sm" radius="md" iconStart={<TrashIcon />} onClick={() => setConfirming(true)}>
                  Excluir {count}
                </Button>
              </span>
              <span className={styles.narrow}>
                <IconButton label={`Excluir ${count} selecionados`} variant="danger" size="sm" radius="md" onClick={() => setConfirming(true)}>
                  <TrashIcon />
                </IconButton>
              </span>
            </>
          )
        }
        action={
          <>
            <span className={styles.wide}>
              <Button size="sm" radius="md" iconStart={<PlusIcon />} onClick={() => openEditor("new")}>
                Novo cliente
              </Button>
            </span>
            <span className={styles.narrow}>
              <IconButton label="Novo cliente" size="sm" radius="md" onClick={() => openEditor("new")}>
                <PlusIcon />
              </IconButton>
            </span>
          </>
        }
      />

      {page.items.length === 0 ? (
        <div className={styles.empty}>
          <Text variant="callout" weight="semibold">
            Nenhum cliente por aqui
          </Text>
          <Text variant="footnote" tone="secondary">
            {query.search
              ? "Nada bateu com o que você procurou. Tente outro nome, empresa, e-mail ou telefone."
              : "Ajuste o período ou os filtros para ver mais."}
          </Text>
        </div>
      ) : (
        <ul className={styles.grid}>
          {page.items.map((client) => (
            <ClientCard
              key={client.id}
              client={client}
              selected={selected.includes(client.id)}
              onSelectedChange={(on) => toggle(client.id, on)}
              onOpen={() => setOpen(client)}
              onEdit={() => editClient(client)}
            />
          ))}
        </ul>
      )}

      {/* A barra só existe passando de uma página: com menos ela seria uma faixa sem função no pé. */}
      {pages > 1 && (
        <div className={styles.foot}>
          <Pagination
            page={live.page}
            pageSize={CLIENTS_PER_PAGE}
            total={page.total}
            onPageChange={changePage}
            label="Páginas de clientes"
          />
        </div>
      )}

      <ClientDrawer client={open} onClose={() => setOpen(null)} onEdit={() => open && editClient(open)} />
      <DeleteClientsDialog clients={selectedClients} open={confirming} pending={deleting} onClose={() => setConfirming(false)} onConfirm={removeSelected} />
      <ClientFormDialog
        editor={editor}
        onClose={() => openEditor(null)}
        onSaved={() => {
          openEditor(null);
          router.refresh();
        }}
      />
    </div>
  );
}
