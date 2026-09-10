'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api/client';
import type { SelectOption } from '@/types/common';

export type OptionSet =
  | 'customers'
  | 'vendors'
  | 'vendorTypes'
  | 'clearingAgents'
  | 'moneyChangers'
  | 'expenseCategories'
  | 'roles'
  | 'shipments'
  | 'currencies';

const cache = new Map<OptionSet, SelectOption[]>();

/**
 * Picker data changes rarely, so each set is fetched once per browser session
 * and shared by every form that needs it.
 */
export function useOptions(set: OptionSet, enabled = true) {
  const [options, setOptions] = useState<SelectOption[]>(() => cache.get(set) ?? []);
  const [loading, setLoading] = useState(!cache.has(set) && enabled);

  useEffect(() => {
    if (!enabled || cache.has(set)) {
      return;
    }

    let active = true;
    setLoading(true);

    apiClient
      .get<SelectOption[]>('/options', { set })
      .then((data) => {
        cache.set(set, data);

        if (active) {
          setOptions(data);
        }
      })
      .catch(() => {
        if (active) {
          setOptions([]);
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [set, enabled]);

  return { options, loading };
}

export function invalidateOptions(set: OptionSet): void {
  cache.delete(set);
}
