import { z } from "zod";
import { cookieString } from "@/lib/cookies";
import { dashboardBlocks, type DashboardBlockId } from "./blocks";

/** Cookie da preferência de layout do painel: ordem dos blocos e quais ficam escondidos. */
export const LAYOUT_COOKIE = "sp-painel";

export type DashboardLayout = {
  order: DashboardBlockId[];
  hidden: DashboardBlockId[];
};

const ids = dashboardBlocks.map((block) => block.id) as [DashboardBlockId, ...DashboardBlockId[]];
const idSchema = z.enum(ids);
const layoutSchema = z.object({ order: z.array(idSchema), hidden: z.array(idSchema) });

/** A ordem de leitura de `blocks.ts`, com todo bloco à vista. */
export const defaultLayout: DashboardLayout = { order: ids, hidden: [] };

/**
 * Lê o cookie com zod: valor fora do formato cai no padrão em vez de derrubar a página. Bloco que
 * nasceu depois do cookie entra no fim da ordem, e id repetido sai.
 */
export function parseDashboardLayout(raw: string | undefined): DashboardLayout {
  if (!raw) return defaultLayout;
  try {
    const parsed = layoutSchema.parse(JSON.parse(raw));
    const order = [...new Set([...parsed.order, ...ids])];
    return { order, hidden: [...new Set(parsed.hidden)] };
  } catch {
    return defaultLayout;
  }
}

export function serializeDashboardLayout(layout: DashboardLayout) {
  return JSON.stringify(layout);
}

/** Grava a preferência no cookie, no cliente. Vive aqui, fora do componente, porque escrever em `document` de dentro dele o lint barra. */
export function saveDashboardLayout(layout: DashboardLayout) {
  document.cookie = cookieString(LAYOUT_COOKIE, serializeDashboardLayout(layout));
}

/** Verdadeiro quando a pessoa não mexeu em nada: tudo à vista, na ordem de leitura. */
export function isDefaultLayout(layout: DashboardLayout) {
  return layout.hidden.length === 0 && layout.order.every((id, index) => id === defaultLayout.order[index]);
}

export type DashboardSlot = { column: number; row: number; span: 1 | 2 };

/**
 * Empacota os blocos visíveis na estrutura da casa quando a pessoa mexeu no layout. Com uma coluna
 * (celular) a ordem é literal: cada baixo toma uma linha e cada alto duas. Com mais colunas, a grade é
 * feita de andares de duas linhas, e cada coluna de um andar recebe um alto inteiro ou dois baixos
 * empilhados; um alto nunca parte um par de baixos: se a ordem o põe entre dois baixos, o par fecha
 * primeiro e o alto entra logo depois dele (a regra do usuário, 2026-09-07: mover o financeiro para o
 * meio de conquistas e projetos reflete só no celular, e mover para antes dos dois reflete em toda
 * largura). Um baixo que sobra sozinho no fim fica com a metade de baixo vazia. Devolve coluna, linha e
 * altura de cada bloco para a quantidade de colunas pedida. Com o layout padrão a grade não usa isto:
 * segue o mapa de áreas nomeadas de sempre.
 */
export function packDashboard(blocks: { id: DashboardBlockId; tall?: boolean }[], columns: number) {
  const slots = new Map<DashboardBlockId, DashboardSlot>();

  if (columns <= 1) {
    let row = 1;
    for (const block of blocks) {
      const span = block.tall ? 2 : 1;
      slots.set(block.id, { column: 1, row, span });
      row += span;
    }
    return slots;
  }

  const queue = [...blocks];
  let slot = 0;
  const place = (id: DashboardBlockId, offset: 0 | 1, span: 1 | 2) => {
    slots.set(id, { column: (slot % columns) + 1, row: Math.floor(slot / columns) * 2 + offset + 1, span });
  };

  while (queue.length > 0) {
    const block = queue.shift();
    if (!block) break;

    if (block.tall) {
      place(block.id, 0, 2);
      slot += 1;
      continue;
    }

    place(block.id, 0, 1);
    // Fecha o par com o próximo baixo da ordem, mesmo que haja altos entre os dois: eles seguem depois.
    const partner = queue.findIndex((candidate) => !candidate.tall);
    if (partner >= 0) {
      const [below] = queue.splice(partner, 1);
      if (below) place(below.id, 1, 1);
    }
    slot += 1;
  }

  return slots;
}
