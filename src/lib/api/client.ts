import type { ApiResponse, PageResult } from '@/types/common';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
    readonly fieldErrors: Record<string, string[]> = {},
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export type QueryValue = string | number | boolean | null | undefined;

function buildUrl(path: string, query?: Record<string, QueryValue>): string {
  if (!query) {
    return path;
  }

  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') {
      params.set(key, String(value));
    }
  }

  const search = params.toString();

  return search ? `${path}?${search}` : path;
}

async function parse<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => null)) as ApiResponse<T> | null;

  if (!payload) {
    throw new ApiError('The server returned an unreadable response', 'INTERNAL_ERROR', response.status);
  }

  if (!payload.success) {
    throw new ApiError(
      payload.error.message,
      payload.error.code,
      response.status,
      payload.error.fieldErrors ?? {},
    );
  }

  return payload.data;
}

/**
 * Thin transport used by every client feature. Route handlers already return a
 * uniform envelope, so failures surface as a typed ApiError with the field
 * errors attached ready for react-hook-form.
 */
export const apiClient = {
  async get<T>(path: string, query?: Record<string, QueryValue>): Promise<T> {
    const response = await fetch(buildUrl(`/api${path}`, query), {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });

    return parse<T>(response);
  },

  async post<T>(path: string, body?: unknown): Promise<T> {
    const response = await fetch(`/api${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    return parse<T>(response);
  },

  async put<T>(path: string, body: unknown): Promise<T> {
    const response = await fetch(`/api${path}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
    });

    return parse<T>(response);
  },

  async delete<T>(path: string): Promise<T> {
    const response = await fetch(`/api${path}`, {
      method: 'DELETE',
      headers: { Accept: 'application/json' },
    });

    return parse<T>(response);
  },

  async upload<T>(path: string, formData: FormData): Promise<T> {
    const response = await fetch(`/api${path}`, { method: 'POST', body: formData });

    return parse<T>(response);
  },
};

export type PagedResponse<T> = PageResult<T>;
