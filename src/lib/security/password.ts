import bcrypt from 'bcryptjs';
import { getEnv } from '@/config/env';

export interface PasswordPolicyViolation {
  rule: string;
  message: string;
}

export class PasswordPolicy {
  private static readonly MIN_LENGTH = 10;

  static validate(password: string): PasswordPolicyViolation[] {
    const violations: PasswordPolicyViolation[] = [];

    if (password.length < PasswordPolicy.MIN_LENGTH) {
      violations.push({
        rule: 'length',
        message: `Password must be at least ${PasswordPolicy.MIN_LENGTH} characters`,
      });
    }
    if (!/[A-Z]/.test(password)) {
      violations.push({ rule: 'uppercase', message: 'Password must contain an uppercase letter' });
    }
    if (!/[a-z]/.test(password)) {
      violations.push({ rule: 'lowercase', message: 'Password must contain a lowercase letter' });
    }
    if (!/[0-9]/.test(password)) {
      violations.push({ rule: 'digit', message: 'Password must contain a digit' });
    }
    if (!/[^A-Za-z0-9]/.test(password)) {
      violations.push({ rule: 'symbol', message: 'Password must contain a symbol' });
    }

    return violations;
  }
}

export class PasswordHasher {
  private readonly cost: number;

  constructor(cost = getEnv().BCRYPT_COST) {
    this.cost = cost;
  }

  async hash(plainText: string): Promise<string> {
    const salt = await bcrypt.genSalt(this.cost);
    return bcrypt.hash(plainText, salt);
  }

  async verify(plainText: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plainText, hash);
  }

  needsRehash(hash: string): boolean {
    const segments = hash.split('$');
    const rounds = Number.parseInt(segments[2] ?? '0', 10);
    return Number.isNaN(rounds) || rounds < this.cost;
  }
}

export const passwordHasher = new PasswordHasher();
