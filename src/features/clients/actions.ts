"use server";

import { previewClients } from "./list-preview";
import type { Client } from "./summary";

/**
 * A ficha completa de um cliente, buscada quando a gaveta lateral abre.
 *
 * É buscada, e não mandada junto da listagem, de propósito: a ficha tem anotações, etiquetas,
 * orçamentos e projetos, e vinte e quatro delas por página encheriam a carga com o que a grade nem
 * desenha. O cartão carrega só o que mostra, e o resto chega quando alguém pede.
 *
 * Hoje lê da prévia porque **o domínio não existe no banco**. Quando a tabela nascer, o corpo vira uma
 * consulta com a RLS valendo e a assinatura continua a mesma; a mesma leitura ganha um `service.ts` e um
 * Route Handler em `api/v1` para o aplicativo, no contrato que `organizations` já segue.
 */
export async function loadClientAction(id: string): Promise<Client | null> {
  return previewClients.find((client) => client.id === id) ?? null;
}
