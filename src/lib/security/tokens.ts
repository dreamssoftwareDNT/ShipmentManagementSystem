import { createHash, randomBytes } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import { getEnv } from '@/config/env';

export interface SessionTokenClaims {
  userId: string;
  sessionId: string;
}

const ISSUER = 'importms';
const AUDIENCE = 'importms-web';

export class TokenService {
  private readonly secret: Uint8Array;

  constructor(secret = getEnv().AUTH_SECRET) {
    this.secret = new TextEncoder().encode(secret);
  }

  async issueSessionToken(claims: SessionTokenClaims, expiresAt: Date): Promise<string> {
    return new SignJWT({ sid: claims.sessionId })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject(claims.userId)
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt()
      .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
      .sign(this.secret);
  }

  async readSessionToken(token: string): Promise<SessionTokenClaims | null> {
    try {
      const { payload } = await jwtVerify(token, this.secret, {
        issuer: ISSUER,
        audience: AUDIENCE,
      });

      if (typeof payload.sub !== 'string' || typeof payload.sid !== 'string') {
        return null;
      }

      return { userId: payload.sub, sessionId: payload.sid };
    } catch {
      return null;
    }
  }

  generateOpaqueToken(byteLength = 48): string {
    return randomBytes(byteLength).toString('base64url');
  }

  fingerprint(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }
}

export const tokenService = new TokenService();
