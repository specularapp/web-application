import { Topbar } from "@/components/layout/topbar";
import type { AiUsage } from "@/features/ai/summary";
import type { QuotesListPage, QuotesQuery } from "../list-options";
import type { QuotesView } from "../view-cookie";
import { QuotesBoard } from "./quotes-board";
import styles from "./quotes-screen.module.css";

export type QuotesScreenProps = {
  page: QuotesListPage;
  query: QuotesQuery;
  ai: AiUsage;
  /** O jeito de ver que o cookie guardou, para a lista já nascer na visão certa. */
  view: QuotesView;
};

// A tela de orçamentos: o topo padrão da aplicação e, abaixo, a prancha com a busca e a tabela. Server
// Component: quem tem estado é a prancha. O editor deixou de morar aqui em 2026-09-16: ele virou tela
// própria em `/orcamentos/novo` e `/orcamentos/[id]`, na moldura do editor de contrato.
export function QuotesScreen({ page, query, ai, view }: QuotesScreenProps) {
  return (
    <div className={styles.screen}>
      <Topbar ai={ai} />
      <QuotesBoard page={page} query={query} view={view} />
    </div>
  );
}
