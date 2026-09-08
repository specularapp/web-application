"use client";

import {
  ArrowCounterClockwiseIcon,
  ArrowsDownUpIcon,
  CalendarBlankIcon,
  CheckCircleIcon,
  EnvelopeSimpleIcon,
  MinusCircleIcon,
  PhoneIcon,
  PlusIcon,
  ProhibitIcon,
  StarIcon,
  UsersIcon,
  type Icon,
} from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { startTransition, useEffect, useRef, useState } from "react";
import { PageToolbar } from "@/components/layout/page-toolbar";
import { Button } from "@/components/ui/button";
import type { DropdownSection } from "@/components/ui/dropdown-menu";
import { IconButton } from "@/components/ui/icon-button";
import { Pagination } from "@/components/ui/pagination";
import { Text } from "@/components/ui/text";
import {
  CLIENTS_PER_PAGE,
  EMAIL_PARAM,
  FAVORITE_PARAM,
  PAGE_PARAM,
  PERIOD_PARAM,
  PHONE_PARAM,
  QUERY_PARAM,
  SORT_PARAM,
  STATUS_PARAM,
  clearedFilters,
  countMenuFilters,
  countQuickFilters,
  defaultQuery,
  favoriteOptions,
  periodOptions,
  sortOptions,
  statusOptions,
  type ClientListItem,
  type ClientsFavorite,
  type ClientsListPage,
  type ClientsQuery,
  type ClientsStatus,
} from "../list-options";
import { ClientCard } from "./client-card";
import { ClientDrawer } from "./client-drawer";
import styles from "./clients-board.module.css";

export type ClientsBoardProps = { page: ClientsListPage; query: ClientsQuery };

/** Quanto o campo espera parar de digitar antes de refazer a busca no servidor. */
const TYPING_PAUSE = 320;

/* Um glifo por opção, para cada uma se reconhecer antes de ler: todos, os marcados e os de fora. */
const favoriteIcons: Record<ClientsFavorite, Icon> = { todos: UsersIcon, favoritos: StarIcon, outros: ProhibitIcon };
const statusIcons: Record<ClientsStatus, Icon> = { todos: UsersIcon, ativos: CheckCircleIcon, inativos: MinusCircleIcon };

// A tela de clientes: a barra de busca e filtros em cima, a grade de cartões no meio e a paginação
// embaixo. O filtro vive na URL e quem faz o trabalho é o servidor, então a página é compartilhável e
// volta igual pelo histórico do navegador; aqui ficam só a seleção dos cartões, que é da sessão, e a
// espera do campo de busca. Trocar qualquer filtro leva de volta para a primeira página, senão a pessoa cairia
// numa página que o novo filtro nem tem.
export function ClientsBoard({ page, query }: ClientsBoardProps) {
  const router = useRouter();
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
  // Quem está marcado na grade. As ações sobre a seleção ainda não existem; a marcação fica para elas.
  const [selected, setSelected] = useState<string[]>([]);
  // Uma gaveta só para a tela inteira, guardando quem está aberto: assim vinte e quatro cartões não
  // montam vinte e quatro janelas. Fica montada e vazia depois de fechar, para a saída animar.
  const [open, setOpen] = useState<ClientListItem | null>(null);
  const typing = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(typing.current), []);

  const go = (next: Partial<ClientsQuery>) => {
    const merged = { ...live, ...next };
    setLive(merged);
    const params = new URLSearchParams();
    if (merged.search) params.set(QUERY_PARAM, merged.search);
    if (merged.sort !== defaultQuery.sort) params.set(SORT_PARAM, merged.sort);
    if (merged.favorite !== defaultQuery.favorite) params.set(FAVORITE_PARAM, merged.favorite);
    if (merged.status !== defaultQuery.status) params.set(STATUS_PARAM, merged.status);
    if (merged.period !== defaultQuery.period) params.set(PERIOD_PARAM, merged.period);
    if (merged.withEmail) params.set(EMAIL_PARAM, "1");
    if (merged.withPhone) params.set(PHONE_PARAM, "1");
    if (merged.page > 1) params.set(PAGE_PARAM, String(merged.page));

    const search = params.toString();
    startTransition(() => router.replace(search ? `/clientes?${search}` : "/clientes", { scroll: false }));
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

  const pages = Math.max(1, Math.ceil(page.total / CLIENTS_PER_PAGE));
  const menuFilters = countMenuFilters(live);
  const quickFilters = countQuickFilters(live);

  /* O menu de filtros: cada escolha vale na hora e não fecha o menu, porque a pessoa costuma ajustar
     mais de uma coisa antes de sair. Favoritos e situação são escolha única, marcada pelo check; e-mail
     e telefone são interruptores; e limpar volta tudo ao padrão, ordem e período inclusive, porque no
     celular eles moram dentro deste mesmo menu. */
  const filterSections: DropdownSection[] = [
    {
      id: "favorite",
      label: "Favoritos",
      items: favoriteOptions.map((option) => ({
        id: `favorite-${option.value}`,
        label: option.label,
        icon: favoriteIcons[option.value],
        selected: live.favorite === option.value,
        keepOpen: true,
        onSelect: () => go({ favorite: option.value, page: 1 }),
      })),
    },
    {
      id: "status",
      label: "Situação",
      items: statusOptions.map((option) => ({
        id: `status-${option.value}`,
        label: option.label,
        icon: statusIcons[option.value],
        selected: live.status === option.value,
        keepOpen: true,
        onSelect: () => go({ status: option.value, page: 1 }),
      })),
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
    ...(menuFilters + quickFilters > 0
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
        quickFilters={[
          /* Ordem e período ficam à vista, só no ícone: são os que a pessoa troca toda hora ao varrer a
             base. O escolhido vai marcado e no nome acessível do gatilho, e escolher fecha, como o
             período do painel. Quem veste o botão é a barra. */
          {
            label: "Ordem dos clientes",
            triggerLabel: `Ordem: ${sortOptions.find((option) => option.value === live.sort)?.label ?? ""}`,
            icon: <ArrowsDownUpIcon />,
            sections: [
              {
                id: "sort",
                label: "Ordem",
                items: sortOptions.map((option) => ({
                  id: option.value,
                  label: option.label,
                  selected: option.value === live.sort,
                  onSelect: () => go({ sort: option.value, page: 1 }),
                })),
              },
            ],
          },
          {
            label: "Período de entrada",
            triggerLabel: `Período: ${periodOptions.find((option) => option.value === live.period)?.label ?? ""}`,
            icon: <CalendarBlankIcon />,
            sections: [
              {
                id: "period",
                label: "Período",
                items: periodOptions.map((option) => ({
                  id: option.value,
                  label: option.label,
                  selected: option.value === live.period,
                  onSelect: () => go({ period: option.value, page: 1 }),
                })),
              },
            ],
          },
        ]}
        activeQuickFilters={quickFilters}
        filters={filterSections}
        activeFilters={menuFilters}
        action={
          <>
            <span className={styles.wide}>
              <Button href="/clientes" size="sm" radius="md" iconStart={<PlusIcon />}>
                Novo cliente
              </Button>
            </span>
            <span className={styles.narrow}>
              <IconButton label="Novo cliente" href="/clientes" size="sm" radius="md">
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
            onPageChange={(next) => go({ page: next })}
            label="Páginas de clientes"
          />
        </div>
      )}

      <ClientDrawer client={open} onClose={() => setOpen(null)} />
    </div>
  );
}
