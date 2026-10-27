import { cookies } from "next/headers";
import { getAiUsageData } from "@/features/ai/queries";
import { first } from "@/lib/utils/search-params";
import { CLIENTS_GRID_COOKIE, CLIENTS_VIEW_COOKIE, defaultPageSize, parseClientsGridSize, parseClientsQuery, parseClientsView } from "../list";
import type { ClientsGroup } from "../list-options";
import { getClientsPage } from "../queries";
import type { Client } from "../summary";
import { ClientsScreen } from "./clients-screen";

export type ClientsRouteProps = {
  /** De que lado da base a tela é: clientes ou fornecedores, cada um na rota dele (2026-10-26, a pedido). */
  group: ClientsGroup;
  search: Record<string, string | string[] | undefined>;
  /** A ficha que a URL pede aberta na janela, ou `"new"` para criar. */
  editing?: Client | "new";
};

// O miolo das seis páginas da base (`/clientes`, `/fornecedores` e o novo e a ficha de cada um), num lugar
// só: a visão e a medida da grade vêm do cookie, o filtro vem da URL e o lado vem da rota, e não mais de um
// parâmetro `grupo`, desde que clientes e fornecedores ganharam telas próprias (2026-10-26, a pedido: "separe
// de fornecedores").
export async function ClientsRoute({ group, search, editing }: ClientsRouteProps) {
  const cookieStore = await cookies();
  const view = parseClientsView(cookieStore.get(CLIENTS_VIEW_COOKIE)?.value);
  const gridSize = parseClientsGridSize(cookieStore.get(CLIENTS_GRID_COOKIE)?.value);
  const query = {
    ...parseClientsQuery(
      {
        busca: first(search.busca),
        favorito: first(search.favorito),
        situacao: first(search.situacao),
        periodo: first(search.periodo),
        email: first(search.email),
        telefone: first(search.telefone),
        pagina: first(search.pagina),
        porPagina: first(search.porPagina),
      },
      defaultPageSize(view, gridSize),
    ),
    group,
  };

  const [page, ai] = await Promise.all([getClientsPage(query, `/${group}`), getAiUsageData()]);

  return <ClientsScreen page={page} query={query} ai={ai} editing={editing} view={view} group={group} />;
}
