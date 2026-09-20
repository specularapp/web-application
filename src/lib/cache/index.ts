import "server-only";
import { getRedis } from "@/lib/redis/client";

/**
 * O cache das leituras repetidas, em Redis, com invalidação por tag.
 *
 * Por que aqui e não no cache do Next: tudo o que este produto lê é por pessoa e por organização, e depende
 * de sessão. O cache de dados do framework guarda por rota e por argumento, sem saber quem pediu, e a versão
 * que entende sessão não guarda nada no servidor. Em Redis a chave carrega a organização, o resultado
 * atravessa instâncias (que é o que importa em serverless, onde cada requisição pode cair numa máquina
 * diferente) e a invalidação é do domínio: escreveu um cliente, cai a tag `clients` daquela organização.
 *
 * **Falhar é continuar**: sem Redis configurado, ou com ele fora do ar, `cached` simplesmente executa a
 * leitura. Cache que derruba a página é pior que cache nenhum.
 */
export type CacheTag = string;

/** Quanto cada tipo de leitura fica guardada. Curto de propósito: o produto é de escrita frequente. */
export const cacheTtl = {
  /** O menu inteiro, redesenhado a cada navegação e mudado só por escrita do próprio time. */
  shell: 120,
  /** Listagem de domínio: filtro na URL, então a chave já é específica. */
  list: 30,
  /** Resumos do painel, que somam a base inteira e mudam devagar. */
  summary: 60,
  /** Índice da casa para busca e menção: sete bases juntas, e ninguém nota trinta segundos de atraso. */
  records: 60,
} as const;

const prefix = "sp:cache";

/** A chave de um valor: sempre com a organização dentro, para dois times nunca lerem o mesmo bolo. */
export function cacheKey(organizationId: string, ...parts: (string | number | boolean | null | undefined)[]) {
  return `${prefix}:${organizationId}:${parts.map((part) => String(part ?? "")).join(":")}`;
}

/** A chave do conjunto que guarda quais valores uma tag derruba. */
const tagKey = (organizationId: string, tag: CacheTag) => `${prefix}:tag:${organizationId}:${tag}`;

function redisOrNull() {
  try {
    return getRedis();
  } catch {
    // Sem `REDIS_URL` no ambiente: a aplicação funciona, só não guarda nada.
    return null;
  }
}

/**
 * Lê do cache ou executa a leitura e guarda. As tags são registradas junto, num conjunto por tag, para
 * `dropTags` saber o que apagar sem varrer o Redis com `KEYS`, que trava o servidor numa base grande.
 */
export async function cached<T>(
  key: string,
  options: { organizationId: string; tags: CacheTag[]; ttl: number },
  load: () => Promise<T>,
): Promise<T> {
  const redis = redisOrNull();
  if (!redis) return load();

  try {
    const hit = await redis.get(key);
    if (hit) return JSON.parse(hit) as T;
  } catch {
    return load();
  }

  const value = await load();

  /* `undefined` não vira JSON, e guardar a string "undefined" faria a leitura seguinte devolver lixo. */
  const payload = JSON.stringify(value);
  if (payload === undefined) return value;

  try {
    const pipeline = redis.pipeline();
    pipeline.set(key, payload, "EX", options.ttl);
    for (const tag of options.tags) {
      const set = tagKey(options.organizationId, tag);
      pipeline.sadd(set, key);
      /* O conjunto vive um pouco mais que o valor: sem isso ele viraria lixo permanente numa conta que
         parou de escrever naquele domínio. */
      pipeline.expire(set, options.ttl * 4);
    }
    await pipeline.exec();
  } catch {
    // Guardar é otimização: falhar aqui não muda o que a página mostra.
  }

  return value;
}

/**
 * Derruba tudo que foi guardado sob estas tags, naquela organização. É o que toda escrita chama: a action
 * não precisa saber quais chaves existem, só qual domínio mexeu.
 */
export async function dropTags(organizationId: string, tags: CacheTag[]) {
  const redis = redisOrNull();
  if (!redis || tags.length === 0) return;

  try {
    const sets = tags.map((tag) => tagKey(organizationId, tag));
    const reads = redis.pipeline();
    for (const set of sets) reads.smembers(set);
    const results = await reads.exec();
    const flat = [
      ...new Set(
        (results ?? []).flatMap(([error, value]) =>
          error || !Array.isArray(value) ? [] : value.filter((entry): entry is string => typeof entry === "string"),
        ),
      ),
    ];

    const pipeline = redis.pipeline();
    if (flat.length > 0) pipeline.del(...flat);
    pipeline.del(...sets);
    await pipeline.exec();
  } catch {
    // Mesma regra: se o Redis está fora, o pior que acontece é a leitura seguinte vir do banco.
  }
}
