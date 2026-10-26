import "server-only";
import { getRedis } from "@/lib/redis/client";

/**
 * A equipe em uso de cada pessoa, guardada em Redis (2026-10-25, varredura de velocidade).
 *
 * Toda página e toda Server Action resolvem a equipe antes de ler qualquer coisa, e essa leitura do perfil é
 * uma ida ao banco: de onde a equipe trabalha até o Supabase em us-west-2 são uns 300ms, pagos em série antes
 * de cada consulta de verdade. No Redis a mesma resposta volta em uns 13ms.
 *
 * Só guarda equipe que existe: quem ainda não tem nenhuma continua indo ao banco, para o time recém-criado
 * aparecer na hora. Quem troca, cria, arquiva ou aceita convite derruba a própria chave; quem é removido por
 * outra pessoa ou perde a equipe arquivada por outra pessoa fica com o valor velho até o prazo vencer, e a RLS
 * continua recusando o que não for mais dela.
 */
const TTL_SECONDS = 120;
const keyOf = (userId: string) => `sp:current-org:${userId}`;

function redisOrNull() {
  try {
    return getRedis();
  } catch {
    return null;
  }
}

export async function rememberedOrganization(userId: string, load: () => Promise<string | null>): Promise<string | null> {
  const redis = redisOrNull();
  if (redis) {
    try {
      const hit = await redis.get(keyOf(userId));
      if (hit) return hit;
    } catch {
      return load();
    }
  }

  const organizationId = await load();
  if (redis && organizationId) {
    await redis.set(keyOf(userId), organizationId, "EX", TTL_SECONDS).catch(() => undefined);
  }
  return organizationId;
}

export async function forgetOrganization(...userIds: string[]) {
  const redis = redisOrNull();
  if (!redis || userIds.length === 0) return;
  await redis.del(...userIds.map(keyOf)).catch(() => undefined);
}
