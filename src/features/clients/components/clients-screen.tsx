import { Topbar } from "@/components/layout/topbar";
import type { AiUsage } from "@/features/ai/summary";
import type { ClientsListPage, ClientsQuery } from "../list-options";
import type { Client } from "../summary";
import { ClientsBoard } from "./clients-board";
import styles from "./clients-screen.module.css";

export type ClientsScreenProps = {
  page: ClientsListPage;
  query: ClientsQuery;
  ai: AiUsage;
  /** A ficha que a URL pede aberta na janela: uma ficha para editar, `"new"` para criar, nada para só listar. */
  editing?: Client | "new";
};

// A tela de clientes inteira: o topo padrão da aplicação, que sangra de ponta a ponta e traz o `h1`, e
// abaixo a prancha com a busca, a grade e a paginação, essa sim com o recuo da tela. Server Component:
// quem tem estado é a prancha. `/clientes/novo` e `/clientes/[id]` montam a mesma tela com a janela da
// ficha já aberta, então a ficha tem endereço próprio sem deixar de ser uma janela sobre a lista.
export function ClientsScreen({ page, query, ai, editing }: ClientsScreenProps) {
  return (
    <div className={styles.screen}>
      {/* No menu a página se chama "Base de clientes"; no topo dela basta "Clientes". */}
      <Topbar title="Clientes" ai={ai} />
      <ClientsBoard page={page} query={query} editing={editing} />
    </div>
  );
}
