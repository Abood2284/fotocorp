import type { ErrorResponseDto } from "./dtos";
import { AppError } from "./errors";

interface ResponseMeta {
  requestId?: string;
}

interface ApiEnvelope<TData> {
  success: boolean;
  data: TData | null;
  error: {
    code: string;
    message: string;
    detail?: unknown;
  } | null;
  meta: {
    requestId: string | null;
  };
}

export function json<T>(body: T, status = 200): Response {
  return Response.json(body, { status });
}

export function jsonEnvelope<TData>(data: TData, status = 200, meta?: ResponseMeta): Response {
  const body: ApiEnvelope<TData> = {
    success: true,
    data,
    error: null,
    meta: {
      requestId: meta?.requestId ?? null,
    },
  };

  return json(body, status);
}

export function errorResponse(error: unknown, meta?: ResponseMeta): Response {
  if (error instanceof AppError) {
    if (meta) {
      const body: ApiEnvelope<null> = {
        success: false,
        data: null,
        error: {
          code: error.code,
          message: error.message,
          ...(error.detail !== undefined ? { detail: error.detail } : {}),
        },
        meta: {
          requestId: meta.requestId ?? null,
        },
      };
      return json(body, error.status);
    }

    const body: ErrorResponseDto = {
      ok: false,
      error: {
        code: error.code,
        message: error.message,
        ...(error.detail !== undefined ? { detail: error.detail } : {}),
      },
    };

    return json(body, error.status);
  }

  if (meta) {
    const body: ApiEnvelope<null> = {
      success: false,
      data: null,
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred",
      },
      meta: {
        requestId: meta.requestId ?? null,
      },
    };
    return json(body, 500);
  }

  const body: ErrorResponseDto = {
    ok: false,
    error: {
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred"
    }
  };

  return json(body, 500);
}
