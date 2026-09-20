import { crmStageValues, defaultCrmStages, type CrmStage } from "./stages";
import type { Opportunity } from "./summary";

/**
 * A arquitetura do funil de vendas: pastas dentro de pastas e, nas folhas, funis. É a mesma forma da
 * arquitetura das tarefas, e de propósito: quem aprendeu a se mover numa se move na outra sem reaprender
 * nada. O que muda é o que mora na folha, que ali é projeto e aqui é funil.
 *
 * A pasta só organiza; quem tem quadro é o funil, com as etapas dele. Uma pasta não é um destino, então não
 * tem endereço: clicar nela abre e fecha o galho.
 */

/** Uma pasta: só agrupa, e pode ter pasta dentro. */
export type CrmFolder = {
  kind: "folder";
  id: string;
  name: string;
  children: CrmTreeNode[];
};

/**
 * O desenho de um funil na árvore, por **chave** e não pelo componente do glifo: a árvore é montada no
 * servidor e entregue ao menu, que é componente de cliente, e o que cruza essa fronteira precisa ser
 * serializável. O menu traduz a chave em glifo.
 */
export const funnelGlyphs = ["funnel", "storefront", "megaphone", "handshake", "target", "buildings", "tray"] as const;

export type FunnelGlyph = (typeof funnelGlyphs)[number];

export type CrmFunnel = {
  kind: "funnel";
  id: string;
  /** O endereço da página do quadro: `/crm/<slug>`. */
  slug: string;
  name: string;
  /**
   * O identificador do funil no padrão da casa (`FUN-2026-0002`), o mesmo que a oportunidade carrega.
   * **Nulo é o balde de quem ainda não foi para funil nenhum**: lead solto continua tendo lugar na
   * arquitetura em vez de existir só na lista de tudo.
   */
  reference: string | null;
  /** As etapas do quadro deste funil, na ordem em que as colunas aparecem. */
  stages: CrmStage[];
  /** O glifo do azulejo dele na árvore, que é o que distingue um funil do outro de relance. */
  glyph: FunnelGlyph;
  /** Token de cor do azulejo, como no `NavGroup`. */
  hue: string;
};

export type CrmTreeNode = CrmFolder | CrmFunnel;

export const isCrmFolder = (node: CrmTreeNode): node is CrmFolder => node.kind === "folder";

/**
 * A árvore como o menu a desenha: a mesma forma, com a contagem em cada nó e sem as etapas, que são coisa da
 * página. A contagem é **do que está em aberto**, e não do total: no menu ela responde "quanto ainda dá para
 * fechar aqui", e o funil que já fechou tudo mostra zero em vez de mostrar a própria história. Pasta soma os
 * filhos.
 */
export type CrmTreeItem =
  | { kind: "folder"; id: string; name: string; open: number; children: CrmTreeItem[] }
  | {
      kind: "funnel";
      id: string;
      slug: string;
      name: string;
      open: number;
      glyph: FunnelGlyph;
      hue: string;
      /** As etapas do funil, para o leque do menu arrumá-las sem ir à página. */
      stages: CrmStage[];
      /** O balde "Sem funil": não se edita nem se apaga. */
      bucket?: boolean;
    };

/** As oportunidades de um funil: as do identificador dele, ou as sem funil nenhum quando ele é o balde. */
export function opportunitiesOfFunnel(opportunities: Opportunity[], funnel: CrmFunnel) {
  if (funnel.reference === null) return opportunities.filter((opportunity) => !opportunity.funnel);
  return opportunities.filter((opportunity) => opportunity.funnel?.reference === funnel.reference);
}

/**
 * Quantas oportunidades em aberto cada funil tem, e quantas estão no balde. Vem contada do banco pelo mesmo
 * motivo da árvore de tarefas: o menu é desenhado em toda navegação.
 */
export type CrmOpenCounts = { byFunnel: Record<string, number>; loose: number };

export const noCrmCounts: CrmOpenCounts = { byFunnel: {}, loose: 0 };

/** A árvore com as contagens resolvidas, pronta para o menu. Roda no servidor, junto da concha. */
export function buildCrmTree(nodes: CrmTreeNode[], counts: CrmOpenCounts): CrmTreeItem[] {
  return nodes.map((node): CrmTreeItem => {
    if (isCrmFolder(node)) {
      const children = buildCrmTree(node.children, counts);
      return {
        kind: "folder",
        id: node.id,
        name: node.name,
        open: children.reduce((sum, child) => sum + child.open, 0),
        children,
      };
    }

    return {
      kind: "funnel",
      id: node.id,
      slug: node.slug,
      name: node.name,
      open: node.reference === null ? counts.loose : (counts.byFunnel[node.id] ?? 0),
      glyph: node.glyph,
      hue: node.hue,
      stages: node.stages,
      bucket: node.reference === null || undefined,
    };
  });
}

/** Todos os funis da árvore, achatados, na ordem em que aparecem. */
export function flattenFunnels(nodes: CrmTreeNode[]): CrmFunnel[] {
  return nodes.flatMap((node) => (isCrmFolder(node) ? flattenFunnels(node.children) : [node]));
}

/** O funil de um endereço, ou nulo quando o slug não existe, o que a página trata como 404. */
export function findFunnel(nodes: CrmTreeNode[], slug: string) {
  return flattenFunnels(nodes).find((funnel) => funnel.slug === slug) ?? null;
}

/** Os ids das pastas que levam até um funil, para o menu abrir o galho onde a pessoa está. */
export function pathToFunnel(items: CrmTreeItem[], slug: string, trail: string[] = []): string[] {
  for (const item of items) {
    if (item.kind === "folder") {
      const found = pathToFunnel(item.children, slug, [...trail, item.id]);
      if (found.length > 0) return found;
    } else if (item.slug === slug) {
      return trail;
    }
  }
  return [];
}

/**
 * As etapas que o quadro de todas as oportunidades mostra: as que de fato têm alguma, na ordem do catálogo.
 * Ele cruza funis com caminhos diferentes, então uma lista fixa esconderia o que está numa etapa que só um
 * deles usa. Sem oportunidade nenhuma, valem as etapas padrão, para o quadro não abrir sem coluna.
 */
export function crmStagesInUse(opportunities: Opportunity[]): CrmStage[] {
  const used = new Set(opportunities.map((opportunity) => opportunity.stage));
  const present = crmStageValues.filter((stage) => used.has(stage));
  return present.length > 0 ? present : defaultCrmStages;
}
