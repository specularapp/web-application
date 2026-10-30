import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import styles from "./page-skeleton.module.css";

/**
 * O esqueleto de uma tela, mostrado pelo `loading.tsx` de cada segmento enquanto o servidor busca os dados.
 *
 * É o que faz a navegação parecer instantânea: o Next troca de rota no mesmo quadro do clique e mostra isto,
 * em vez de deixar a tela anterior parada até a consulta voltar. Server Component com CSS Module, zero JS no
 * cliente, como todo primitivo sem interação da casa.
 *
 * Refeito em 2026-10-29 (a pedido: "faça refletir o que será exibido certinho em cada página"): sem o topo com
 * título, que as telas não têm mais, a barra com as mesmas peças e medidas da `PageToolbar` e o corpo no desenho
 * de verdade de cada lista. A tabela é a da casa (moldura, cabeçalho de 36px, linhas de 40px e os fios entre as
 * colunas, com as colunas que a tela passa, e no celular os cartões, que é como as listas aparecem lá); os
 * cartões têm três desenhos, o de registro (cobrança, despesa,
 * parcela, movimentação), o de perfil (clientes e fornecedores) e o de item (catálogo); e o quadro é o das
 * etapas, com as colunas de véu e a pílula no cabeçalho. Quem tem tela própria (fluxo de caixa, contas bancárias,
 * painel) monta o corpo com as peças exportadas daqui dentro de `PageSkeleton`.
 */

export type SkeletonToolbarShape = {
  /** A busca, que toma o que sobra da linha. */
  search?: boolean;
  /** Seletores no começo da barra, como o período e a conta do fluxo de caixa. */
  selects?: number;
  /** O botão de filtros ao lado da busca. */
  filter?: boolean;
  /** O seletor de visão (tabela, cartões, funil). */
  view?: boolean;
  /** Botões de contorno antes da ação, como Exportar ou Transferir. */
  outlines?: number;
  /** A ação principal, com fundo, na ponta. */
  action?: boolean;
};

export type PageSkeletonProps = {
  /** "rows" é o nome antigo da tabela e vale o mesmo; "grid" é o antigo dos cartões. */
  shape?: "table" | "rows" | "cards" | "grid" | "board" | "sections" | "inbox" | "canvas";
  /** As colunas da tabela, em rem, da primeira (o nome, com legenda) à última antes das ações. */
  columns?: number[];
  /** O desenho do cartão na grade. */
  card?: "record" | "profile" | "item";
  /** Quantos cartões, linhas ou colunas desenhar. */
  count?: number;
  /** A barra da tela; `false` nas telas que não têm barra (configurações, currículo, editores). */
  toolbar?: SkeletonToolbarShape | false;
  /** O que o leitor de tela anuncia enquanto isto está no ar. */
  label?: string;
  /** O corpo próprio da tela, no lugar das formas prontas. */
  children?: ReactNode;
};

const DEFAULT_TOOLBAR: SkeletonToolbarShape = { search: true, filter: true, view: true, action: true };

/* As larguras de texto que as células sorteiam, sempre na mesma ordem, para o esqueleto não parecer uma grade
   de tijolos iguais e também não mudar a cada visita. */
const WIDTHS = ["72%", "48%", "60%", "38%", "66%", "54%"];

export function PageSkeleton({ shape = "table", columns, card = "record", count, toolbar = DEFAULT_TOOLBAR, label = "Carregando", children }: PageSkeletonProps) {
  return (
    <div className={styles.screen} data-bare={toolbar ? undefined : ""}>
      <span role="status" aria-live="polite" className={styles.status}>
        {label}
      </span>
      {toolbar ? <SkeletonToolbar {...toolbar} /> : null}
      <div className={styles.body}>
        {children ??
          (shape === "board" ? (
            <SkeletonBoard columns={count} />
          ) : shape === "sections" ? (
            <SkeletonSections count={count} />
          ) : shape === "inbox" ? (
            <SkeletonInbox />
          ) : shape === "canvas" ? (
            <SkeletonCanvas />
          ) : shape === "cards" || shape === "grid" ? (
            <SkeletonCards card={card} count={count} />
          ) : (
            <>
              <SkeletonTable columns={columns} rows={count} />
              <div className={styles.mobileOnly}>
                <SkeletonCards card={card} count={4} />
              </div>
            </>
          ))}
      </div>
    </div>
  );
}

/** A barra da tela: as mesmas peças da `PageToolbar`, com as mesmas alturas e cantos. */
export function SkeletonToolbar({ search = true, selects = 0, filter = false, view = false, outlines = 0, action = false }: SkeletonToolbarShape) {
  return (
    <div className={styles.toolbar}>
      {Array.from({ length: selects }, (_, index) => (
        <Skeleton key={`select-${index}`} shape="rect" className={styles.select} />
      ))}
      {search ? <Skeleton shape="rect" className={styles.search} /> : <span className={styles.spacer} />}
      {filter && <Skeleton shape="rect" className={styles.square} />}
      {view && <Skeleton shape="rect" className={styles.view} />}
      {Array.from({ length: outlines }, (_, index) => (
        <span key={`outline-${index}`} className={styles.outline} />
      ))}
      {action && <Skeleton shape="rect" className={styles.action} />}
    </div>
  );
}

