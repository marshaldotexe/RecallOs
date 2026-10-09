import { getTesterIdentity, isSameOrigin, testerRequired } from "@/lib/tester-session";
import { saveUsefulFacts, summarizeMemorySave } from "@/lib/memwal";
import { logOperation } from "@/lib/server-diagnostics";

const MAX_TEXT_LENGTH = 4_000;
// Cover analyze (up to 60s) plus remember-job polling (up to 120s).
export const maxDuration = 180;



export async function POST(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ error: "Invalid request origin." }, { status: 403 });
  const identity = await getTesterIdentity();
  if (!identity) return testerRequired();
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "The request body must be valid JSON." }, { status: 400 });
  }

  // Client identity is only a consistency check; it never chooses the namespace.
  if (!body || typeof body !== "object" || !("testerId" in body) || body.testerId !== identity.id) {
    return Response.json({ error: "Tester session changed. Reload RecallOS before continuing." }, { status: 409 });
  }
  const text = body && typeof body === "object" && "text" in body
    ? (body as { text?: unknown }).text
    : null;

  if (typeof text !== "string" || !text.trim() || text.length > MAX_TEXT_LENGTH) {
    return Response.json({ error: "A valid message is required." }, { status: 400 });
  }

  const startedAt = Date.now();

  try {
    const result = await saveUsefulFacts(text.trim(), identity.namespace);
    const details = summarizeMemorySave(result);

    if (result.failed > 0) {
      const timedOut = (details.timedOut ?? 0) > 0 && (details.jobFailed ?? 0) === 0;
      logOperation("walrus.save", startedAt, {
        code: timedOut ? "SAVE_TIMEOUT" : "PARTIAL_FAILURE",
        status: timedOut ? 504 : 502,
      }, details);
      return Response.json(
        { saved: false, error: "Some memories could not be saved." },
        { status: 502 },
      );
    }

    logOperation("walrus.save", startedAt, undefined, details);
    return Response.json({ saved: true, savedCount: result.succeeded });
  } catch (error) {
    logOperation("walrus.save", startedAt, error);
    return Response.json(
      { saved: false, error: "Memory saving failed." },
      { status: 502 },
    );
  }
}
