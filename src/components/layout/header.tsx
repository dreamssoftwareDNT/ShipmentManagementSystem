'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, LogOut, Menu, User } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import { initials } from '@/utils/format';
import { cn } from '@/utils/cn';
import type { AuthenticatedUser } from '@/types/common';

export function Header({
  user,
  onOpenNavigation,
}: {
  user: AuthenticatedUser;
  onOpenNavigation: () => void;
}) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    const handleClick = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClick);

    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpen]);

  const signOut = async () => {
    setSigningOut(true);

    try {
      await apiClient.post('/auth/logout');
      router.replace('/login');
      router.refresh();
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border-subtle bg-surface px-4">
      <button
        type="button"
        onClick={onOpenNavigation}
        className="text-ink-muted transition-colors hover:text-ink lg:hidden"
        aria-label="Open navigation"
      >
        <Menu className="size-5" aria-hidden />
      </button>

      <div className="ml-auto flex items-center gap-3">
        <div className="hidden text-right sm:block">
          <p className="text-sm font-medium text-ink">{user.fullName}</p>
          <p className="text-xs text-ink-subtle">
            {user.roles.map((role) => role.replace(/_/g, ' ').toLowerCase()).join(', ')}
          </p>
        </div>

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            className="flex items-center gap-1.5 rounded-md p-1 transition-colors hover:bg-surface-muted"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            <span className="flex size-8 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand-strong">
              {initials(user.fullName)}
            </span>
            <ChevronDown
              className={cn('size-4 text-ink-subtle transition-transform', menuOpen && 'rotate-180')}
              aria-hidden
            />
          </button>

          {menuOpen ? (
            <div
              role="menu"
              className="absolute right-0 top-full z-30 mt-1 w-56 rounded-md border border-border-subtle bg-surface py-1 shadow-lg"
            >
              <div className="border-b border-border-subtle px-3 py-2">
                <p className="truncate text-sm font-medium text-ink">{user.fullName}</p>
                <p className="truncate text-xs text-ink-subtle">{user.email}</p>
              </div>

              <a
                href="/profile"
                role="menuitem"
                className="flex items-center gap-2 px-3 py-2 text-sm text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink"
              >
                <User className="size-4" aria-hidden />
                My profile
              </a>

              <button
                type="button"
                role="menuitem"
                onClick={signOut}
                disabled={signingOut}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-critical transition-colors hover:bg-critical-soft disabled:opacity-60"
              >
                <LogOut className="size-4" aria-hidden />
                {signingOut ? 'Signing out' : 'Sign out'}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
