import { Skeleton } from "@/components/ui/skeleton";
import { rounded } from "@/lib/corners";
import styles from "./page-skeleton.module.css";

/**
 * O esqueleto de uma tela, mostrado pelo `loading.tsx` de cada segmento enquanto o servidor busca os dados.
 *
 * É o que faz a navegação parecer instantânea: o Next troca de rota no mesmo quadro do clique e mostra isto,
 * em vez de deixar a tela anterior parada até a consulta voltar. Server Component com CSS Module, zero JS no
 * cliente, como todo primitivo sem interação da casa.
 *
 * Três formas, porque as telas têm três: grade de cartões (clientes, catálogo, projetos, contratos), quadro
 * de colunas (tarefas, funil) e lista em linhas (cobranças, movimentações).
 */
export type PageSkeletonProps = {
  shape?: "grid" | "board" | "rows";
  /** Quantos vultos desenhar. O padrão é o que costuma caber numa tela sem rolar. */
  count?: number;
  /** O que o leitor de tela anuncia enquanto isto está no ar. */
  label?: string;
};

export function PageSkeleton({ shape = "grid", count = 8, label = "Carregando" }: PageSkeletonProps) {
  return (
    <div className={styles.screen}>
      <span role="status" aria-live="polite" className={styles.status}>
        {label}
      </span>

      <div className={styles.top}>
        <Skeleton width="10rem" height="1.25rem" />
        <Skeleton shape="rect" width="7rem" height="2rem" />
      </div>

      <div className={styles.body}>
        <div className={styles.toolbar}>
          <Skeleton shape="rect" width="16rem" height="2.25rem" />
          <Skeleton shape="rect" width="6rem" height="2.25rem" />
          <span className={styles.spacer} />
          <Skeleton shape="rect" width="5rem" height="2.25rem" />
        </div>

        {shape === "grid" && <GridBones count={count} />}
        {shape === "board" && <BoardBones />}
        {shape === "rows" && <RowBones count={count} />}
      </div>
    </div>
  );
}

function GridBones({ count }: { count: number }) {
  return (
    <div className={styles.grid}>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className={styles.card} {...rounded("lg")}>
          <div className={styles.cardHead}>
            <Skeleton shape="circle" width="2.5rem" height="2.5rem" />
            <div className={styles.cardLines}>
              <Skeleton width="8rem" height="0.9rem" />
              <Skeleton width="5rem" height="0.75rem" />
            </div>
          </div>
          <Skeleton width="100%" height="0.75rem" />
          <Skeleton width="70%" height="0.75rem" />
        </div>
      ))}
    </div>
  );
}

function BoardBones() {
  /* Quatro colunas com alturas diferentes: coluna cheia e coluna vazia lado a lado é o que o quadro é. */
  const cards = [3, 2, 4, 2];

  return (
    <div className={styles.board}>
      {cards.map((total, column) => (
        <div key={column} className={styles.column}>
          <Skeleton width="7rem" height="1rem" />
          {Array.from({ length: total }, (_, index) => (
            <div key={index} className={styles.card} {...rounded("lg")}>
              <Skeleton width="80%" height="0.9rem" />
              <Skeleton width="55%" height="0.75rem" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function RowBones({ count }: { count: number }) {
  return (
    <div className={styles.rows}>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className={styles.row} {...rounded("md")}>
          <Skeleton shape="circle" width="2rem" height="2rem" />
          <Skeleton width="12rem" height="0.9rem" />
          <span className={styles.spacer} />
          <Skeleton width="5rem" height="0.9rem" />
        </div>
      ))}
    </div>
  );
}
