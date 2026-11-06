export function createOffsetPageRequest(page?: number, limit?: number): Partial<OffsetPageRequest> {
  return {
    page: page === undefined ? undefined : Number(page),
    limit: limit === undefined ? undefined : Number(limit),
  };
}

export interface OffsetPageRequest {
  page: number;
  limit: number;
}

export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export function normalizeOffsetPageRequest(pageReq?: number, limitReq?: number): OffsetPageRequest {
  const page = Number.isFinite(pageReq) ? Math.max(1, Math.trunc(pageReq!)) : DEFAULT_PAGE;

  const limit = Number.isFinite(limitReq)
    ? Math.min(MAX_PAGE_SIZE, Math.max(1, Math.trunc(limitReq!)))
    : DEFAULT_PAGE_SIZE;

  return { page, limit };
}

export function getOffset(request: OffsetPageRequest): number {
  return (request.page - 1) * request.limit;
}

export interface PageSlice<T> {
  items: T[];
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  page: number;
  limit: number;
}

export function createPageSlice<T>(items: T[], request: OffsetPageRequest, hasNextPage: boolean): PageSlice<T> {
  return {
    items,
    hasNextPage,
    hasPreviousPage: request.page > 1,
    page: request.page,
    limit: request.limit,
  };
}
