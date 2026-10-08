import "server-only";

type ErrorMetadata = {
  status?: unknown;
  statusCode?: unknown;
  code?: unknown;
  name?: unknown;
  cause?: unknown;
};

function safeCode(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "string" && /^[a-zA-Z0-9_.-]{1,64}$/.test(value)) {
    return value;
  }
  return "UNKNOWN";
}

function safeStatus(error: ErrorMetadata) {
  const value = error.status ?? error.statusCode;
  const status = typeof value === "number" ? value : Number(value);
  return Number.isInteger(status) && status >= 100 && status <= 599
    ? status
    : null;
}

export function logOperation(
  operation: string,
  startedAt: number,
  error?: unknown,
) {
  const metadata = error && typeof error === "object"
    ? error as ErrorMetadata
    : {};
  const cause = metadata.cause && typeof metadata.cause === "object"
    ? metadata.cause as ErrorMetadata
    : {};
  const httpStatus = error ? safeStatus(metadata) : 200;
  const diagnostic = {
    operation,
    code: error
      ? safeCode(
          metadata.code ?? cause.code ??
          (httpStatus ? `HTTP_${httpStatus}` : metadata.name),
        )
      : "OK",
    httpStatus,
    durationMs: Date.now() - startedAt,
  };

  if (error) {
    console.error("[recallos-operation]", diagnostic);
  } else {
    console.info("[recallos-operation]", diagnostic);
  }
}
