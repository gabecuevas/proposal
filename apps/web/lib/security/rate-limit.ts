type RateLimitState = {
  count: number;
  resetAt: number;
};

type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
};

const store = new Map<string, RateLimitState>();
let cleanupCursor = 0;

function cleanupExpired(now: number) {
  cleanupCursor += 1;
  if (cleanupCursor % 250 !== 0) {
    return;
  }
  for (const [key, state] of store.entries()) {
    if (state.resetAt <= now) {
      store.delete(key);
    }
  }
}

export function checkRateLimit(input: {
  key: string;
  limit: number;
  windowMs: number;
  now?: number;
}): RateLimitResult {
  const now = input.now ?? Date.now();
  cleanupExpired(now);

  const existing = store.get(input.key);
  if (!existing || existing.resetAt <= now) {
    const next: RateLimitState = {
      count: 1,
      resetAt: now + input.windowMs,
    };
    store.set(input.key, next);
    return {
      allowed: true,
      limit: input.limit,
      remaining: input.limit - 1,
      resetAt: next.resetAt,
      retryAfterSeconds: Math.max(1, Math.ceil(input.windowMs / 1000)),
    };
  }

  existing.count += 1;
  const remaining = Math.max(0, input.limit - existing.count);
  const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));

  return {
    allowed: existing.count <= input.limit,
    limit: input.limit,
    remaining,
    resetAt: existing.resetAt,
    retryAfterSeconds,
  };
}
