import type { PermissionCode } from '@/config/permissions';

export interface AuthenticatedUser {
  id: string;
  fullName: string;
  email: string;
  roles: string[];
  permissions: PermissionCode[];
}

export interface RequestContext {
  user: AuthenticatedUser;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface PageRequest {
  page: number;
  pageSize: number;
  sortBy?: string;
  sortDirection: 'asc' | 'desc';
  search?: string;
}

export interface PageResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface SelectOption {
  value: string;
  label: string;
  hint?: string;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiFailure {
  success: false;
  error: {
    code: string;
    message: string;
    fieldErrors?: Record<string, string[]>;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export interface MoneySummary {
  currencyCode: string;
  amount: string;
}

export type Nullable<T> = T | null;
