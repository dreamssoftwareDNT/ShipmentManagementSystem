import { redirect } from 'next/navigation';
import { AppShell } from '@/components/layout/app-shell';
import { accessControl, getCurrentUser } from '@/lib/auth/session';
import { MODULE_REGISTRY } from '@/modules/registry';

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  const access = accessControl(user);
  const navigation = MODULE_REGISTRY.filter(
    (entry) => entry.showInNavigation && access.can(entry.module, entry.requiredAction),
  );

  return (
    <AppShell user={user} navigation={navigation}>
      {children}
    </AppShell>
  );
}
