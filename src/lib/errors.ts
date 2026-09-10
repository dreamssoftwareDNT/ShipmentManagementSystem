export const ErrorCode = {
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  BUSINESS_RULE_VIOLATION: 'BUSINESS_RULE_VIOLATION',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;
export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export abstract class AppError extends Error {
  abstract readonly code: ErrorCode;
  abstract readonly statusCode: number;

  protected constructor(message: string) {
    super(message);
    this.name = new.target.name;
    Error.captureStackTrace?.(this, new.target);
  }
}

export class ValidationError extends AppError {
  readonly code = ErrorCode.VALIDATION_FAILED;
  readonly statusCode = 422;
  readonly fieldErrors: Record<string, string[]>;

  constructor(message = 'The submitted data is invalid', fieldErrors: Record<string, string[]> = {}) {
    super(message);
    this.fieldErrors = fieldErrors;
  }
}

export class UnauthenticatedError extends AppError {
  readonly code = ErrorCode.UNAUTHENTICATED;
  readonly statusCode = 401;

  constructor(message = 'Authentication is required') {
    super(message);
  }
}

export class ForbiddenError extends AppError {
  readonly code = ErrorCode.FORBIDDEN;
  readonly statusCode = 403;

  constructor(message = 'You do not have permission to perform this action') {
    super(message);
  }
}

export class NotFoundError extends AppError {
  readonly code = ErrorCode.NOT_FOUND;
  readonly statusCode = 404;

  constructor(resource: string, identifier?: string) {
    super(identifier ? `${resource} '${identifier}' was not found` : `${resource} was not found`);
  }
}

export class ConflictError extends AppError {
  readonly code = ErrorCode.CONFLICT;
  readonly statusCode = 409;

  constructor(message: string) {
    super(message);
  }
}

export class BusinessRuleError extends AppError {
  readonly code = ErrorCode.BUSINESS_RULE_VIOLATION;
  readonly statusCode = 400;

  constructor(message: string) {
    super(message);
  }
}

export class RateLimitError extends AppError {
  readonly code = ErrorCode.RATE_LIMITED;
  readonly statusCode = 429;

  constructor(message = 'Too many attempts, please try again later') {
    super(message);
  }
}

export class InternalError extends AppError {
  readonly code = ErrorCode.INTERNAL_ERROR;
  readonly statusCode = 500;

  constructor(message = 'An unexpected error occurred') {
    super(message);
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
