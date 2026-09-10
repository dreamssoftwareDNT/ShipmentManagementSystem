'use client';

import { useState, type ReactNode } from 'react';
import { Sidebar } from './sidebar';
import { Header } from './header';
import type { ModuleManifest } from '@/modules/registry';
import type { AuthenticatedUser } from '@/types/common';

export function AppShell({
  user,
  navigation,
  children,
}: {
  user: AuthenticatedUser;
  navigation: ModuleManifest[];
  children: ReactNode;
}) {
  const [navigationOpen, setNavigationOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      <Sidebar
        items={navigation}
        open={navigationOpen}
        onClose={() => setNavigationOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <Header user={user} onOpenNavigation={() => setNavigationOpen(true)} />
        <main className="flex-1 px-4 py-5 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
