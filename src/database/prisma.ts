import { PrismaClient } from '@prisma/client';
import { getEnv } from '@/config/env';

declare global {
  // eslint-disable-next-line no-var
  var __prismaClient: PrismaClient | undefined;
}

function createClient(): PrismaClient {
  const env = getEnv();

  return new PrismaClient({
    log:
      env.NODE_ENV === 'development'
        ? [{ level: 'warn', emit: 'stdout' }, { level: 'error', emit: 'stdout' }]
        : [{ level: 'error', emit: 'stdout' }],
    errorFormat: 'minimal',
  });
}

export const prisma: PrismaClient = globalThis.__prismaClient ?? createClient();

if (getEnv().NODE_ENV !== 'production') {
  globalThis.__prismaClient = prisma;
}
