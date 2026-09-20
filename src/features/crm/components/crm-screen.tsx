import { Topbar } from "@/components/layout/topbar";
import type { AiUsage } from "@/features/ai/summary";
import type { CrmStageOverrides } from "../board-cookie";
import type { CrmBoardData, CrmQuery } from "../list-options";
import type { CrmPerson } from "../summary";
import { CrmBoard } from "./crm-board";
import styles from "./crm-screen.module.css";

export type CrmScreenProps = {
  board: CrmBoardData;
  query: CrmQuery;
  /** O que o cookie guardou de decidido em cada etapa: recolhida, aberta, ou ausente para o padrão dela. */
  collapsed: CrmStageOverrides;
  ai: AiUsage;
  /** O nome do quadro no topo, quando não é o do menu: o do funil, na página dele. */
  title?: string;
  /** O endereço em que o filtro é escrito: `/crm`, ou `/crm/<slug>` na página de um funil. */
  basePath: string;
  /** Quem pode assumir uma venda, para os seletores da ficha. */
  team?: CrmPerson[];
  /** O funil deste quadro, quando a página é a de um funil de verdade (o balde não tem etapas próprias). */
  funnelId?: string;
};

// A tela do funil inteira: o topo padrão da aplicação, que sangra de ponta a ponta e traz o `h1`, e abaixo a
// prancha com a busca e o quadro, essa sim com o recuo da tela. Server Component: quem tem estado é a
// prancha. Serve o quadro de todas as oportunidades e o de um funil, que é a mesma tela com outra lista,
// outras etapas e outro nome no topo.
export function CrmScreen({ board, query, collapsed, ai, title, basePath, team, funnelId }: CrmScreenProps) {
  return (
    <div className={styles.screen}>
      <Topbar ai={ai} title={title} />
      <CrmBoard board={board} query={query} collapsed={collapsed} basePath={basePath} team={team} funnelId={funnelId} />
    </div>
  );
}
