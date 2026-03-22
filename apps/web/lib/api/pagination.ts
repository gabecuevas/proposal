import type { NextRequest } from "next/server";

export type CursorPagination = {
  limit: number;
  before?: Date;
};

export function parseCursorPagination(request: NextRequest, defaultLimit: number): CursorPagination {
  const url = new URL(request.url);
  const rawLimit = Number(url.searchParams.get("limit") ?? defaultLimit);
  const limit = Number.isFinite(rawLimit) ? Math.min(200, Math.max(1, Math.trunc(rawLimit))) : defaultLimit;
  const beforeRaw = url.searchParams.get("before");
  const before = beforeRaw ? new Date(beforeRaw) : undefined;
  return {
    limit,
    before: before && !Number.isNaN(before.getTime()) ? before : undefined,
  };
}

export function getNextCursorFromTimestampPage<T>(
  items: T[],
  limit: number,
  getTimestamp: (item: T) => string | Date,
) {
  const hasMore = items.length > limit;
  const pageItems = hasMore ? items.slice(0, limit) : items;
  const lastItem = hasMore ? pageItems.at(-1) : undefined;
  const nextCursor =
    lastItem !== undefined
      ? (() => {
          const value = getTimestamp(lastItem);
          return value instanceof Date ? value.toISOString() : value;
        })()
      : null;
  return {
    items: pageItems,
    nextCursor,
  };
}
