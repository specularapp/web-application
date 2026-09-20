"use client";

import { useRouter } from "next/navigation";
import { Topbar } from "@/components/layout/topbar";
import type { AiUsage } from "@/features/ai/summary";
import type { CatalogItem } from "@/features/catalog/summary";
import type { ClientListItem } from "@/features/clients/list-options";
import type { Quote, QuoteIssuer, QuotePerson } from "../summary";
import { QuoteEditor, type QuotePrefill } from "./quote-editor";
import styles from "./quotes-screen.module.css";

export type QuoteEditorScreenProps = {
  /** O orçamento que está sendo editado; ausente é um novo. */
  quote?: Quote;
  clients: ClientListItem[];
  catalog: CatalogItem[];
  issuer: QuoteIssuer;
  owner: QuotePerson;
  nextNumber: string;
  prefill?: QuotePrefill;
  ai: AiUsage;
};

/**
 * A tela do editor de orçamento: o topo padrão da aplicação, com o nome trocado, e o editor tomando o resto.
 * A mesma moldura do editor de contrato (2026-09-16, a pedido), no lugar da janela sobre a lista: montar um
 * orçamento é trabalho de tela inteira, e janela some por engano no toque fora.
 *
 * Sair e salvar levam de volta à lista, porque o editor é um destino e não uma camada.
 */
export function QuoteEditorScreen({ quote, clients, catalog, issuer, owner, nextNumber, prefill, ai }: QuoteEditorScreenProps) {
  const router = useRouter();
  const leave = () => router.push("/orcamentos");

  return (
    <div className={styles.screen}>
      <Topbar title={quote ? "Editor de orçamento" : "Novo orçamento"} ai={ai} />
      <QuoteEditor
        quote={quote}
        clients={clients}
        catalog={catalog}
        issuer={issuer}
        owner={owner}
        nextNumber={nextNumber}
        prefill={prefill}
        onLeave={leave}
        onSaved={leave}
      />
    </div>
  );
}
