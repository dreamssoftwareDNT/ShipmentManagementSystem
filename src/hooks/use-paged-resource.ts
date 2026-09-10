'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApiError, apiClient, type QueryValue } from '@/lib/api/client';
import type { PageResult } from '@/types/common';

export interface PagedResourceOptions {
  initialPageSize?: number;
  initialSortBy?: string;
  initialSortDirection?: 'asc' | 'desc';
  filters?: Record<string, QueryValue>;
  searchDebounceMs?: number;
}

export interface PagedResourceState<TRow> {
  rows: TRow[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  loading: boolean;
  error: string | null;
  search: string;
  sortBy: string | undefined;
  sortDirection: 'asc' | 'desc';
  setSearch: (value: string) => void;
  setPage: (value: number) => void;
  setPageSize: (value: number) => void;
  toggleSort: (key: string) => void;
  refresh: () => void;
}

const EMPTY_PAGE: PageResult<never> = {
  items: [],
  page: 1,
  pageSize: 25,
  total: 0,
  totalPages: 0,
  hasNext: false,
  hasPrevious: false,
};

/**
 * Drives every list screen: server side pagination, sorting and a debounced
 * search that resets to the first page whenever the query changes.
 */
export function usePagedResource<TRow>(
  path: string,
  options: PagedResourceOptions = {},
): PagedResourceState<TRow> {
  const {
    initialPageSize = 25,
    initialSortBy,
    initialSortDirection = 'desc',
    filters,
    searchDebounceMs = 350,
  } = options;

  const [result, setResult] = useState<PageResult<TRow>>(EMPTY_PAGE as PageResult<TRow>);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [search, setSearchValue] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortBy, setSortBy] = useState<string | undefined>(initialSortBy);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(initialSortDirection);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const serialisedFilters = useMemo(() => JSON.stringify(filters ?? {}), [filters]);
  const requestId = useRef(0);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), searchDebounceMs);

    return () => window.clearTimeout(timer);
  }, [search, searchDebounceMs]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, serialisedFilters, pageSize]);

  useEffect(() => {
    const currentRequest = requestId.current + 1;
    requestId.current = currentRequest;

    setLoading(true);
    setError(null);

    apiClient
      .get<PageResult<TRow>>(path, {
        page,
        pageSize,
        search: debouncedSearch || undefined,
        sortBy,
        sortDirection,
        ...(JSON.parse(serialisedFilters) as Record<string, QueryValue>),
      })
      .then((data) => {
        if (requestId.current === currentRequest) {
          setResult(data);
        }
      })
      .catch((cause: unknown) => {
        if (requestId.current !== currentRequest) {
          return;
        }

        setError(
          cause instanceof ApiError ? cause.message : 'The list could not be loaded. Try again.',
        );
        setResult(EMPTY_PAGE as PageResult<TRow>);
      })
      .finally(() => {
        if (requestId.current === currentRequest) {
          setLoading(false);
        }
      });
  }, [path, page, pageSize, debouncedSearch, sortBy, sortDirection, serialisedFilters, reloadToken]);

  const toggleSort = useCallback(
    (key: string) => {
      if (sortBy === key) {
        setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
        return;
      }

      setSortBy(key);
      setSortDirection('asc');
    },
    [sortBy],
  );

  return {
    rows: result.items,
    page: result.page,
    pageSize,
    total: result.total,
    totalPages: result.totalPages,
    loading,
    error,
    search,
    sortBy,
    sortDirection,
    setSearch: setSearchValue,
    setPage,
    setPageSize,
    toggleSort,
    refresh: () => setReloadToken((token) => token + 1),
  };
}
