import { Topbar } from "@/components/layout/topbar";
import type { AiUsage } from "@/features/ai/summary";
import type { ChargesListPage, ChargesQuery } from "../list-options";
import type { ChargeLookups } from "../service";
import type { Charge } from "../summary";
import type { ChargesView } from "../view-cookie";
import { ChargesBoard } from "./charges-board";
import styles from "./finance-screen.module.css";

export type ChargesScreenProps = {
  page: ChargesListPage;
  query: ChargesQuery;
  view: ChargesView;
  lookups: ChargeLookups;
  ai: AiUsage;
  /** A cobrança que a URL pede aberta na janela (`/cobrancas/<id>`); nada para só listar. */
  viewing?: Charge | null;
  /** A gaveta de criar já aberta, quando a URL é `/cobrancas/nova`. */
  creating?: boolean;
};

// A tela de cobranças: o topo padrão da aplicação com o `h1`, e abaixo a prancha com a busca, a grade ou a
// tabela, a paginação e as janelas. Server Component, na mesma moldura das outras listas.
export function ChargesScreen({ page, query, view, lookups, ai, viewing, creating }: ChargesScreenProps) {
  return (
    <div className={styles.screen}>
      <Topbar ai={ai} />
      <ChargesBoard page={page} query={query} view={view} lookups={lookups} viewing={viewing} creating={creating} />
    </div>
  );
}
