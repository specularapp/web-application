import { Topbar } from "@/components/layout/topbar";
import type { AiUsage } from "@/features/ai/summary";
import type { ClientsListPage, ClientsQuery } from "../list-options";
import { ClientsBoard } from "./clients-board";
import styles from "./clients-screen.module.css";

export type ClientsScreenProps = { page: ClientsListPage; query: ClientsQuery; ai: AiUsage };

// A tela de clientes inteira: o topo padrão da aplicação, que sangra de ponta a ponta e traz o `h1`, e
// abaixo a prancha com a busca, a grade e a paginação, essa sim com o recuo da tela. Server Component:
// quem tem estado é a prancha.
export function ClientsScreen({ page, query, ai }: ClientsScreenProps) {
  return (
    <div className={styles.screen}>
      {/* No menu a página se chama "Base de clientes"; no topo dela basta "Clientes". */}
      <Topbar title="Clientes" ai={ai} />
      <ClientsBoard page={page} query={query} />
    </div>
  );
}
