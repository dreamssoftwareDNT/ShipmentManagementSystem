import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { ZodError, type ZodType, type ZodTypeDef } from 'zod';
import {
  AppError,
  ConflictError,
  ErrorCode,
  NotFoundError,
  ValidationError,
  isAppError,
} from '@/lib/errors';
import { requestContext } from '@/lib/auth/session';
import { AccessControl } from '@/lib/security/access-control';
import { isProduction } from '@/config/env';
import type { AppModule, PermissionAction } from '@/config/permissions';
import type { ApiResponse, RequestContext } from '@/types/common';

export interface RouteParams {
  params: Promise<Record<string, string>>;
}

export interface HandlerArguments<TBody, TQuery> {
  request: Request;
  context: RequestContext;
  body: TBody;
  query: TQuery;
  params: Record<string, string>;
}

export interface RouteDefinition<TBody, TQuery, TResult> {
  module?: AppModule;
  action?: PermissionAction;
  bodySchema?: ZodType<TBody, ZodTypeDef, unknown>;
  querySchema?: ZodType<TQuery, ZodTypeDef, unknown>;
  status?: number;
  handle: (args: HandlerArguments<TBody, TQuery>) => Promise<TResult>;
}

function serialize<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_key, entry) =>
      entry instanceof Prisma.Decimal ? entry.toString() : entry,
    ),
  ) as T;
}

function toFieldErrors(error: ZodError): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const key = issue.path.join('.') || 'form';
    fieldErrors[key] = [...(fieldErrors[key] ?? []), issue.message];
  }

  return fieldErrors;
}

function mapPrismaError(error: Prisma.PrismaClientKnownRequestError): AppError {
  switch (error.code) {
    case 'P2002': {
      const target = (error.meta?.target as string[] | string | undefined) ?? 'field';
      const label = Array.isArray(target) ? target.join(', ') : String(target);
      return new ConflictError(`A record with this ${label} already exists`);
    }
    case 'P2003':
      return new ConflictError('This record is referenced elsewhere and cannot be changed');
    case 'P2025':
      return new NotFoundError('Record');
    default:
      return new ConflictError('The database rejected this operation');
  }
}

function failure(error: AppError): NextResponse<ApiResponse<never>> {
  const payload: ApiResponse<never> = {
    success: false,
    error: {
      code: error.code,
      message: error.message,
      ...(error instanceof ValidationError ? { fieldErrors: error.fieldErrors } : {}),
    },
  };

  return NextResponse.json(payload, { status: error.statusCode });
}

function parseQuery(request: Request): Record<string, string | string[]> {
  const url = new URL(request.url);
  const query: Record<string, string | string[]> = {};

  for (const key of new Set(url.searchParams.keys())) {
    const values = url.searchParams.getAll(key);
    query[key] = values.length > 1 ? values : (values[0] as string);
  }

  return query;
}

/**
 * Wraps a route handler with the concerns every endpoint needs: session
 * resolution, permission enforcement, DTO validation and error translation.
 * Handlers themselves only contain the call into the service layer.
 */
export function defineRoute<TBody = undefined, TQuery = undefined, TResult = unknown>(
  definition: RouteDefinition<TBody, TQuery, TResult>,
) {
  return async (
    request: Request,
    routeContext: RouteParams,
  ): Promise<NextResponse<ApiResponse<TResult>>> => {
    try {
      const context = await requestContext();

      if (definition.module && definition.action) {
        new AccessControl(context.user).assert(definition.module, definition.action);
      }

      const params = (await routeContext?.params) ?? {};

      let body = undefined as TBody;
      if (definition.bodySchema) {
        const raw = await request.json().catch(() => {
          throw new ValidationError('The request body must be valid JSON');
        });
        body = definition.bodySchema.parse(raw);
      }

      let query = undefined as TQuery;
      if (definition.querySchema) {
        query = definition.querySchema.parse(parseQuery(request));
      }

      const result = await definition.handle({ request, context, body, query, params });

      return NextResponse.json(
        { success: true, data: serialize(result) } satisfies ApiResponse<TResult>,
        { status: definition.status ?? 200 },
      );
    } catch (error) {
      return handleRouteError(error) as NextResponse<ApiResponse<TResult>>;
    }
  };
}

export function handleRouteError(error: unknown): NextResponse<ApiResponse<never>> {
  if (error instanceof ZodError) {
    return failure(new ValidationError('The submitted data is invalid', toFieldErrors(error)));
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return failure(mapPrismaError(error));
  }

  if (isAppError(error)) {
    return failure(error);
  }

  if (!isProduction()) {
    console.error('[api] unhandled error', error);
  }

  return NextResponse.json(
    {
      success: false,
      error: {
        code: ErrorCode.INTERNAL_ERROR,
        message: 'Something went wrong while processing the request',
      },
    } satisfies ApiResponse<never>,
    { status: 500 },
  );
}

export { serialize as serializeForTransport };
