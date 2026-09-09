import { Topbar } from "@/components/layout/topbar";
import type { AiUsage } from "@/features/ai/summary";
import type { CatalogListPage, CatalogQuery } from "../list-options";
import type { CatalogItem } from "../summary";
import type { CatalogView } from "../view-cookie";
import { CatalogBoard } from "./catalog-board";
import styles from "./catalog-screen.module.css";

export type CatalogScreenProps = {
  page: CatalogListPage;
  query: CatalogQuery;
  ai: AiUsage;
  /** O jeito de ver que o cookie guardou, para a lista já nascer na visão certa. */
  view: CatalogView;
  /** A ficha que a URL pede aberta na gaveta: um item para editar, `"new"` para criar, nada para só listar. */
  editing?: CatalogItem | "new";
};

// A tela do catálogo inteira: o topo padrão da aplicação, que sangra de ponta a ponta e traz o `h1`, e
// abaixo a prancha com a busca, a grade ou a tabela e a paginação, essa sim com o recuo da tela. Server
// Component: quem tem estado é a prancha. Mesma estrutura da base de clientes.
export function CatalogScreen({ page, query, ai, view, editing }: CatalogScreenProps) {
  return (
    <div className={styles.screen}>
      <Topbar ai={ai} />
      <CatalogBoard page={page} query={query} view={view} editing={editing} />
    </div>
  );
}
