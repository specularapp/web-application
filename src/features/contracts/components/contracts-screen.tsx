import { Topbar } from "@/components/layout/topbar";
import type { AiUsage } from "@/features/ai/summary";
import type { ContractsListPage, ContractsQuery } from "../list-options";
import type { ContractLookups } from "../service";
import type { Contract } from "../summary";
import type { ContractsView } from "../view-cookie";
import { ContractsBoard } from "./contracts-board";
import styles from "./contracts-screen.module.css";

export type ContractsScreenProps = {
  page: ContractsListPage;
  query: ContractsQuery;
  ai: AiUsage;
  /** O jeito de ver que o cookie guardou. */
  view: ContractsView;
  /** As bases que o editor na janela oferece. */
  lookups: ContractLookups;
  /** Se a reescrita por IA está configurada. */
  aiAvailable: boolean;
  /** O contrato que a URL pede aberto na janela (`/contratos/<id>`); nada para só listar. */
  viewing?: Contract | null;
  /** O rascunho que a URL pede aberto no editor (`/contratos/<id>/editar`). */
  editing?: Contract | null;
  /** A janela de criar já aberta, quando a URL é `/contratos/novo`. */
  creating?: boolean;
  /** O que a URL manda preencher na janela de criar: hoje o cliente, vindo do leque da ficha dele. */
  prefill?: { clientId?: string };
};

// A tela de contratos inteira: o topo padrão da aplicação, que sangra de ponta a ponta e traz o `h1`, e abaixo
// a prancha com a busca, o funil ou a tabela e a paginação, essa sim com o recuo da tela. Server Component, na
// mesma moldura da base de clientes e dos orçamentos: quem tem estado é a prancha. `/contratos/[id]`,
// `/contratos/[id]/editar` e `/contratos/novo` montam a mesma tela com a ficha, o editor ou a de criar já
// abertos, então as três têm endereço próprio sem deixar de ser camadas sobre a lista.
export function ContractsScreen({ page, query, ai, view, lookups, aiAvailable, viewing, editing, creating, prefill }: ContractsScreenProps) {
  return (
    <div className={styles.screen}>
      <Topbar ai={ai} />
      <ContractsBoard page={page} query={query} view={view} lookups={lookups} aiAvailable={aiAvailable} viewing={viewing} editing={editing} creating={creating} prefill={prefill} />
    </div>
  );
}
