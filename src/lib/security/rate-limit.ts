import "server-only";
import { getRedis } from "@/lib/redis/client";

export type RateLimitRule = { limit: number; windowSeconds: number };

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
};

export const rateLimitRules = {
  auth: { limit: 10, windowSeconds: 60 },
  authTotal: { limit: 30, windowSeconds: 60 },
  authEmail: { limit: 5, windowSeconds: 900 },
  action: { limit: 120, windowSeconds: 60 },
  ai: { limit: 20, windowSeconds: 60 },
  publicLink: { limit: 30, windowSeconds: 60 },
} as const satisfies Record<string, RateLimitRule>;

export type RateLimitScope = keyof typeof rateLimitRules;

const slidingWindow = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local member = ARGV[4]
local start = now - window

redis.call('ZREMRANGEBYSCORE', key, '-inf', start)
local used = redis.call('ZCARD', key)

if used >= limit then
  local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
  local retry = window
  if oldest[2] then
    retry = math.ceil((tonumber(oldest[2]) + window - now) / 1000)
  end
  if retry < 1 then retry = 1 end
  return { 0, 0, retry }
end

redis.call('ZADD', key, now, member)
redis.call('PEXPIRE', key, window)
return { 1, limit - used - 1, 0 }
`;

const windowCount = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
redis.call('ZREMRANGEBYSCORE', key, '-inf', now - window)
return redis.call('ZCARD', key)
`;

function allow(rule: RateLimitRule): RateLimitResult {
  return { allowed: true, limit: rule.limit, remaining: rule.limit - 1, retryAfterSeconds: 0 };
}

export async function peekRateLimit(scope: RateLimitScope, identifier: string): Promise<boolean> {
  const rule = rateLimitRules[scope];
  try {
    const used = await getRedis().eval(
      windowCount,
      1,
      `ratelimit:${scope}:${identifier}`,
      Date.now().toString(),
      (rule.windowSeconds * 1000).toString(),
    );
    return Number(used) < rule.limit;
  } catch {
    return true;
  }
}

export async function checkRateLimit(
  scope: RateLimitScope,
  identifier: string,
  requestId: string,
): Promise<RateLimitResult> {
  const rule = rateLimitRules[scope];
  const key = `ratelimit:${scope}:${identifier}`;
  const windowMs = rule.windowSeconds * 1000;

  try {
    const raw = await getRedis().eval(
      slidingWindow,
      1,
      key,
      Date.now().toString(),
      windowMs.toString(),
      rule.limit.toString(),
      requestId,
    );

    const [allowed, remaining, retryAfterSeconds] = raw as [number, number, number];
    return {
      allowed: allowed === 1,
      limit: rule.limit,
      remaining,
      retryAfterSeconds,
    };
  } catch {
    return allow(rule);
  }
}

export function clientIp(headers: Headers) {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("x-real-ip") ?? "desconhecido";
}

export function rateLimitHeaders(result: RateLimitResult) {
  const headers: Record<string, string> = {
    "RateLimit-Limit": result.limit.toString(),
    "RateLimit-Remaining": result.remaining.toString(),
  };
  if (!result.allowed) headers["Retry-After"] = result.retryAfterSeconds.toString();
  return headers;
}
