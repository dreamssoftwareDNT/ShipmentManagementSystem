import { z } from 'zod';

const serverEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  AUTH_SECRET: z.string().min(24, 'AUTH_SECRET must be at least 24 characters'),
  AUTH_SESSION_TTL_MINUTES: z.coerce.number().int().positive().default(480),
  AUTH_PASSWORD_RESET_TTL_MINUTES: z.coerce.number().int().positive().default(30),
  AUTH_MAX_FAILED_ATTEMPTS: z.coerce.number().int().positive().default(5),
  AUTH_LOCKOUT_MINUTES: z.coerce.number().int().positive().default(15),
  BCRYPT_COST: z.coerce.number().int().min(10).max(15).default(12),

  APP_NAME: z.string().default('ImportMS Freight ERP'),
  APP_URL: z.string().url().default('http://localhost:3000'),
  APP_BASE_CURRENCY: z.string().length(3).default('USD'),

  UPLOAD_ROOT: z.string().default('./storage/uploads'),
  UPLOAD_MAX_BYTES: z.coerce.number().int().positive().default(15_728_640),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | null = null;

export function getEnv(): ServerEnv {
  if (cached) {
    return cached;
  }

  const parsed = serverEnvSchema.safeParse(process.env);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration -> ${details}`);
  }

  cached = parsed.data;
  return cached;
}

export const isProduction = (): boolean => getEnv().NODE_ENV === 'production';
