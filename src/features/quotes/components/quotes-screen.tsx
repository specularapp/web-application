import { Topbar } from "@/components/layout/topbar";
import type { AiUsage } from "@/features/ai/summary";
import type { CatalogItem } from "@/features/catalog/summary";
import type { ClientListItem } from "@/features/clients/list-options";
import type { QuotesListPage, QuotesQuery } from "../list-options";
import type { Quote, QuoteIssuer, QuotePerson } from "../summary";
import type { QuotesView } from "../view-cookie";
import { QuotesBoard } from "./quotes-board";
import type { QuotePrefill } from "./quote-editor-dialog";
import styles from "./quotes-screen.module.css";

export type QuotesScreenProps = {
  page: QuotesListPage;
  query: QuotesQuery;
  ai: AiUsage;
  editing?: Quote | "new";
  prefill?: QuotePrefill;
  clients: ClientListItem[];
  catalog: CatalogItem[];
  issuer: QuoteIssuer;
  owner: QuotePerson;
  nextNumber: string;
  /** O jeito de ver que o cookie guardou, para a lista já nascer na visão certa. */
  view: QuotesView;
};

// A tela de orçamentos inteira: o topo padrão da aplicação e, abaixo, a prancha com a busca, a tabela e o
// editor. Server Component: quem tem estado é a prancha. `/orcamentos/novo` e `/orcamentos/[id]` montam a
// mesma tela com o editor já aberto, então o orçamento tem endereço próprio sem deixar de ser uma janela
// sobre a lista.
export function QuotesScreen({ page, query, ai, editing, prefill, clients, catalog, issuer, owner, nextNumber, view }: QuotesScreenProps) {
  return (
    <div className={styles.screen}>
      <Topbar ai={ai} />
      <QuotesBoard page={page} query={query} editing={editing} prefill={prefill} clients={clients} catalog={catalog} issuer={issuer} owner={owner} nextNumber={nextNumber} view={view} />
    </div>
  );
}
