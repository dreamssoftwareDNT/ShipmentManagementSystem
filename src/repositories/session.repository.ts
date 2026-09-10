import type { PasswordResetToken, Prisma, Session } from '@prisma/client';
import { resolveClient, type DatabaseClient } from '@/database/unit-of-work';

export class SessionRepository {
  async create(data: Prisma.SessionUncheckedCreateInput, client?: DatabaseClient): Promise<Session> {
    return resolveClient(client).session.create({ data });
  }

  async findActive(
    id: string,
    tokenHash: string,
    client?: DatabaseClient,
  ): Promise<Session | null> {
    return resolveClient(client).session.findFirst({
      where: { id, tokenHash, revokedAt: null, expiresAt: { gt: new Date() } },
    });
  }

  async touch(id: string, client?: DatabaseClient): Promise<void> {
    await resolveClient(client).session.update({
      where: { id },
      data: { lastSeenAt: new Date() },
    });
  }

  async revoke(id: string, client?: DatabaseClient): Promise<void> {
    await resolveClient(client).session.updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllForUser(userId: string, client?: DatabaseClient): Promise<void> {
    await resolveClient(client).session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async purgeExpired(client?: DatabaseClient): Promise<number> {
    const result = await resolveClient(client).session.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });

    return result.count;
  }
}

export class PasswordResetTokenRepository {
  async create(
    data: Prisma.PasswordResetTokenUncheckedCreateInput,
    client?: DatabaseClient,
  ): Promise<PasswordResetToken> {
    return resolveClient(client).passwordResetToken.create({ data });
  }

  async findUsable(tokenHash: string, client?: DatabaseClient): Promise<PasswordResetToken | null> {
    return resolveClient(client).passwordResetToken.findFirst({
      where: { tokenHash, usedAt: null, expiresAt: { gt: new Date() } },
    });
  }

  async markUsed(id: string, client?: DatabaseClient): Promise<void> {
    await resolveClient(client).passwordResetToken.update({
      where: { id },
      data: { usedAt: new Date() },
    });
  }

  async invalidateForUser(userId: string, client?: DatabaseClient): Promise<void> {
    await resolveClient(client).passwordResetToken.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: new Date() },
    });
  }
}

export class LoginAttemptRepository {
  async record(
    data: Prisma.LoginAttemptUncheckedCreateInput,
    client?: DatabaseClient,
  ): Promise<void> {
    await resolveClient(client).loginAttempt.create({ data });
  }

  async countRecentFailures(email: string, since: Date, client?: DatabaseClient): Promise<number> {
    return resolveClient(client).loginAttempt.count({
      where: { email: email.toLowerCase(), successful: false, createdAt: { gte: since } },
    });
  }
}

export const sessionRepository = new SessionRepository();
export const passwordResetTokenRepository = new PasswordResetTokenRepository();
export const loginAttemptRepository = new LoginAttemptRepository();
