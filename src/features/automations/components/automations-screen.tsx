import { Topbar } from "@/components/layout/topbar";
import type { AiUsage } from "@/features/ai/summary";
import type { AutomationsListPage, AutomationsQuery } from "../list-options";
import { AutomationsBoard } from "./automations-board";
import styles from "./automations-screen.module.css";

export type AutomationsScreenProps = {
  page: AutomationsListPage;
  query: AutomationsQuery;
  ai: AiUsage;
  /** A janela de criar já aberta, quando a URL é `/automacoes/nova`. */
  creating?: boolean;
};

// A tela de automações inteira: o topo padrão da aplicação com o `h1`, e abaixo a prancha com a busca, a
// grade de cartões e a janela de criar. Server Component, na mesma moldura da base de clientes, do catálogo,
// dos projetos e dos contratos: quem tem estado é a prancha.
export function AutomationsScreen({ page, query, ai, creating }: AutomationsScreenProps) {
  return (
    <div className={styles.screen}>
      <Topbar ai={ai} />
      <AutomationsBoard page={page} query={query} creating={creating} />
    </div>
  );
}
