import "server-only";
import Redis from "ioredis";
import { env } from "@/lib/env";

const globalForRedis = globalThis as unknown as { redis?: Redis };

export function getRedis() {
  if (!globalForRedis.redis) {
    globalForRedis.redis = new Redis(env.redis().REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 2,
      connectTimeout: 5000,
      /* Teto por comando, e fila de espera desligada (2026-09-16, correção). Sem os dois, um Redis que
         aceita a conexão e não responde, ou que está fora e volta a tentar sozinho, pendura o comando para
         sempre: a escrita que derruba o cache nunca voltava e o botão de salvar girava sem fim. Com eles, o
         comando falha rápido e cai no tratamento que este módulo já tem, onde falhar é seguir sem cache. */
      commandTimeout: 3000,
      enableOfflineQueue: false,
    });
  }
  return globalForRedis.redis;
}
