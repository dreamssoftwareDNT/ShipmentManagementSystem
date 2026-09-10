import { Prisma } from '@prisma/client';
import { prisma } from '@/database/prisma';

export type TransactionClient = Prisma.TransactionClient;

export type DatabaseClient = TransactionClient | typeof prisma;

export interface TransactionOptions {
  maxWait?: number;
  timeout?: number;
  isolationLevel?: Prisma.TransactionIsolationLevel;
}

const DEFAULT_OPTIONS: Required<Omit<TransactionOptions, 'isolationLevel'>> & TransactionOptions = {
  maxWait: 5_000,
  timeout: 20_000,
  isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
};

/**
 * Runs a set of repository operations inside a single database transaction.
 * Services compose repositories through this helper so that multi table writes
 * such as invoice posting and ledger updates commit or roll back together.
 */
export class UnitOfWork {
  static async run<T>(
    work: (tx: TransactionClient) => Promise<T>,
    options: TransactionOptions = {},
  ): Promise<T> {
    return prisma.$transaction((tx) => work(tx), { ...DEFAULT_OPTIONS, ...options });
  }

  static async runSerializable<T>(work: (tx: TransactionClient) => Promise<T>): Promise<T> {
    return UnitOfWork.run(work, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  }
}

export function resolveClient(client?: DatabaseClient): DatabaseClient {
  return client ?? prisma;
}
