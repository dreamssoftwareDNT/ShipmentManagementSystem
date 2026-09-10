'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as Icons from 'lucide-react';
import { Ship, X } from 'lucide-react';
import { cn } from '@/utils/cn';
import {
  MODULE_GROUP_LABELS,
  MODULE_GROUP_ORDER,
  type ModuleGroup,
  type ModuleManifest,
} from '@/modules/registry';

export interface SidebarProps {
  items: ModuleManifest[];
  open: boolean;
  onClose: () => void;
}

function resolveIcon(name: string) {
  const registry = Icons as unknown as Record<string, Icons.LucideIcon | undefined>;

  return registry[name] ?? Icons.Circle;
}

export function Sidebar({ items, open, onClose }: SidebarProps) {
  const pathname = usePathname();

  const grouped = MODULE_GROUP_ORDER.map((group) => ({
    group,
    entries: items.filter((item) => item.group === group),
  })).filter((section) => section.entries.length > 0);

  return (
    <>
      {open ? (
        <div
          className="fixed inset-0 z-30 bg-ink/40 lg:hidden"
          onClick={onClose}
          aria-hidden
        />
      ) : null}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 flex-col border-r border-border-subtle bg-surface transition-transform lg:static lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-14 items-center justify-between gap-2 border-b border-border-subtle px-4">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-md bg-brand text-white">
              <Ship className="size-4" aria-hidden />
            </span>
            <span className="text-sm font-semibold tracking-tight text-ink">ImportMS</span>
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="text-ink-subtle transition-colors hover:text-ink lg:hidden"
            aria-label="Close navigation"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-3" aria-label="Main">
          {grouped.map((section) => (
            <div key={section.group} className="mb-4 last:mb-0">
              <p className="px-2 pb-1.5 text-[0.6875rem] font-semibold tracking-wider text-ink-subtle uppercase">
                {MODULE_GROUP_LABELS[section.group as ModuleGroup]}
              </p>
              <ul className="space-y-0.5">
                {section.entries.map((entry) => {
                  const Icon = resolveIcon(entry.icon);
                  const active =
                    pathname === entry.path || pathname.startsWith(`${entry.path}/`);

                  return (
                    <li key={entry.module}>
                      <Link
                        href={entry.path}
                        onClick={onClose}
                        className={cn(
                          'flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors',
                          active
                            ? 'bg-brand-soft font-medium text-brand-strong'
                            : 'text-ink-muted hover:bg-surface-muted hover:text-ink',
                        )}
                        aria-current={active ? 'page' : undefined}
                      >
                        <Icon className="size-4 shrink-0" aria-hidden />
                        <span className="truncate">{entry.title}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-t border-border-subtle px-4 py-3">
          <p className="text-[0.6875rem] text-ink-subtle">
            Freight forwarding ERP
            <br />
            Version 1.0
          </p>
        </div>
      </aside>
    </>
  );
}
