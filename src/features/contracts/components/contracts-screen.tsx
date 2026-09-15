import { Topbar } from "@/components/layout/topbar";
import type { AiUsage } from "@/features/ai/summary";
import type { ContractsListPage, ContractsQuery } from "../list-options";
import type { Contract } from "../summary";
import { ContractsBoard } from "./contracts-board";
import styles from "./contracts-screen.module.css";

export type ContractsScreenProps = {
  page: ContractsListPage;
  query: ContractsQuery;
  ai: AiUsage;
  /** O contrato que a URL pede aberto na janela (`/contratos/<id>`); nada para só listar. */
  viewing?: Contract | null;
  /** A janela de criar já aberta, quando a URL é `/contratos/novo`. */
  creating?: boolean;
};

// A tela de contratos inteira: o topo padrão da aplicação, que sangra de ponta a ponta e traz o `h1`, e abaixo
// a prancha com a busca, a grade de cartões e a paginação, essa sim com o recuo da tela. Server Component, na
// mesma moldura da base de clientes, do catálogo e dos projetos: quem tem estado é a prancha. `/contratos/[id]`
// e `/contratos/novo` montam a mesma tela com a janela do contrato ou a de criar já abertas, então as duas têm
// endereço próprio sem deixar de ser camadas sobre a lista.
export function ContractsScreen({ page, query, ai, viewing, creating }: ContractsScreenProps) {
  return (
    <div className={styles.screen}>
      <Topbar ai={ai} />
      <ContractsBoard page={page} query={query} viewing={viewing} creating={creating} />
    </div>
  );
}
