export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "AppError";
  }
}

function normalizeErrorCode(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function notFoundError(
  resource: string,
  id: string,
  codePrefix?: string
): AppError {
  return new AppError(
    404,
    `${normalizeErrorCode(codePrefix ?? resource)}_NOT_FOUND`,
    `${resource} '${id}' was not found`
  );
}
