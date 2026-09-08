"use client";

import { MagnifyingGlassIcon, PlusIcon, TrashIcon, UploadSimpleIcon } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { PageToolbar } from "@/components/layout/page-toolbar";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { Listbox } from "@/components/ui/listbox";
import { Pagination } from "@/components/ui/pagination";
import { Text } from "@/components/ui/text";
import {
  CLIENTS_PER_PAGE,
  FAVORITE_PARAM,
  PAGE_PARAM,
  PERIOD_PARAM,
  QUERY_PARAM,
  SORT_PARAM,
  defaultQuery,
  favoriteOptions,
  periodOptions,
  sortOptions,
  type ClientListItem,
  type ClientsListPage,
  type ClientsQuery,
} from "../list-options";
import { ClientCard } from "./client-card";
import { ClientDrawer } from "./client-drawer";
import styles from "./clients-board.module.css";

export type ClientsBoardProps = { page: ClientsListPage; query: ClientsQuery };

/** Quanto o campo espera parar de digitar antes de refazer a busca no servidor. */
const TYPING_PAUSE = 320;

// A tela de clientes: a barra de busca e filtros em cima, a grade de cartões no meio e a paginação
// embaixo. O filtro vive na URL e quem faz o trabalho é o servidor, então a página é compartilhável e
// volta igual pelo histórico do navegador; aqui ficam só a seleção, que é da sessão, e a espera do
// campo de busca. Trocar qualquer filtro leva de volta para a primeira página, senão a pessoa cairia
// numa página que o novo filtro nem tem.
export function ClientsBoard({ page, query }: ClientsBoardProps) {
  const router = useRouter();
  const [search, setSearch] = useState(query.search);
  const [selected, setSelected] = useState<string[]>([]);
  // Uma gaveta só para a tela inteira, guardando quem está aberto: assim vinte e quatro cartões não
  // montam vinte e quatro janelas. Fica montada e vazia depois de fechar, para a saída animar.
  const [open, setOpen] = useState<ClientListItem | null>(null);
  const typing = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(typing.current), []);

  const go = (next: Partial<ClientsQuery>) => {
    const merged = { ...query, ...next };
    const params = new URLSearchParams();
    if (merged.search) params.set(QUERY_PARAM, merged.search);
    if (merged.sort !== defaultQuery.sort) params.set(SORT_PARAM, merged.sort);
    if (merged.favorite !== defaultQuery.favorite) params.set(FAVORITE_PARAM, merged.favorite);
    if (merged.period !== defaultQuery.period) params.set(PERIOD_PARAM, merged.period);
    if (merged.page > 1) params.set(PAGE_PARAM, String(merged.page));

    const search = params.toString();
    router.replace(search ? `/clientes?${search}` : "/clientes", { scroll: false });
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

  const count = selected.length;
  const pages = Math.max(1, Math.ceil(page.total / CLIENTS_PER_PAGE));
  // Quantos filtros saíram do padrão, para a etiqueta no botão do celular dizer que há filtro em vigor
  // mesmo com os menus escondidos dentro da janela.
  const changed = [
    query.sort !== defaultQuery.sort,
    query.favorite !== defaultQuery.favorite,
    query.period !== defaultQuery.period,
  ].filter(Boolean).length;

  return (
    <div className={styles.board}>
      <PageToolbar
        activeFilters={changed}
        selectedCount={count}
        search={
          <Input
            type="search"
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder="Busque pelo nome, número ou e-mail"
            aria-label="Buscar cliente"
            iconStart={<MagnifyingGlassIcon />}
            size="sm"
          />
        }
        filters={
          <>
            <Listbox
              label="Classificar clientes"
              prefix="Classificar de"
              options={sortOptions}
              value={query.sort}
              onChange={(sort) => go({ sort, page: 1 })}
            />
            <Listbox
              label="Filtrar por favorito"
              prefix="Favorito"
              options={favoriteOptions}
              value={query.favorite}
              onChange={(favorite) => go({ favorite, page: 1 })}
            />
            <Listbox
              label="Período de entrada"
              prefix="Período"
              options={periodOptions}
              value={query.period}
              onChange={(period) => go({ period, page: 1 })}
            />
          </>
        }
        selection={
          /* Agem sobre o que está marcado, então ficam desligados sem seleção: botão que não faz nada
             ao ser apertado é pior que botão desligado. A contagem vai no nome para o leitor de tela. */
          <>
            <IconButton
              label={count > 0 ? `Excluir ${count} selecionados` : "Excluir selecionados"}
              variant="ghost"
              size="sm"
              disabled={count === 0}
            >
              <TrashIcon />
            </IconButton>
            <IconButton
              label={count > 0 ? `Exportar ${count} selecionados` : "Exportar selecionados"}
              variant="ghost"
              size="sm"
              disabled={count === 0}
            >
              <UploadSimpleIcon />
            </IconButton>
          </>
        }
        action={
          <>
            <span className={styles.wide}>
              <Button href="/clientes" size="sm" iconStart={<PlusIcon />}>
                Criar
              </Button>
            </span>
            <span className={styles.narrow}>
              <IconButton label="Criar cliente" href="/clientes" size="sm" radius="md">
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
            {query.search ? "Nada bateu com o que você procurou. Tente outro nome, telefone ou e-mail." : "Ajuste o período ou o filtro de favoritos para ver mais."}
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
            />
          ))}
        </ul>
      )}

      {/* A barra só existe passando de uma página: com menos ela seria uma faixa sem função no pé. */}
      {pages > 1 && (
        <div className={styles.foot}>
          <Pagination
            page={query.page}
            pageSize={CLIENTS_PER_PAGE}
            total={page.total}
            onPageChange={(next) => go({ page: next })}
            label="Páginas de clientes"
          />
        </div>
      )}

      <ClientDrawer client={open} onClose={() => setOpen(null)} />
    </div>
  );
}