/** A tabela da casa: a moldura que enche a altura, o cabeçalho e as linhas, com a coluna de ações na ponta. */
export function SkeletonTable({ columns = [13, 11, 8, 8, 9, 8], rows = 14, actions = true }: { columns?: number[]; rows?: number; actions?: boolean }) {
  const template = [...columns.map((width, index) => (index === 0 ? `minmax(${width}rem, ${width * 1.4}fr)` : `minmax(${width}rem, ${width}fr)`)), ...(actions ? ["4rem"] : [])].join(" ");
  return (
    <div className={styles.frame}>
      <div className={styles.head} style={{ gridTemplateColumns: template }}>
        {columns.map((_, index) => (
          <span key={index} className={styles.cell}>
            <Skeleton width={index === 0 ? "5rem" : "3.5rem"} height="0.625rem" />
          </span>
        ))}
        {actions && (
          <span className={styles.cell}>
            <Skeleton width="2.5rem" height="0.625rem" />
          </span>
        )}
      </div>
      {Array.from({ length: rows }, (_, row) => (
        <div key={row} className={styles.row} style={{ gridTemplateColumns: template }}>
          {columns.map((_, index) =>
            index === 0 ? (
              <span key={index} className={styles.cell} data-lines="">
                <Skeleton width={WIDTHS[row % WIDTHS.length]} height="0.75rem" />
                <Skeleton width="38%" height="0.5625rem" />
              </span>
            ) : (
              <span key={index} className={styles.cell}>
                <Skeleton width={WIDTHS[(row + index * 2) % WIDTHS.length]} height="0.6875rem" />
              </span>
            ),
          )}
          {actions && (
            <span className={styles.cell} data-end="">
              <Skeleton shape="rect" width="1.5rem" height="1.5rem" />
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

/** A grade de cartões, no desenho de cada tipo de lista. */
export function SkeletonCards({ card = "record", count }: { card?: "record" | "profile" | "item"; count?: number }) {
  const total = count ?? (card === "profile" ? 18 : 9);
  return (
    <div className={styles.grid} data-card={card}>
      {Array.from({ length: total }, (_, index) =>
        card === "profile" ? <ProfileBones key={index} /> : card === "item" ? <ItemBones key={index} index={index} /> : <RecordBones key={index} index={index} />,
      )}
    </div>
  );
}

/* O cartão de registro, no molde do de cobrança e despesa: os dois selos e o leque, o título com o número, a
   pessoa com o rosto, o valor com a condição e o pé com o prazo. */
function RecordBones({ index }: { index: number }) {
  return (
    <div className={styles.card}>
      <div className={styles.line}>
        <Skeleton shape="rect" className={styles.pill} width="5rem" />
        <Skeleton shape="rect" className={styles.pill} width="4.25rem" />
        <span className={styles.spacer} />
        <Skeleton shape="rect" width="1.5rem" height="1.5rem" />
      </div>
      <div className={styles.stack}>
        <Skeleton width={WIDTHS[index % WIDTHS.length]} height="1rem" />
        <Skeleton width="34%" height="0.625rem" />
      </div>
      <div className={styles.line}>
        <Skeleton shape="rect" width="2rem" height="2rem" />
        <div className={styles.stack} data-grow="">
          <Skeleton width="58%" height="0.75rem" />
          <Skeleton width="36%" height="0.625rem" />
        </div>
      </div>
      <div className={styles.stack}>
        <Skeleton width="7.5rem" height="1.25rem" />
        <Skeleton width="44%" height="0.625rem" />
      </div>
      <div className={styles.line}>
        <Skeleton width="34%" height="0.625rem" />
        <span className={styles.spacer} />
        <Skeleton shape="rect" className={styles.pill} width="5.5rem" />
      </div>
    </div>
  );
}

/* O cartão de perfil, o de clientes e fornecedores: a caixa de marcar e o leque nas quinas, o rosto grande no
   meio e o nome embaixo. */
function ProfileBones() {
  return (
    <div className={styles.card} data-card="profile">
      <div className={styles.line}>
        <Skeleton shape="rect" width="1.125rem" height="1.125rem" />
        <span className={styles.spacer} />
        <Skeleton shape="rect" width="1rem" height="1.25rem" />
      </div>
      <Skeleton shape="circle" className={styles.face} />
      <Skeleton width="72%" height="0.75rem" className={styles.center} />
    </div>
  );
}

/* O cartão de item, o do catálogo: a arte, o nome e a categoria com o leque, a descrição em duas linhas, as
   pílulas do que entra e o pé com o preço e a situação. */
function ItemBones({ index }: { index: number }) {
  return (
    <div className={styles.card}>
      <div className={styles.line}>
        <Skeleton shape="rect" width="2.5rem" height="2.5rem" />
        <div className={styles.stack} data-grow="">
          <Skeleton width={WIDTHS[index % WIDTHS.length]} height="0.875rem" />
          <Skeleton width="40%" height="0.625rem" />
        </div>
        <Skeleton shape="rect" width="1.5rem" height="1.5rem" />
      </div>
      <div className={styles.stack}>
        <Skeleton width="100%" height="0.6875rem" />
        <Skeleton width="68%" height="0.6875rem" />
      </div>
      <div className={styles.line}>
        <Skeleton shape="rect" className={styles.pill} width="4rem" />
        <Skeleton shape="rect" className={styles.pill} width="5rem" />
      </div>
      <div className={styles.line} data-foot="">
        <Skeleton width="6rem" height="1.125rem" />
        <span className={styles.spacer} />
        <Skeleton shape="rect" className={styles.pill} width="4rem" />
      </div>
    </div>
  );
}

/* Quantos cartões cada etapa mostra: cheias e vazias lado a lado, como o quadro costuma estar. */
const STACKS = [3, 2, 4, 1, 2, 3];

/** O quadro de etapas: as colunas com o véu, a pílula do nome no cabeçalho e os cartões empilhados. */
export function SkeletonBoard({ columns = 5 }: { columns?: number }) {
  return (
    <div className={styles.board}>
      {Array.from({ length: columns }, (_, column) => (
        <div key={column} className={styles.column}>
          <div className={styles.line}>
            <Skeleton shape="rect" width="8.5rem" height="2rem" />
            <span className={styles.spacer} />
            <Skeleton shape="rect" width="1.5rem" height="1.5rem" />
            <Skeleton shape="rect" width="1.5rem" height="1.5rem" />
          </div>
          {Array.from({ length: STACKS[column % STACKS.length] }, (_, index) => (
            <div key={index} className={styles.ticket}>
              <div className={styles.line}>
                <Skeleton shape="rect" className={styles.pill} width="3.75rem" />
                <Skeleton width="5rem" height="0.625rem" />
              </div>
              <div className={styles.stack}>
                <Skeleton width={WIDTHS[(column + index) % WIDTHS.length]} height="0.9375rem" />
                <Skeleton width="92%" height="0.6875rem" />
                <Skeleton width="58%" height="0.6875rem" />
              </div>
              <div className={styles.line}>
                <Skeleton shape="circle" width="1.5rem" height="1.5rem" />
                <span className={styles.spacer} />
                <Skeleton shape="rect" className={styles.pill} width="4rem" />
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/** As telas de seções (configurações, conquistas, currículo, resultados): caixas empilhadas com o título e os
    campos ou as linhas dentro. */
export function SkeletonSections({ count = 3 }: { count?: number }) {
  return (
    <div className={styles.sections}>
      {Array.from({ length: count }, (_, section) => (
        <div key={section} className={styles.section}>
          <div className={styles.stack}>
            <Skeleton width="10rem" height="1rem" />
            <Skeleton width="18rem" height="0.6875rem" />
          </div>
          <div className={styles.fields}>
            {Array.from({ length: section === 0 ? 4 : 2 }, (_, field) => (
              <div key={field} className={styles.stack}>
                <Skeleton width="6rem" height="0.6875rem" />
                <Skeleton shape="rect" height="2.25rem" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** A caixa de entrada (respostas do NPS): a lista de conversas à esquerda e a conversa aberta à direita. */
export function SkeletonInbox() {
  return (
    <div className={styles.inbox}>
      <div className={styles.inboxList}>
        {Array.from({ length: 9 }, (_, index) => (
          <div key={index} className={styles.line} data-row="">
            <Skeleton shape="circle" width="2.25rem" height="2.25rem" />
            <div className={styles.stack} data-grow="">
              <Skeleton width={WIDTHS[index % WIDTHS.length]} height="0.75rem" />
              <Skeleton width="80%" height="0.625rem" />
            </div>
            <Skeleton width="2rem" height="0.625rem" />
          </div>
        ))}
      </div>
      <div className={styles.thread}>
        {["58%", "42%", "64%", "36%"].map((width, index) => (
          <Skeleton key={index} shape="rect" className={styles.bubble} width={width} data-side={index % 2 ? "end" : undefined} />
        ))}
      </div>
    </div>
  );
}

/** O quadro de edição (o fluxo de marketing): a área pontilhada com os passos em fila no meio. */
export function SkeletonCanvas() {
  return (
    <div className={styles.canvas}>
      {Array.from({ length: 4 }, (_, index) => (
        <div key={index} className={styles.node}>
          <Skeleton shape="rect" width="2rem" height="2rem" />
          <div className={styles.stack} data-grow="">
            <Skeleton width="60%" height="0.75rem" />
            <Skeleton width="40%" height="0.625rem" />
          </div>
        </div>
      ))}
    </div>
  );
}
