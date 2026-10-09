import "server-only";

type ErrorMetadata = {
  status?: unknown;
  statusCode?: unknown;
  code?: unknown;
  name?: unknown;
  cause?: unknown;
};

const SAFE_DETAIL_KEYS = [
  "factCount",
  "total",
  "succeeded",
  "failed",
  "done",
  "jobFailed",
  "timedOut",
] as const;

type SafeDetailKey = (typeof SAFE_DETAIL_KEYS)[number];

export type SafeOperationDetails = Partial<Record<SafeDetailKey, number>>;

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

function safeDetails(details?: SafeOperationDetails) {
  if (!details) return {};

  const sanitized: Record<string, number> = {};
  for (const key of SAFE_DETAIL_KEYS) {
    const value = details[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

export function logOperation(
  operation: string,
  startedAt: number,
  error?: unknown,
  details?: SafeOperationDetails,
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
    ...safeDetails(details),
  };

  // Next's log collector often renders a second-argument object as `{}`.
  const line = `[recallos-operation] ${JSON.stringify(diagnostic)}`;
  if (error) {
    console.error(line);
  } else {
    console.info(line);
  }
}
