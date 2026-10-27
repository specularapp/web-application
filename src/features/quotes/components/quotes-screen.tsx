import { Topbar } from "@/components/layout/topbar";
import type { AiUsage } from "@/features/ai/summary";
import type { QuotesListPage, QuotesQuery } from "../list-options";
import type { Quote } from "../summary";
import type { QuotesView } from "../view-cookie";
import type { QuotePrefill } from "./quote-editor";
import { QuotesBoard, type QuoteEditorData } from "./quotes-board";
import styles from "./quotes-screen.module.css";

export type QuotesScreenProps = {
  page: QuotesListPage;
  query: QuotesQuery;
  ai: AiUsage;
  /** O jeito de ver que o cookie guardou, para a lista já nascer na visão certa. */
  view: QuotesView;
  /** O que o editor precisa para gerar um orçamento na janela, sem sair da lista. */
  editor: QuoteEditorData;
  /** A janela de gerar já aberta, quando a URL é `/orcamentos/novo`. */
  creating?: boolean;
  /** A janela de editar já aberta neste orçamento, quando a URL é `/orcamentos/<id>`. */
  editing?: Quote;
  prefill?: QuotePrefill;
};

// A tela de orçamentos: o topo padrão da aplicação e, abaixo, a prancha com a busca e a tabela. Server
// Component: quem tem estado é a prancha. Gerar e editar são uma janela longa sobre a lista (2026-10-26, a
// pedido), e `/orcamentos/novo` e `/orcamentos/[id]` são esta tela com a janela já aberta.
export function QuotesScreen({ page, query, ai, view, editor, creating, editing, prefill }: QuotesScreenProps) {
  return (
    <div className={styles.screen}>
      <Topbar ai={ai} />
      <QuotesBoard page={page} query={query} view={view} editor={editor} creating={creating} editing={editing} prefill={prefill} />
    </div>
  );
}
